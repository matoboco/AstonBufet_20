FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and migrations
COPY src ./src
COPY db ./db
COPY tsconfig.json ./
COPY scripts ./scripts

# Build TypeScript and copy migrations to dist
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
