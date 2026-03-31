## MK Tech - 3 Tier Application

**Layers**
- **Frontend**: React app in `frontend` (runs on port `3000` in dev, served from Nginx on port `8080` via Docker).
- **Backend**: Node.js / Express API in `backend` (runs on port **`3000`**).
- **Database**: PostgreSQL.

The backend connects to PostgreSQL on startup and will automatically create a default admin user:
- **username**: `admin`
- **password**: `admin`

---

## Backend details

- **Port**: `3000` (configurable via `PORT` env var).
- **Base URL**: `http://localhost:3000/api` (when running locally or with Docker on the host).
- **CORS**: fully open (`app.use(cors())`) – no origin restrictions.

**Health / status endpoints**
- `GET /api/health` → `{ "status": "ok", "service": "mk-tech-backend" }`
- `GET /api/status` → `{ "success": true, "message": "Backend is running" }`

On startup, the backend:
1. Tries to connect to the configured PostgreSQL database.
2. Runs migrations/DDL to ensure required tables exist.
3. Checks for a user with username `admin`.
4. If not found, creates an admin with username `admin` and password `admin`.

---

## Environment configuration

### Backend (`backend/.env`)

Copy the example file:

```bash
cd backend
cp .env.example .env
```

Key variables (you can override as needed):

- `PORT=3000`
- `CLIENT_URL=http://localhost:3000`
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/mk_tech`
- `PGHOST=localhost`
- `PGPORT=5432`
- `PGDATABASE=mk_tech`
- `PGUSER=postgres`
- `PGPASSWORD=postgres`

For Docker, these are supplied by `docker-compose.yml` – normally you’ll only change **database details** there (host/user/password/db name).

### Frontend (`frontend/.env`)

If needed, create `frontend/.env` to override the API URL:

```bash
cd frontend
cp .env.example .env   # if present
```

Example:

```bash
REACT_APP_API_URL=http://localhost:3000/api
```

---

## Manual deployment / local development

### 1. Start PostgreSQL manually

Run a local PostgreSQL instance with a database `mk_tech` and user `postgres/postgres`, or adjust `backend/.env` to match your setup.

### 2. Start the backend (port 3000)

```bash
cd backend
npm install
npm start
```

The backend will:
- Listen on `http://localhost:3000`.
- Connect to PostgreSQL using the env vars.
- Create the default admin (`admin` / `admin`) if it does not exist.

Verify it is up:

```bash
curl http://localhost:3000/api/status
curl http://localhost:3000/api/health
```

Both should return a JSON success response.

### 3. Start the frontend (dev mode)

```bash
cd frontend
npm install
npm start
```

The React dev server runs on `http://localhost:3000` by default.  
If you are running the backend on the same port, ensure the frontend is configured to call `REACT_APP_API_URL=http://localhost:3000/api` and that you don’t run two dev servers on port 3000 simultaneously. For a clean separation during manual dev you can:
- run backend on `PORT=4000` (by temporarily changing `.env`) and
- set `REACT_APP_API_URL=http://localhost:4000/api`.

---

## Docker deployment

This repository contains:
- `frontend/Dockerfile` – builds the React app and serves it via Nginx.
- `backend/Dockerfile` – runs the Node.js/Express backend on port `3000`.
- Root-level `docker-compose.yml` – orchestrates **frontend**, **backend**, and **PostgreSQL** on a shared Docker network.

### Build and run with Docker Compose

From the project root (`d:\mk-tech`):

```bash
docker compose up --build
```

This will start:

- **db** (PostgreSQL)
  - Image: `postgres:16`
  - Hostname inside the network: `db`
  - Database: `mk_tech`
  - User/password: `postgres` / `postgres`

- **backend**
  - Built from `backend/Dockerfile`
  - Exposed on host: `http://localhost:3000`
  - Environment:
    - `PORT=3000`
    - `DATABASE_URL=postgres://postgres:postgres@db:5432/mk_tech`
  - On start, connects to `db`, ensures schema, and creates `admin/admin` user if missing.

- **frontend**
  - Built from `frontend/Dockerfile`
  - Served by Nginx on container port `80`
  - Exposed on host: `http://localhost:8080`
  - Uses `REACT_APP_API_URL=http://localhost:3000/api` to talk to the backend.

All services share the `mk-tech-net` Docker network defined in `docker-compose.yml`.

### Verify Docker deployment

- Frontend: open `http://localhost:8080` in a browser.
- Backend status:

```bash
curl http://localhost:3000/api/status
curl http://localhost:3000/api/health
```

### Stopping the stack

From the project root:

```bash
docker compose down
```

This stops containers but preserves the PostgreSQL data volume (`mk-tech-postgres-data`) unless you add `-v`.

---

## Notes

- **CORS** is fully open on the backend, so any origin can call the API.
- On **every backend start**, the application attempts a database connection; if it cannot connect, it exits with an error.
- Admin user seeding is **idempotent**: it only creates the `admin/admin` account if it doesn’t already exist.
