FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY newrelic.js ./

RUN chown -R app:app /app

USER app

EXPOSE 3002

CMD ["node", "-r", "newrelic", "dist/server.js"]
