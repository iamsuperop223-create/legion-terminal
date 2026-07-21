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

FROM node:20-alpine AS runner
WORKDIR /app/server
RUN apk add --no-cache openssl3 libstdc++ libc6-compat
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/package.json ./
COPY --from=server-builder /app/server/prisma ./prisma
COPY --from=client-builder /app/client/dist ../client/dist
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "echo 'Running prisma db push...' && npx prisma db push --skip-generate && echo 'Starting server...' && node dist/index.js"]
