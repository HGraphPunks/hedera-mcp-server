# Dockerfile for Hedera MCP Server
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package definition and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN npm run build   # assumes a build script that tsc compiles to dist/

# Use a smaller runtime image
FROM node:18-alpine AS runtime
WORKDIR /app

# Copy only the necessary runtime files (compiled JS and node_modules)
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Expose ports (REST API and SSE)
EXPOSE 3000 3001

# Default command to run the server
CMD ["node", "dist/index.js"]
