# FILE: Dockerfile | PURPOSE: Containerize the FastAPI backend for deployment to Render | CONNECTS TO: backend-cd.yml (CI/CD builds and pushes this image)

# ── BASE IMAGE ────────────────────────────────────────────────────────────────
# python:3.11-slim: official Python 3.11 on Debian slim — small image, no dev tools.
# Decision NOT to use python:3.11-alpine: Alpine uses musl libc which causes
# cryptography and psycopg2 build failures without extra tooling. Slim is safer.
FROM python:3.11-slim

# ── WORKING DIRECTORY ─────────────────────────────────────────────────────────
# All subsequent commands run relative to /app inside the container.
WORKDIR /app

# ── SYSTEM DEPENDENCIES ───────────────────────────────────────────────────────
# gcc and libpq-dev are needed to compile any C-extension Python packages.
# We install them, build what we need, then clean up to keep the layer small.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ── PYTHON DEPENDENCIES ───────────────────────────────────────────────────────
# Copy requirements.txt first — Docker layer caching means pip install only
# reruns when requirements.txt changes, not on every code change. This makes
# rebuilds much faster during development.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── APPLICATION CODE ──────────────────────────────────────────────────────────
# Copy after installing deps so code changes don't invalidate the pip layer.
COPY . .

# ── PORT ──────────────────────────────────────────────────────────────────────
# Render injects the PORT env var; 8000 is the default for local use.
# EXPOSE is documentation only — it doesn't actually open the port.
EXPOSE 8000

# ── STARTUP COMMAND ───────────────────────────────────────────────────────────
# --host 0.0.0.0: listen on all interfaces (not just localhost) inside the container
# --port 8000:    must match EXPOSE above
# --workers 2:    two worker processes for the production Render instance
#                 Decision: 2 workers balances memory usage vs. request concurrency.
#                 Increase to 4 on a paid Render plan with more RAM.
# Decision NOT to use --reload: that flag is for development only. In production
# it would restart the server on every file change (none expected, but risky).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
