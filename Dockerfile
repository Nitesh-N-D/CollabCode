FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
COPY packages/extension/package.json packages/extension/package.json
COPY packages/sim/package.json packages/sim/package.json
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS server
RUN pnpm --filter @collabcode/shared build && pnpm --filter @collabcode/server build
EXPOSE 4000
CMD ["pnpm", "--filter", "@collabcode/server", "start"]

FROM base AS dashboard
ARG VITE_SERVER_URL=http://localhost:4000
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN pnpm --filter @collabcode/shared build && pnpm --filter @collabcode/dashboard build
EXPOSE 5173
CMD ["pnpm", "--filter", "@collabcode/dashboard", "preview"]
