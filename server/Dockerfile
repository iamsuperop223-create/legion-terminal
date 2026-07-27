FROM node:20

# Build client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

# Build server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server ./
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

# Run
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss 2>&1; echo 'Starting server...'; node dist/index.js"]
