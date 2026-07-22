FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir uv
RUN uv pip install --system fastapi uvicorn email-validator httpx pytest

COPY app ./app
COPY tests ./tests

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
