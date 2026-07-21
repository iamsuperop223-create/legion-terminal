# Legion Terminal

Full-stack trading journal platform. Built with React, TypeScript, Node.js, PostgreSQL, Prisma, TailwindCSS, and Socket.IO.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Zustand, Recharts, Socket.IO Client
- **Backend**: Node.js, Express, Prisma ORM, JWT Auth, Socket.IO, Zod validation
- **Database**: PostgreSQL (works with Neon, Supabase, Railway, or any Postgres)
- **Deployment**: Docker, Vercel (frontend), Railway/Render/Fly.io (backend), Neon/Supabase (DB)

## Features

- Multi-account support (Eval/Funded/Sim types)
- Trade logging with custom attributes (order-flow, psychology, checklist)
- Rules engine (max contracts, stop range, daily loss limit, breakeven, custom)
- Dashboard with risk gauge, equity curve, P&L stats
- Calendar view with daily P&L heatmap
- Statistics with grouped analytics by any attribute
- Journal entries with mood tracking
- Real-time sync via WebSocket
- Export to CSV/JSON, full backup/restore
- Authentication (email/password, Google OAuth, forgot password)
- Responsive design (desktop, tablet, phone)

## Quick Start

```bash
# 1. Start database
docker-compose up -d postgres redis

# 2. Set up backend
cd server
cp ../.env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
npm install
npx prisma generate
npx prisma db push
npm run dev

# 3. Set up frontend (new terminal)
cd client
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001

## Deploy to Production

### Option A: Vercel + Railway + Neon (recommended)

1. Create a Neon database at https://neon.tech
2. Push to GitHub
3. Deploy backend to Railway:
   - Connect GitHub repo
   - Set root directory to `server`
   - Add environment variables from `.env.example`
4. Deploy frontend to Vercel:
   - Connect GitHub repo
   - Set root directory to `client`
   - Add `VITE_API_URL` pointing to your Railway URL
5. Set `CORS_ORIGIN` and `APP_URL` to your Vercel URL

### Option B: Docker (self-hosted)

```bash
docker-compose up -d
```

### Option C: Fly.io

```bash
fly launch
fly deploy
```

## Environment Variables

See `.env.example` for all required variables.

## Project Structure

```
legion-terminal/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── stores/       # Zustand state management
│   │   ├── lib/          # API client, helpers
│   │   └── types/        # TypeScript types
│   └── package.json
├── server/          # Node.js backend
│   ├── src/
│   │   ├── routes/       # Express API routes
│   │   └── middleware/    # Auth, rate limiting
│   └── package.json
├── prisma/          # Database schema
├── docker-compose.yml
└── .env.example
```
