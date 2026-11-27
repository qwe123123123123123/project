package nextplay;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class RecommendationEngine {
    static final List<String> MOODS = List.of("story", "relax", "challenge", "social", "explore");
    private static final List<String> MOOD_LABELS = List.of(
        "Погрузиться в историю", "Выдохнуть", "Бросить себе вызов", "Собраться с друзьями", "Исследовать мир"
    );

    record Game(int id, boolean free, boolean comingSoon, Integer age, Integer minutes,
                String hardware, List<String> genres, List<String> modes, double[] experience, double rating) {
        boolean canPlay(String mode) {
            if (mode.equals("friends")) return modes.stream().anyMatch(value -> !value.equals("solo"));
            return mode.isEmpty() || modes.contains("solo");
        }
    }

    record Preferences(String mood, int time, String mode, boolean lowHardware, boolean free,
                       int age, Set<String> genres, boolean hideOwned, Set<Integer> owned, Map<Integer, Double> taste) {}
    record Component(String label, int weight, int value) {}
    record Match(Game game, Integer match, List<Component> breakdown, List<String> reasons,
                 List<String> adjustments, double cost) {}
    private record Neighbor(double similarity, double vote) {}
    record Suggestions(List<Match> games, boolean approximate) {
        Match daily() {
            if (approximate) return games.getFirst();
            return games.stream().min(BY_MATCH.thenComparing(BY_RATING)
                .thenComparingInt(m -> m.game.minutes == null ? Integer.MAX_VALUE : m.game.minutes)
                .thenComparingInt(m -> m.game.id)).orElse(null);
        }
    }

    private static final Comparator<Match> BY_MATCH =
        Comparator.<Match>comparingInt(m -> m.match == null ? 0 : m.match).reversed();
    private static final Comparator<Match> BY_RATING =
        Comparator.<Match>comparingDouble(m -> m.game.rating).reversed();
    private final List<Game> available;

    RecommendationEngine(List<Game> catalog) {
        available = catalog.stream().filter(game -> !game.comingSoon).toList();
    }

    Suggestions suggest(Preferences prefs) {
        List<Game> library = available.stream().filter(game -> prefs.owned.contains(game.id)).toList();
        List<Game> examples = available.stream().filter(game -> prefs.taste.containsKey(game.id)).toList();
        List<Game> eligible = available.stream()
            .filter(game -> !prefs.free || game.free)
            .filter(game -> prefs.age == 99 || game.age != null && game.age <= prefs.age)
            .toList();
        List<Match> exact = eligible.stream()
            .filter(game -> (!prefs.hideOwned || !prefs.owned.contains(game.id))
                && (!prefs.lowHardware || game.hardware.equals("low")) && game.canPlay(prefs.mode)
                && (prefs.time == 0 || game.minutes != null && game.minutes <= prefs.time))
            .map(game -> score(game, prefs, library, examples, false))
            .sorted(BY_MATCH).toList();
        if (!exact.isEmpty()) return new Suggestions(exact, false);

        List<Match> closest = eligible.stream()
            .map(game -> score(game, prefs, library, examples, true))
            .sorted(Comparator.comparingDouble(Match::cost).thenComparing(BY_MATCH)
                .thenComparing(BY_RATING).thenComparingInt(m -> m.game.id))
            .limit(6).toList();
        return new Suggestions(closest, !closest.isEmpty());
    }

    private static Match score(Game game, Preferences prefs, List<Game> library, List<Game> examples, boolean approximate) {
        List<Component> breakdown = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        int mood = MOODS.indexOf(prefs.mood);
        if (mood >= 0) {
            double strength = game.experience[mood];
            String label = MOOD_LABELS.get(mood).toLowerCase(Locale.ROOT);
            breakdown.add(component("Настроение", 45, strength));
            reasons.add(strength >= .8 ? "Хорошо подходит: " + label
                : strength >= .5 ? "Частично подходит: " + label : "Это настроение выражено слабо");
        }
        if (!prefs.genres.isEmpty()) {
            List<String> common = game.genres.stream().filter(prefs.genres::contains).toList();
            breakdown.add(component("Любимые жанры", 30, (double) common.size() / game.genres.size()));
            if (!common.isEmpty()) reasons.add(String.join(" / ", common));
        }
        if (!library.isEmpty()) {
            double affinity = libraryAffinity(game, library);
            breakdown.add(component("Похожесть на библиотеку", 25, affinity));
            if (affinity >= .5) reasons.add("похожа по жанру и характеру на вашу библиотеку");
        }
        List<Neighbor> neighbors = examples.stream().filter(other -> other.id != game.id)
            .map(other -> new Neighbor(similarity(game, other), prefs.taste.get(other.id)))
            .filter(n -> n.similarity >= .4)
            .sorted(Comparator.comparingDouble(Neighbor::similarity).reversed()).limit(5).toList();
        if (!neighbors.isEmpty()) {
            double totalWeight = 0;
            double totalVote = 0;
            for (Neighbor n : neighbors) {
                double weight = n.similarity * n.similarity;
                totalWeight += weight;
                totalVote += weight * n.vote * n.similarity;
            }
            double taste = .5 + .5 * totalVote / totalWeight;
            breakdown.add(component("Личный вкус", 35, taste));
            if (taste >= .62) reasons.add("похожа на игры, которые тебе нравятся");
            if (taste <= .38) reasons.add("похожа на игры, которые ты отклонил");
        }
        if (!approximate) {
            if (prefs.time != 0) reasons.add("сессия от " + game.minutes + " мин");
            if (!prefs.mode.isEmpty()) {
                reasons.add(prefs.mode.equals("solo") ? "можно играть одному" : "есть совместный режим");
            }
        }
        if (reasons.isEmpty()) reasons.add("Настройте подбор под себя");
        int totalWeight = breakdown.stream().mapToInt(Component::weight).sum();
        int weightedScore = breakdown.stream().mapToInt(c -> c.value * c.weight).sum();
        Integer match = totalWeight == 0 ? null : (int) Math.round((double) weightedScore / totalWeight);
        List<String> adjustments = new ArrayList<>();
        double cost = 0;
        if (approximate) {
            if (!game.canPlay(prefs.mode)) {
                adjustments.add(prefs.mode.equals("solo") ? "Нужны другие игроки" : "Игра рассчитана на одного");
                cost += 6;
            }
            if (prefs.lowHardware && !game.hardware.equals("low")) {
                boolean unknown = game.hardware.isEmpty();
                adjustments.add(unknown ? "Работа на слабом ПК не проверена" : "Требования к ПК выше");
                cost += unknown ? 4 : 5;
            }
            if (prefs.time != 0 && (game.minutes == null || game.minutes > prefs.time)) {
                adjustments.add(game.minutes == null ? "Длительность сессии неизвестна" : "Сессия от " + game.minutes + " мин");
                cost += game.minutes == null ? 3 : Math.min(3, (game.minutes - prefs.time) / 20.0 + 1);
            }
            if (prefs.hideOwned && prefs.owned.contains(game.id)) {
                adjustments.add("Уже есть в твоей библиотеке");
                cost += 15;
            }
        }
        return new Match(game, match, breakdown, reasons, adjustments, cost);
    }

    private static Component component(String label, int weight, double ratio) {
        return new Component(label, weight, (int) Math.round(ratio * 100));
    }

    private static double libraryAffinity(Game game, List<Game> library) {
        List<Double> scores = library.stream().filter(other -> other.id != game.id)
            .map(other -> similarity(game, other)).sorted(Comparator.reverseOrder()).limit(3).toList();
        if (scores.isEmpty()) return 1;
        double sum = 0;
        for (double score : scores) sum += score;
        return sum / scores.size();
    }

    private static double similarity(Game game, Game other) {
        Set<String> union = new HashSet<>(game.genres);
        union.addAll(other.genres);
        long common = game.genres.stream().filter(other.genres::contains).count();
        double distance = 0;
        for (int i = 0; i < game.experience.length; i++) {
            distance += Math.abs(game.experience[i] - other.experience[i]);
        }
        return .65 * (union.isEmpty() ? 0 : (double) common / union.size()) + .35 * (1 - distance / game.experience.length);
    }
}
