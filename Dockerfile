# Build the React bundle, then ship it next to the FastAPI app in a slim Python image.
FROM node:26-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=5000 \
    PATCHGRAPH_SQLITE_PATH=/data/patchgraph.db
WORKDIR /app

COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock

COPY backend ./backend
COPY intelligence ./intelligence
COPY data/fixtures ./data/fixtures
COPY scripts/run_standalone_server.py ./scripts/run_standalone_server.py
COPY frontend/pages ./frontend/pages
COPY frontend/standalone_preview.html ./frontend/standalone_preview.html
COPY --from=frontend /build/dist ./frontend/dist

RUN useradd --uid 1000 --create-home patchgraph && mkdir /data && chown patchgraph /data
USER patchgraph
VOLUME /data
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3)"

CMD ["python", "scripts/run_standalone_server.py"]
