FROM oven/bun:1 AS base
WORKDIR /app

# Install all deps (including devDeps for vite build)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build frontend
COPY web ./web
COPY tsconfig.json ./
RUN bun run build:web

# Re-install production only
RUN rm -rf node_modules
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY SKILL.md llms.txt ./

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
