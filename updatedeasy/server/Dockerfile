# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies to compile TS)
RUN npm ci

# Copy source code
COPY src ./src

# Compile TypeScript to JavaScript (creates dist/)
RUN npm run build

# --- Production Stage ---
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Copy package metadata
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Expose server port
EXPOSE 5000

# Start Koa server
CMD ["npm", "start"]
