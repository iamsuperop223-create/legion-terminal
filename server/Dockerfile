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
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY --from=client-builder /app/client/dist ./client/dist
WORKDIR /app/server

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
