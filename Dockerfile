FROM node:22-bookworm-slim AS catalog
WORKDIR /project
COPY scripts/export-java-catalog.mjs scripts/
COPY dist/ dist/
RUN node scripts/export-java-catalog.mjs /project/catalog.tsv

FROM eclipse-temurin:21-jdk AS build
WORKDIR /project
COPY java/src/ src/
COPY --from=catalog /project/catalog.tsv classes/catalog.tsv
COPY --from=catalog /project/dist/ classes/web/
RUN javac --release 21 -encoding UTF-8 -d classes src/nextplay/*.java \
    && jar --create --file nextplay.jar --main-class nextplay.NextplayServer -C classes .

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /project/nextplay.jar /app/nextplay.jar
ENV NEXTPLAY_HOST=0.0.0.0 PORT=80
EXPOSE 80
ENTRYPOINT ["java", "-jar", "/app/nextplay.jar"]
