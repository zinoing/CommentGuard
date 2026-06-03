FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY services/collector-service/ ./services/collector-service/
RUN pnpm install --filter @commentguard/collector-service...

FROM deps AS build
RUN pnpm --filter @commentguard/collector-service build

FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/collector-service/dist ./services/collector-service/dist
COPY --from=build /app/services/collector-service/node_modules ./services/collector-service/node_modules
EXPOSE 3002
CMD ["node", "services/collector-service/dist/index.js"]
