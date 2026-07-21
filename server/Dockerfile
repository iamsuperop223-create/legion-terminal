FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
COPY server/prisma ./prisma/
RUN npm ci
COPY server ./
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

FROM node:20 AS runner
WORKDIR /app/server
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/package.json ./
COPY --from=server-builder /app/server/prisma ./prisma
COPY --from=client-builder /app/client/dist ../client/dist
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
