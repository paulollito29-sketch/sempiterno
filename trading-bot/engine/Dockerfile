# Motor del bot (Python). Uso: docker compose up -d   (ver ../docker-compose.yml)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=UTC

# LightGBM necesita OpenMP (libgomp)
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install .

# Usuario sin privilegios; datos, modelos y reportes en volúmenes
RUN useradd --create-home --uid 1000 bot \
 && mkdir -p /app/data /app/models /app/reports \
 && chown -R bot:bot /app
USER bot

VOLUME ["/app/data", "/app/models", "/app/reports"]
CMD ["cryptobot", "run"]
