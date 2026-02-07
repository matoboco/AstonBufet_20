FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code and migrations
COPY src ./src
COPY db ./db
COPY tsconfig.json ./
COPY scripts ./scripts

# Save build time to file
RUN date -u +%Y-%m-%dT%H:%M:%SZ > /app/build-time.txt

# Expose port
EXPOSE 3001

# Start server
CMD ["bun", "run", "src/index.ts"]
