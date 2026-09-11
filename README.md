# SkillLink

SkillLink is a peer micro-tutoring platform that helps students quickly find, book, and chat with peer tutors for short, focused sessions. Built as a polished, demo-ready hackathon project, SkillLink demonstrates a full-stack implementation (backend API, realtime chat, static frontend) with production-minded defaults.

---
<img width="1325" height="632" alt="Capture" src="https://github.com/user-attachments/assets/d0604d51-3ea3-457a-8dfe-9e45fbb8fdcc" />

## Table of contents
- Intro
- Problem
- Solution
- Tech stack
- Key results & features
- Who can use this
- Prerequisites
- Run locally (quickstart)
- Detailed run & dev workflow
- Project structure
- Production notes & next steps
- Troubleshooting

---

## Intro
SkillLink connects learners and peer tutors for short "micro-sessions" (30–60 minutes). It focuses on fast discovery, lightweight booking, secure auth, and realtime chat so students can get help when they need it.

---

## Problem
Many students need fast, affordable help on specific problems or concepts. Traditional tutoring can be slow to schedule, expensive, or heavy for small needs. There is no simple, community-first way to browse peers, book short sessions, and chat during the session while keeping the experience polished and secure.

---

## How SkillLink solves it
- Students and tutors sign up quickly with email/password.
- Tutors create short, discoverable skill offers (title, tags, duration, price).
- Learners search and filter skills; book 30–60 minute sessions.
- Realtime chat (Socket.IO) in bookings for coordination and lesson delivery.
- Ratings/reviews after sessions to help quality discovery.
- Lightweight admin metrics for judging and evaluation.

---

## Tech stack
- Backend: Node.js + Express + TypeScript
- ORM: Prisma (Postgres)
- Database: PostgreSQL
- Realtime: Socket.IO (Redis adapter optional for scaling)
- Static frontend: plain HTML, vanilla JS, CSS (served via Nginx)
- Containerization: Docker & Docker Compose
- Auth: JWT access tokens + rotating refresh tokens (secure hashed storage)
- Validation: zod
- Logging: morgan
- Security: helmet, compression
- Testing tooling (dev): Vitest + Supertest
- Recommended infra for production: managed Postgres, Redis, k8s or cloud container service

---

## Key results & features
- End-to-end TypeScript backend with Prisma models for Users, Skills, Bookings, Messages, Reviews, RefreshTokens
- Secure auth flow: signup, login, access tokens, refresh token rotation, logout
- Skill creation, search (text + tag), pagination
- Booking creation with overlap/conflict detection, status updates, participant access control
- Realtime booking chat with server-side message persistence
- Simple admin endpoint for quick stats
- Static frontend (no heavy frameworks) that is responsive and demo-ready
- Docker Compose to run everything locally (Postgres, Redis, backend, frontend)

---

## Who can use this
- Hackathon teams looking for a polished, demoable project
- Students or small teams building tutoring/mentorship marketplaces
- Educators and community organizers setting up peer-help platforms
- Developers looking for a full-stack example combining auth, realtime chat, and a relational data model

---

## Prerequisites
- Docker & Docker Compose (recommended for local demo)
- Node.js >= 18 (for local backend dev / running scripts)
- npm (or Yarn) for installing backend dev dependencies
- git (optional: to clone repository)

Files you should see in the repo:
- backend/ (server code, Prisma schema) 
- frontend/ (static site, assets, nginx config)
- docker-compose.yml
- README.md

---

## Run locally — Quickstart (recommended)
1. Copy the example env for backend:
   - cp backend/.env.example backend/.env
   - Edit backend/.env if needed (for production set stronger JWT_SECRET)

2. Build and start services:
   - docker-compose up --build

3. Initialize database and seed sample data:
   - In a new terminal:
     - cd backend
     - npm ci
     - npx prisma generate
     - npx prisma migrate dev --name init
     - npm run prisma:seed

4. Open the application:
   - Frontend UI: http://localhost
   - Backend API: http://localhost:4000/api
   - Health: http://localhost:4000/health

Seeded accounts (for demo)
- alice@example.com / password123 (tutor)
- bob@example.com / password123 (learner)

---

## Run locally — Detailed developer workflow

Backend development
1. Install deps:
   - cd backend
   - npm ci

2. Create .env (copy .env.example) and set:
   - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/skilllink
   - REDIS_URL=redis://redis:6379
   - JWT_SECRET=your-secret
   - PORT=4000

3. Run development server:
   - npm run dev
   Backend will be available at http://localhost:4000

4. Generate Prisma client and run migrations:
   - npx prisma generate
   - npx prisma migrate dev --name init
   - npm run prisma:seed

Frontend development (static)
- Files are under frontend/:
  - index.html
  - assets/styles.css
  - assets/app.js
- The frontend is served by Nginx in Docker Compose at http://localhost
- For quick changes, edit assets and rebuild frontend container or serve files locally with any static server.

Docker Compose (single command)
- docker-compose up --build
  - This starts Postgres, Redis, backend, and frontend (Nginx serving static assets).
  - Backend binds to port 4000; frontend is served at port 80.

---

## Project structure
(important files / directories)

- backend/
  - package.json, tsconfig.json, Dockerfile
  - src/
    - index.ts — server bootstrap + socket dynamic init
    - app.ts — Express app factory
    - socket.ts — Socket.IO init (auth + rooms)
    - middleware/
      - auth.ts — access token middleware
      - errorHandler.ts
      - rateLimiter.ts
    - routes/
      - auth.ts — signup, login, refresh, logout
      - users.ts — profile
      - skills.ts — create, list, detail, reviews
      - bookings.ts — booking creation, status updates
      - admin.ts — stats
    - services/
      - tokenService.ts — secure refresh token handling
    - utils/
      - jwt.ts — sign/verify
    - validators/ — zod schemas
  - prisma/
    - schema.prisma
    - seed.ts
- frontend/
  - index.html
  - assets/
    - styles.css
    - app.js
  - nginx.conf
  - Dockerfile
- docker-compose.yml
- README.md

---

## Production notes & next steps (recommended)
- Use managed Postgres (e.g., Cloud SQL, RDS) and managed Redis.
- Configure HTTPS + strong secrets (rotate JWT_SECRET).
- Replace in-memory rate limiter with Redis-backed limiter for horizontal scaling.
- Add email verification (SendGrid / SES) and password reset flows.
- Add payments / credits (Stripe) or an exchange economy (credits).
- Add CI steps to run migrations and tests, and automate deploy to cloud provider.
- Add end-to-end tests for auth → create skill → book → chat flows.

---

## Troubleshooting
- Backend fails to connect to Postgres:
  - Ensure docker-compose started `postgres` and that `DATABASE_URL` points at the `postgres` service.
- Socket.IO connection errors:
  - Check that frontend proxies /socket.io to backend (Nginx config) and that backend server has socket.ts initialized.
- Migration errors:
  - Delete local dev migration state if needed (careful: this removes DB changes) and re-run `prisma migrate dev`.
- If tokens appear invalid after editing JWT_SECRET:
  - Clear localStorage tokens and re-login.

---
