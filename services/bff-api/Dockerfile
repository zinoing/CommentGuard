FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY services/bff-api/ services/bff-api/
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @commentguard/db db:generate
RUN pnpm --filter @commentguard/db build
RUN pnpm --filter @commentguard/bff-api build

EXPOSE 3001
CMD ["node", "services/bff-api/dist/index.js"]
