FROM node:20

# Build client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
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
CMD ["node", "dist/index.js"]
