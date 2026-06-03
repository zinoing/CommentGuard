FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY services/action-service/ ./services/action-service/
RUN pnpm install --filter @commentguard/action-service...

FROM deps AS build
RUN pnpm --filter @commentguard/action-service build

FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/action-service/dist ./services/action-service/dist
COPY --from=build /app/services/action-service/node_modules ./services/action-service/node_modules
EXPOSE 3004
CMD ["node", "services/action-service/dist/index.js"]
