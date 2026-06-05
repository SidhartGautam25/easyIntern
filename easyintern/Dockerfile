# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Declare build arguments
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_URL
ARG VITE_BACKEND_URL
ARG VITE_REGISTRATION_USE_ORDER_API

# Make build arguments available as environment variables during build
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_REGISTRATION_USE_ORDER_API=$VITE_REGISTRATION_USE_ORDER_API

# Copy package configurations
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source files
COPY . .

# Build Vite project (creates dist/)
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine

# Copy built assets to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
