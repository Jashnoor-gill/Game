FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY . .
RUN npm ci && npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
RUN npm ci --production

EXPOSE 3000
EXPOSE 3001

CMD ["sh", "-c", "npm run start:prod"]
