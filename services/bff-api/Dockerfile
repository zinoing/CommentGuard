FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY services/bff-api/ ./services/bff-api/
RUN pnpm install --filter @commentguard/bff-api...

FROM deps AS build
RUN pnpm --filter @commentguard/bff-api build

FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/bff-api/dist ./services/bff-api/dist
COPY --from=build /app/services/bff-api/node_modules ./services/bff-api/node_modules
EXPOSE 3001
CMD ["node", "services/bff-api/dist/index.js"]
