# AutoSchedule Backend

Self-hosted Node.js + TypeScript backend for the AutoSchedule calendar app. Zero platform lock-in.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express
- **Database:** PostgreSQL 16
- **ORM:** Prisma
- **Auth:** JWT (access + refresh tokens with rotation)
- **Validation:** Zod
- **Container:** Docker + Docker Compose

## Architecture

```
backend/
├── prisma/schema.prisma      # Database models
├── src/
│   ├── server.ts              # Entry point
│   ├── app.ts                 # Express app setup
│   ├── routes/                # Route definitions
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   ├── middleware/             # Auth + validation
│   ├── lib/                   # Prisma client + JWT utils
│   └── utils/                 # Zod schemas
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API Routes

| Method | Path                    | Auth | Description                      |
|--------|-------------------------|------|----------------------------------|
| POST   | /auth/signup            | No   | Create account                   |
| POST   | /auth/login             | No   | Login, get tokens                |
| POST   | /auth/refresh           | No   | Rotate refresh token             |
| POST   | /auth/logout            | No   | Revoke refresh token             |
| GET    | /me                     | Yes  | Get current user                 |
| GET    | /tasks                  | Yes  | List tasks                       |
| GET    | /tasks/:id              | Yes  | Get task                         |
| POST   | /tasks                  | Yes  | Create task                      |
| PATCH  | /tasks/:id              | Yes  | Update task                      |
| DELETE | /tasks/:id              | Yes  | Delete task                      |
| GET    | /blocks?from=&to=       | Yes  | List scheduled blocks            |
| POST   | /blocks                 | Yes  | Create block (with overlap check)|
| PATCH  | /blocks/:id             | Yes  | Update block                     |
| DELETE | /blocks/:id             | Yes  | Delete block                     |
| GET    | /anchors                | Yes  | List recurring anchor rules      |
| GET    | /anchors/:id            | Yes  | Get anchor rule                  |
| POST   | /anchors                | Yes  | Create anchor rule               |
| PATCH  | /anchors/:id            | Yes  | Update anchor rule               |
| DELETE | /anchors/:id            | Yes  | Delete anchor rule               |
| GET    | /settings               | Yes  | Get user settings                |
| PATCH  | /settings               | Yes  | Update user settings             |
| POST   | /scheduler/generate     | Yes  | Generate schedule (TODO)         |
| POST   | /scheduler/recalculate  | Yes  | Recalculate schedule (TODO)      |

## Local Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database URL and JWT secrets

npm install
npx prisma migrate dev --name init
npm run dev
```

## Docker Setup

```bash
cd backend
docker-compose up -d
# API at http://localhost:4000
# Postgres at localhost:5432
```

## Prisma Commands

```bash
npx prisma migrate dev     # Create + apply migration
npx prisma db push         # Push schema without migration
npx prisma studio          # Visual database editor
npx prisma generate        # Regenerate client
```

## Environment Variables

| Variable            | Description                        | Default                    |
|---------------------|------------------------------------|----------------------------|
| DATABASE_URL        | PostgreSQL connection string       | (required)                 |
| JWT_ACCESS_SECRET   | Secret for access tokens           | (required in production)   |
| JWT_REFRESH_SECRET  | Secret for refresh tokens          | (required in production)   |
| PORT                | Server port                        | 4000                       |
| FRONTEND_URL        | CORS origin for frontend           | http://localhost:5173       |

## Frontend Connection

The frontend should set `API_BASE_URL` to point to the backend (default `http://localhost:4000`). An API client scaffold is provided at `src/lib/api-client.ts` in the frontend.

### Migration from localStorage

1. Start the backend and run migrations
2. Create a user account via POST /auth/signup
3. Export localStorage data using browser console
4. POST each task/block/setting to the corresponding API endpoint
5. Switch frontend to use API client instead of localStorage

## What's Implemented vs Scaffold

| Component               | Status              |
|--------------------------|---------------------|
| Prisma schema            | ✅ Complete         |
| Auth (signup/login/refresh/logout) | ✅ Complete |
| Task CRUD                | ✅ Complete         |
| Block CRUD + overlap     | ✅ Complete         |
| Anchor CRUD              | ✅ Complete         |
| Settings CRUD            | ✅ Complete         |
| Conflict detection       | ✅ Complete         |
| Zod validation           | ✅ Complete         |
| JWT + refresh rotation   | ✅ Complete         |
| Docker setup             | ✅ Complete         |
| Scheduler engine         | 🔲 Stub only       |
| Rate limiting            | 🔲 Not yet          |
| Email verification       | 🔲 Not yet          |
| Password reset           | 🔲 Not yet          |
| Test suite               | 🔲 Not yet          |

The scheduler engine (`/scheduler/generate` and `/scheduler/recalculate`) returns a placeholder response. Port the logic from `src/engine/scheduler.ts` in the frontend to `backend/src/services/scheduler.service.ts`.
