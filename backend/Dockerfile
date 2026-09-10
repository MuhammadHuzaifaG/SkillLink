# Multi-stage build for a compact, secure production image
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN apk add --no-cache git python3 make g++ \
 && npm ci --production=false
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Create non-root user
RUN addgroup -S app && adduser -S -G app app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Minimal environment vars for runtime safety
ENV PORT=4000
EXPOSE ${PORT}
USER app
CMD ["node", "dist/index.js"]