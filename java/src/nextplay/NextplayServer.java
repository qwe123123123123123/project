package nextplay;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

import nextplay.RecommendationEngine.Game;
import nextplay.RecommendationEngine.Match;
import nextplay.RecommendationEngine.Preferences;
import nextplay.RecommendationEngine.Suggestions;

public final class NextplayServer {
    private static final int MAX_FORM_BYTES = 32768;
    private static final Map<String, String> MIME = Map.of(
        "html", "text/html; charset=utf-8", "mjs", "text/javascript; charset=utf-8",
        "js", "text/javascript; charset=utf-8", "css", "text/css; charset=utf-8",
        "json", "application/json; charset=utf-8", "webmanifest", "application/manifest+json",
        "svg", "image/svg+xml", "png", "image/png", "jpg", "image/jpeg", "webp", "image/webp"
    );
    private final RecommendationEngine engine;
    private final int catalogSize;

    private NextplayServer(List<Game> catalog) {
        engine = new RecommendationEngine(catalog);
        catalogSize = catalog.size();
    }

    public static void main(String[] args) throws IOException {
        NextplayServer app = new NextplayServer(readCatalog());
        String host = System.getenv().getOrDefault("NEXTPLAY_HOST", "127.0.0.1");
        int port = args.length == 0 ? Integer.parseInt(System.getenv().getOrDefault("PORT", "4173"))
            : Integer.parseInt(args[0]);
        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.setExecutor(Executors.newFixedThreadPool(Math.max(2, Math.min(8, Runtime.getRuntime().availableProcessors()))));
        server.createContext("/", app::handle);
        server.start();
        System.out.printf("NEXTPLAY · Java %s · http://%s:%d · %d games%n",
            Runtime.version().feature(), host, server.getAddress().getPort(), app.catalogSize);
    }

