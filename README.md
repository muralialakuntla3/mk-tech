## MK Tech - Learning Platform (3-tier)

**Layers**
- **Frontend**: React app in `frontend` (runs on port `3000` in dev, served from Nginx on port `8080` via Docker).
- **Backend**: Node.js / Express API in `backend`.
- **Database**: PostgreSQL.

The backend connects to PostgreSQL on startup and will automatically ensure schema exists (tables + constraints) and can seed a **master admin** if configured via environment.

---

## Roles & permissions

The system supports 3 roles:

- **Admin** (`admin`)
  - Full access to Admin Console.
  - Can create/update/delete **Admin**, **Manager**, and **Learner** accounts (except the configured master admin cannot be edited/deleted).
  - Can manage courses, modules, videos, enrollments, and course documents.
- **Manager** (`manager`)
  - Access to Admin Console.
  - Can manage courses, modules, videos, enrollments, and course documents.
  - **Cannot** create/update/delete Admin/Manager users.
  - Can create/update/delete **Learners** only.
- **Learner** (`user`)
  - Access to Learner Console only.
  - Can view assigned courses, watch videos, and read course documents in-app.

---

## Frontend (React)

### Run locally

```bash
cd frontend
npm install
npm start
```

### Environment

Create `frontend/.env` (optional):

```bash
REACT_APP_API_URL=http://localhost:3000/api
```

If `REACT_APP_API_URL` is not set, the app defaults to `http://localhost:5000`.

### UI notes (features)

- **Full-width layout**: the admin/learner consoles use full page width (no empty borders).
- **Theme toggle**: icon appears beside the username in the top right.
- **Dark theme readability**: card content stays readable (white-card surfaces keep black text).
- **Course Admin page** (Admin/Manager console):
  - Tabs: **Overview** (incl. documents), **Videos** (modules + videos), **Enrolled** (add/remove learners).
  - Tables for modules/videos with edit ✏️ and delete 🗑️ actions.
  - Documents support **upload** and **link**; documents open **inside the portal** via a compact preview modal.
- **Learner course page**:
  - Documents are shown and open **inside the portal** via preview modal.
- **Google Drive video links**:
  - Drive share links are converted to embeddable preview links (`/preview`) to reduce “login required” issues for public files.

---

## Backend (Node/Express)

- **Port**: `3000` (configurable via `PORT` env var).
- **Base URL**: `http://localhost:3000/api` (when running locally or with Docker on the host).
- **CORS**: fully open (`app.use(cors())`) – no origin restrictions.

**Health / status endpoints**
- `GET /api/health` → `{ "status": "ok", "service": "mk-tech-backend" }`
- `GET /api/status` → `{ "success": true, "message": "Backend is running" }`

On startup, the backend:
1. Connects to the configured PostgreSQL database.
2. Runs migrations/DDL to ensure required tables exist (including role constraints and course documents).
3. Optionally seeds a master admin if `MASTER_ADMIN_USERNAME` and `MASTER_ADMIN_PASSWORD` are set.

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

### Master admin (optional)

Set these (Docker env or `backend/.env`) to create a non-editable master admin:

- `MASTER_ADMIN_USERNAME=admin`
- `MASTER_ADMIN_PASSWORD=admin`
- `MASTER_ADMIN_EMAIL=admin@example.com` (optional)

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
- Ensure schema exists and seed master admin if configured.

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
If you are running the backend on `PORT=3000` you must run the frontend on a different port (or vice versa). Common options:

- Keep backend on **3000** and run frontend on **3001** (set `PORT=3001` in the frontend shell), or
- Run backend on **5000** and keep frontend on **3000**.

Make sure `REACT_APP_API_URL` points to the backend’s base URL (example: `http://localhost:3000/api`).

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
  - On start, connects to `db` and ensures schema (and seeds master admin if configured).

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

---

## Key API routes (high-level)

All routes are under `/api`.

### Auth

- `POST /auth/login` (identifier can be username or email)
- `GET /auth/me`
- `PUT /auth/me`
- `PUT /auth/me/password`

### Admin/Manager

- `GET /admin/dashboard` (lightweight: courses + users summary)
- `GET /admin/learners?role=user|admin|manager&search=&page=&pageSize=10|20|50` (server pagination)
- Courses
  - `POST /admin/courses`
  - `PUT /admin/courses/:courseId`
  - `DELETE /admin/courses/:courseId`
  - `GET /admin/courses/:courseId/videos`
  - `POST /admin/courses/:courseId/videos`
  - `PUT /admin/courses/:courseId/videos/:videoId`
  - `DELETE /admin/courses/:courseId/videos/:videoId`
- Modules
  - `GET /admin/courses/:courseId/modules` (includes nested videos per module)
  - `POST /admin/courses/:courseId/modules`
  - `PUT /admin/courses/:courseId/modules/:moduleId`
  - `DELETE /admin/courses/:courseId/modules/:moduleId`
- Enrollments
  - `GET /admin/courses/:courseId/learners`
  - `POST /admin/courses/:courseId/learners` (supports `learnerIds` and/or `learnerEmails`)
  - `DELETE /admin/courses/:courseId/learners/:learnerId`
- Documents
  - `GET /admin/courses/:courseId/documents`
  - `POST /admin/courses/:courseId/documents` (supports upload-as-data-url or link)
  - `DELETE /admin/courses/:courseId/documents/:documentId`

### Learner

- `GET /user/courses` (includes modules/videos and `documents`; documents are readable in-app)
