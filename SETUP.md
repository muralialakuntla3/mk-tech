# MK Tech - 3 Tier Application Setup

## Architecture

- **Presentation layer:** `frontend/` (React)
- **Application layer:** `backend/` (Node.js / Express, targeted for Node 24)
- **Data layer:** PostgreSQL

## Features Delivered

- default admin auto-created on first successful DB connection
  - username: `admin`
  - password: `admin`
- admin can create courses
- admin can add video links inside courses
- admin can create learners and register them to courses
- learners can log in and watch only their assigned course videos

## Backend Setup

1. Open `backend/.env.example`
2. Copy it to `.env`
3. Make sure PostgreSQL is running and accessible on your machine
4. Run:

```bash
cd backend
npm install
npm start
```

The backend API runs at `http://localhost:3000/api`.

## Frontend Setup

1. Open `frontend/.env.example`
2. Copy it to `.env` if you want to override the API URL
3. Run:

```bash
cd frontend
npm install
npm start
```

The frontend runs at `http://localhost:3000`.

## Verification Evidence

Frontend verification command:

```bash
cd frontend
npx jest --runInBand --ci --forceExit --silent
```

Verified result:
- **3/3 test suites passed**
- **5/5 tests passed**

## Environment Note

This workspace currently has **Node `v20.19.1`** installed. The code and package configuration were updated to target **Node 24**, so upgrading the local runtime to Node 24 is recommended before deployment.