    private static List<Game> readCatalog() throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                NextplayServer.class.getResourceAsStream("/catalog.tsv"), StandardCharsets.UTF_8))) {
            return reader.lines().map(line -> {
                String[] f = line.split("\t", -1);
                return new Game(Integer.parseInt(f[0]), Boolean.parseBoolean(f[1]), Boolean.parseBoolean(f[2]),
                    nullableInteger(f[3]), nullableInteger(f[4]), f[5], list(f[6]), list(f[7]),
                    Arrays.stream(f[8].split(",")).mapToDouble(Double::parseDouble).toArray(), Double.parseDouble(f[9]));
            }).toList();
        }
    }

    private void handle(HttpExchange exchange) throws IOException {
        try (exchange) {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if (path.equals("/api/recommendations")) {
                if (method.equals("POST")) recommend(exchange);
                else methodNotAllowed(exchange, "POST");
                return;
            }
            if (!method.equals("GET") && !method.equals("HEAD")) {
                methodNotAllowed(exchange, "GET, HEAD");
                return;
            }
            if (path.equals("/api/health")) {
                json(exchange, 200, "{\"runtime\":\"java\",\"games\":" + catalogSize + "}");
                return;
            }
            servePage(exchange, path.equals("/") ? "/index.html" : path);
        }
    }

    private void recommend(HttpExchange exchange) throws IOException {
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.split(";", 2)[0].strip().equalsIgnoreCase("application/x-www-form-urlencoded")) {
            json(exchange, 415, "{\"error\":\"Expected a URL-encoded form\"}");
            return;
        }
        byte[] body = exchange.getRequestBody().readNBytes(MAX_FORM_BYTES + 1);
        if (body.length > MAX_FORM_BYTES) {
            json(exchange, 413, "{\"error\":\"Form is too large\"}");
            return;
        }
        Map<String, String> form;
        Preferences prefs;
        try {
            form = parseForm(new String(body, StandardCharsets.UTF_8));
            prefs = preferences(form);
        } catch (IllegalArgumentException error) {
            json(exchange, 400, "{\"error\":\"Invalid preferences\"}");
            return;
        }
        Suggestions results = engine.suggest(prefs);
        if ("daily".equals(form.get("kind"))) {
            Match daily = results.daily();
            json(exchange, 200, "{\"game\":" + (daily == null ? "null" : matchJson(daily)) + "}");
            return;
        }
        String games = results.games().stream().map(NextplayServer::matchJson).collect(Collectors.joining(","));
        json(exchange, 200, "{\"approximate\":" + results.approximate() + ",\"games\":[" + games + "]}");
    }

    private static void servePage(HttpExchange exchange, String path) throws IOException {
        String type = MIME.get(path.substring(path.lastIndexOf('.') + 1));
        if (type != null && path.matches("/[A-Za-z0-9_/.-]+") && !path.contains("..")) {
            try (InputStream resource = NextplayServer.class.getResourceAsStream("/web" + path)) {
                if (resource != null) {
                    byte[] body = resource.readAllBytes();
                    if (path.equals("/index.html")) {
                        String html = new String(body, StandardCharsets.UTF_8);
                        body = html.replace("<head>", "<head><meta name=\"nextplay-runtime\" content=\"java\">")
                            .getBytes(StandardCharsets.UTF_8);
                    }
                    exchange.getResponseHeaders().set("Cache-Control", "no-cache");
                    send(exchange, 200, type, body);
                    return;
                }
            }
        }
        json(exchange, 404, "{\"error\":\"Not found\"}");
    }

    private static Map<String, String> parseForm(String input) {
        Map<String, String> form = new HashMap<>();
        for (String field : input.split("&")) {
            String[] pair = field.split("=", 2);
            if (pair.length == 2) form.put(URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                URLDecoder.decode(pair[1], StandardCharsets.UTF_8));
        }
        return form;
    }

    private static Preferences preferences(Map<String, String> form) {
        String mood = form.getOrDefault("mood", "");
        String mode = form.getOrDefault("mode", "");
        int age = Integer.parseInt(form.getOrDefault("age", "99"));
        int time = Integer.parseInt(form.getOrDefault("time", "0"));
        if ((!mood.isEmpty() && !RecommendationEngine.MOODS.contains(mood))
            || !Set.of("", "solo", "friends").contains(mode) || age < 0 || age > 99 || time < 0 || time > 1440) {
            throw new IllegalArgumentException("Invalid recommendation parameters");
        }
        Set<Integer> owned = list(form.getOrDefault("owned", "")).stream().map(Integer::parseInt)
            .collect(Collectors.toSet());
        return new Preferences(mood, time, mode, "low".equals(form.get("hardware")), "true".equals(form.get("free")),
            age, new HashSet<>(list(form.getOrDefault("genres", ""))), "true".equals(form.get("hideOwned")), owned);
    }

    private static Integer nullableInteger(String value) {
        return value.isEmpty() ? null : Integer.valueOf(value);
    }

    private static List<String> list(String value) {
        return value.isEmpty() ? List.of() : List.of(value.split("\\|"));
    }

    private static String matchJson(Match game) {
        String breakdown = game.breakdown().stream()
            .map(c -> "{\"label\":" + quote(c.label()) + ",\"weight\":" + c.weight() + ",\"value\":" + c.value() + "}")
            .collect(Collectors.joining(","));
        return "{\"id\":" + game.game().id() + ",\"match\":" + game.match() + ",\"breakdown\":[" + breakdown
            + "],\"reasons\":" + strings(game.reasons()) + ",\"adjustments\":" + strings(game.adjustments()) + "}";
    }

    private static String strings(List<String> values) {
        return values.stream().map(NextplayServer::quote).collect(Collectors.joining(",", "[", "]"));
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t") + "\"";
    }

    private static void methodNotAllowed(HttpExchange exchange, String allow) throws IOException {
        exchange.getResponseHeaders().set("Allow", allow);
        json(exchange, 405, "{\"error\":\"Method not allowed\"}");
    }

    private static void json(HttpExchange exchange, int status, String body) throws IOException {
        send(exchange, status, MIME.get("json"), body.getBytes(StandardCharsets.UTF_8));
    }

    private static void send(HttpExchange exchange, int status, String contentType, byte[] body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        boolean head = exchange.getRequestMethod().equals("HEAD");
        if (head) exchange.getResponseHeaders().set("Content-Length", Integer.toString(body.length));
        exchange.sendResponseHeaders(status, head ? -1 : body.length);
        if (!head) exchange.getResponseBody().write(body);
    }
}
