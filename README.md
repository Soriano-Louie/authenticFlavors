# authenticFlavors
Capstone project

## Auth Implementation

This project now includes:
- Frontend authentication flow (login + create account)
- Express backend under `backend/` connected to MySQL
- JWT access token + httpOnly refresh token cookie session flow

## Project Structure

- `src/` - Vite React frontend
- `backend/` - Express auth API

## Local Setup

1. Frontend environment
	- Copy `.env.example` to `.env`
	- Set `VITE_API_BASE_URL` (default: `http://localhost:4000`)

2. Backend environment
	- Copy `backend/.env.example` to `backend/.env`
	- Fill Aiven MySQL credentials and JWT secrets
	- Ensure `DB_NAME=authenticFlavors`

3. Install dependencies
```bash
npm install
npm --prefix backend install
```

4. Run services in separate terminals
```bash
npm run dev:frontend
npm run dev:backend
```

## Auth API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## Render Deployment Notes (Backend)

- Build command: `npm install`
- Start command: `npm start`
- Root directory: `backend`
- Required env vars:
  - `PORT`
  - `NODE_ENV`
  - `CORS_ORIGIN`
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`

When frontend and backend are on different domains, keep `NODE_ENV=production` so refresh cookie uses secure settings.
