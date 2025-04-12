FROM python:3.12-alpine

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv /uv /uvx /bin/
COPY pyproject.toml .
RUN uv sync

COPY . .

CMD ["uv", "run", "fastapi", "run", "--host", "0.0.0.0", "--port", "8000"]
