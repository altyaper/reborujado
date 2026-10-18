FROM node:22-alpine AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=build /app/client/dist ./public
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
CMD ["node","index.js"]
