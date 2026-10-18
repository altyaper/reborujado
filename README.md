# Reborujado

A two-player reverse-audio imitation game.

1. Player 1 records up to 10 seconds.
2. The server reverses the audio and plays it.
3. Player 2 imitates the reversed sound and records their attempt.
4. The server reverses that attempt so both players can hear how close it is to the original.

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:8080 (or http://YOUR-LAN-IP:8080 from another device). For microphone access on a different device, browsers generally require HTTPS or localhost. Use an HTTPS reverse proxy for remote access.

## Development

```bash
cd server && npm install && npm run dev
# separate terminal
cd client && npm install && npm run dev
```

The Vite development server proxies /api to localhost:3001.

## Architecture

React + Vite frontend, Node.js/Express backend. Recordings are captured as browser audio, decoded server-side with FFmpeg, reversed using FFmpeg's `areverse` filter, and returned as WAV. No recordings are stored. Upload limit: 12 MB; maximum processed duration: 10 seconds. No authentication; intended for personal/local play.
