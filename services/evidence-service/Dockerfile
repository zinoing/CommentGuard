FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY services/evidence-service/ ./services/evidence-service/
RUN pnpm install --filter @commentguard/evidence-service...

FROM deps AS build
RUN pnpm --filter @commentguard/evidence-service build

FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/evidence-service/dist ./services/evidence-service/dist
COPY --from=build /app/services/evidence-service/node_modules ./services/evidence-service/node_modules
EXPOSE 3003
CMD ["node", "services/evidence-service/dist/index.js"]
