FROM node:24-bookworm-slim AS build

WORKDIR /app
ENV NODE_ENV=development

COPY package*.json tsconfig.json ./
RUN npm ci

COPY drizzle ./drizzle
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends procps \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist ./dist

CMD ["node", "dist/actor/encuentra24.js"]
