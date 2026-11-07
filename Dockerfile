# IHH Virtual Museum: one container that builds the React frontend and serves it from the FastAPI backend.
# Build:  docker build -t ihh-museum .
# Run:    docker run -p 8010:8010 -e OPENAI_API_KEY=... ihh-museum

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8010
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist
# Visitor stories, accounts and the image cache are written here; mount a volume to keep them across deploys.
RUN mkdir -p backend/data/community backend/data/cache backend/data/audio
WORKDIR /app/backend
EXPOSE 8010
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
