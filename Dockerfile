# Build stage
FROM --platform=linux/amd64 node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Define build arguments for environment variables
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG DATABASE_URL
ARG NEXT_PUBLIC_TWITCH_CLIENT_ID
ARG TWITCH_CLIENT_SECRET
ARG DISCORD_WEBHOOK_URL
ARG NOTIFICATION_EMAIL

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_PUBLIC_TWITCH_CLIENT_ID=${NEXT_PUBLIC_TWITCH_CLIENT_ID}
ENV TWITCH_CLIENT_SECRET=${TWITCH_CLIENT_SECRET}
ENV DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
ENV NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL}
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Production stage
FROM --platform=linux/amd64 node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"] 