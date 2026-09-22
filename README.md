<div align="center">

# 🔮 ETL Predict AI

### AI-Powered ETL Job Failure Prediction & Auto-Recovery System

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

A full-stack observability platform that monitors ETL pipelines in real time, predicts failures before they happen using a weighted AI scoring engine, and automatically recovers failed jobs — all from a single dark-themed dashboard.

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Login Credentials](#login-credentials)

---

## Overview

ETL Predict AI solves a common data-engineering problem: ETL pipelines fail silently, and by the time an engineer notices, downstream systems are already broken. This platform provides:

- **Real-time visibility** — every job's status, resource usage, and logs in one place
- **Proactive AI scoring** — a weighted multi-factor engine scores each job's failure risk (0–99) before it finishes, using CPU, memory, retry history, execution time, and data volume
- **Automatic recovery** — failed jobs are retried up to 3 times with exponential back-off, with full history tracked per job
- **Root cause analysis** — 7-category classifier (connection, timeout, memory, schema, network, permissions, missing file) pinpoints why a job failed
- **Email alerts** — Nodemailer sends styled HTML notifications on job failure or high AI risk score
- **ETL Log Viewer** — searchable, filterable log stream across all jobs with a detail panel

The backend can temporarily fall back to an in-memory store when MongoDB is unavailable, but MongoDB is required for production deployment.

---

## Features

| Area | Capability |
|---|---|
| **Dashboard** | Live stat cards, 7-day trend chart, status donut, failure reasons bar, activity feed (polls every 5 s) |
| **ETL Jobs** | Paginated table with search, status filter, multi-column sort, 10 s auto-refresh |
| **Job Details** | Overview metrics, embedded log viewer, AI risk assessment tab, auto-retry button |
| **Log Viewer** | Cross-job log stream, filter by level (INFO / WARN / ERROR / DEBUG), job ID, message search, slide-in detail panel |
| **Live Monitoring** | Real-time CPU & memory sparklines, per-job resource gauges |
| **Analytics** | 13-metric aggregation — duration stats, retry distribution, CPU/memory buckets, source distribution, AI accuracy |
| **AI Prediction** | Pre-execution risk scoring, feature-contribution breakdown, at-risk job list, prediction history |
| **Root Cause Analysis** | 7-category classifier with confidence score, evidence signals, and targeted solutions |
| **Auto-Recovery** | Up to 3 retries with exponential back-off (4 s → 8 s → 16 s), full attempt history, fleet-wide stats |
| **Alerts** | In-app alert feed with read/unread state, type filter, email simulation endpoint |
| **Email Notifications** | Nodemailer — styled HTML emails on job failure and high AI risk score (configurable threshold) |
| **Reports** | CSV export of job data |
| **Auth** | JWT-based login, 24 h token, role-aware (admin / viewer) |

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool & dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Chart.js + react-chartjs-2 | 4 / 5 | Line, bar, donut charts |
| React Router DOM | 7 | Client-side routing |
| Axios | 1 | HTTP client with JWT interceptor |
| Lucide React | 1 | Icon set |
| react-hot-toast | 2 | Toast notifications |

### Backend
| Package | Version | Purpose |
|---|---|---|
| Express | 4 | HTTP server & routing |
| Mongoose | 8 | MongoDB ODM |
| jsonwebtoken | 9 | JWT auth |
| bcryptjs | 2 | Password hashing |
| Nodemailer | 6 | Email notifications |
| dotenv | 16 | Environment config |
| cors | 2 | Cross-origin requests |
| nodemon | 3 | Dev auto-restart |

### AI Service (optional)
| Package | Version | Purpose |
|---|---|---|
| Flask | 3 | REST API |
| scikit-learn | 1.3 | ML model |
| pandas | 2.1 | Data processing |
| numpy | 1.26 | Numerical ops |

### Database
- **MongoDB 6+** — primary store with full aggregation pipelines
- **In-memory fallback** — automatic when MongoDB is unavailable; no config needed

---

## Project Structure

```
etl/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                  # connectDB() + isConnected()
│   │   ├── controllers/
│   │   │   ├── authController.js      # JWT login
│   │   │   ├── jobController.js       # Full CRUD + retry
│   │   │   ├── analyticsController.js # 13-metric aggregation pipelines
│   │   │   ├── logController.js       # EtlLog collection + Job.logs fallback
│   │   │   ├── predictionController.js# Weighted AI scoring engine v2
│   │   │   ├── rcaController.js       # 7-category root cause classifier
│   │   │   ├── recoveryController.js  # Exponential back-off auto-recovery
│   │   │   └── alertController.js     # Alert feed + email simulation
│   │   ├── data/
│   │   │   ├── seedData.js            # Dev-only sample job generator
│   │   │   └── store.js               # In-memory store singleton
│   │   ├── middleware/
│   │   │   └── auth.js                # JWT verify middleware
│   │   ├── models/
│   │   │   ├── Job.js                 # Main schema with embedded logs
│   │   │   ├── EtlLog.js              # Dedicated log collection
│   │   │   ├── Prediction.js          # Prediction history
│   │   │   ├── Alert.js               # Alert documents
│   │   │   └── User.js                # User accounts
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── jobs.js
│   │   │   ├── logs.js
│   │   │   ├── analytics.js
│   │   │   ├── alerts.js
│   │   │   ├── predict.js
│   │   │   ├── rca.js
│   │   │   └── recovery.js
│   │   ├── utils/
│   │   │   ├── emailService.js        # Nodemailer — failure + high-risk emails
│   │   │   └── logService.js          # write() / writeBulk() to EtlLog
│   │   └── server.js                  # Express entry point
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── components/
│       │   ├── charts/
│       │   │   ├── FailureTrendChart.jsx
│       │   │   ├── FailureReasonsChart.jsx
│       │   │   └── StatusDonutChart.jsx
│       │   ├── layout/
│       │   │   ├── Layout.jsx
│       │   │   ├── Navbar.jsx
│       │   │   └── Sidebar.jsx
│       │   └── ui/
│       │       ├── StatCard.jsx
│       │       ├── StatusBadge.jsx
│       │       ├── RiskScore.jsx
│       │       ├── Pagination.jsx
│       │       └── Skeleton.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── hooks/
│       │   └── usePolling.js          # Auto-refresh hook
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Jobs.jsx
│       │   ├── JobDetails.jsx
│       │   ├── Logs.jsx
│       │   ├── Monitoring.jsx
│       │   ├── Analytics.jsx
│       │   ├── Prediction.jsx
│       │   ├── Alerts.jsx
│       │   ├── Reports.jsx
│       │   ├── Settings.jsx
│       │   └── Login.jsx
│       └── utils/
│           ├── api.js                 # Axios instance + JWT interceptor
│           └── helpers.js             # formatDate, formatDuration, etc.
│
├── ai-service/
│   ├── app.py                         # Flask prediction API
│   └── requirements.txt
│
├── start.bat                          # One-click Windows launcher
└── README.md
```

---

## Screenshots

> Add screenshots to a `docs/screenshots/` folder and update the paths below.

| Dashboard | ETL Jobs |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Jobs](docs/screenshots/jobs.png) |

| Job Details — Logs Tab | AI Prediction |
|---|---|
| ![Logs](docs/screenshots/job-logs.png) | ![Prediction](docs/screenshots/prediction.png) |

| Analytics | Root Cause Analysis |
|---|---|
| ![Analytics](docs/screenshots/analytics.png) | ![RCA](docs/screenshots/rca.png) |

---

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 18.x | [nodejs.org](https://nodejs.org) |
| npm | 9.x | Bundled with Node.js |
| MongoDB | 6.x | Optional — app works without it |
| Python | 3.10 | Optional — only for AI service |
| pip | 23+ | Optional — only for AI service |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/etl-predict-ai.git
cd etl-predict-ai
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 4. Install AI service dependencies (optional)

```bash
cd ../ai-service
pip install -r requirements.txt
```

---

## Configuration

Copy the example env file and fill in your values:

```bash
cd backend
# .env is already present — edit it directly
```

**`backend/.env`**

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB (required in production)
MONGO_URI=mongodb://localhost:27017/etl_system

# Airflow
AIRFLOW_BASE_URL=http://localhost:8080
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin
AIRFLOW_API_TIMEOUT_MS=10000
AIRFLOW_SYNC_INTERVAL_MS=30000
AIRFLOW_SYNC_LIMIT=50
AIRFLOW_ENABLED=true

# JWT
JWT_SECRET=change_this_to_a_long_random_string

## Local Airflow startup
If you want the Live Monitor to show real Airflow DAG runs, start a local Airflow instance first.

### Option 1: Local Python Airflow (recommended when Docker is unavailable)
1. Install Python 3.11 or newer (Airflow does not support Python 3.7).
2. Create and activate a virtual environment:

```powershell
python -m venv .venv-airflow
.\.venv-airflow\Scripts\Activate.ps1
```

3. Install Airflow with constraints:

```powershell
pip install "apache-airflow==2.6.3" --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.6.3/constraints-3.11.txt"
```

4. Initialize Airflow metadata and create a local admin user:

```powershell
set AIRFLOW_HOME=%CD%\airflow_home
airflow db init
airflow users create --username admin --firstname Admin --lastname User --role Admin --email admin@etl.com --password admin
```

5. Start the Airflow webserver:

```powershell
airflow webserver --port 8080
```

6. In a second shell, start the scheduler:

```powershell
airflow scheduler
```

7. Confirm Airflow is reachable at `http://localhost:8080` and keep the backend running.

### Option 2: Disable Airflow sync temporarily
If Airflow is not available, set `AIRFLOW_ENABLED=false` in `backend/.env` so the backend stays online without Airflow polling.

# AI Service (optional)
AI_SERVICE_URL=http://localhost:8000

# Email — leave SMTP_HOST empty to disable (app still works)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="ETL Predict AI" <noreply@etl-predict.local>
EMAIL_TO=admin@etl.com
EMAIL_RISK_THRESHOLD=70
```

### Email setup options

**Option A — Gmail**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your_16_char_app_password   # requires 2FA + App Password
```

**Option B — Ethereal (free test inbox, no signup)**
```bash
node -e "require('nodemailer').createTestAccount().then(a => console.log(a))"
# Copy the printed smtp.host / user / pass into .env
# Preview sent emails at https://ethereal.email
```

**Option C — SendGrid / AWS SES / Mailgun**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key
```

---

## Running the App

### Option 1 — One-click (Windows only)

```
double-click start.bat
```

Opens two terminal windows (backend + frontend) and prints the URLs.

### Option 2 — Manual (all platforms)

Run each service in a separate terminal:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# → http://localhost:5000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# → http://localhost:3000
```

**Terminal 3 — AI Service (optional)**
```bash
cd ai-service
python app.py
# → http://localhost:8000
```

### Option 3 — Production build

```bash
# Build frontend static files
cd frontend
npm run build
# Output: frontend/dist/

# Run backend in production mode
cd ../backend
NODE_ENV=production npm start
```

---

## API Endpoints

All endpoints except `POST /api/auth/login` require a `Bearer <token>` header.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login — returns JWT token and user object |

**Request body:**
```json
{ "email": "admin@etl.com", "password": "admin123" }
```

**Response:**
```json
{
  "token": "<jwt>",
  "user": { "id": "1", "name": "Admin User", "email": "admin@etl.com", "role": "admin" }
}
```

---

### ETL Jobs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/jobs` | List jobs — paginated, searchable, sortable |
| `GET` | `/api/jobs/:id` | Get single job by jobId |
| `POST` | `/api/jobs` | Create a new job |
| `PUT` | `/api/jobs/:id` | Update job fields |
| `DELETE` | `/api/jobs/:id` | Delete a job |
| `POST` | `/api/jobs/:id/retry` | Trigger auto-retry for a failed job |

**GET /api/jobs query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Results per page (max 100) |
| `sortBy` | string | `startTime` | Field to sort by |
| `order` | string | `desc` | `asc` or `desc` |
| `status` | string | — | Filter by status |
| `search` | string | — | Search jobId or jobName |

---

### Logs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/logs` | Paginated log stream across all jobs |
| `GET` | `/api/logs/stats` | Count by level (INFO / WARN / ERROR / DEBUG) |
| `GET` | `/api/logs/:jobId` | All logs for a specific job |

**GET /api/logs query params:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number |
| `limit` | number | Results per page (max 200) |
| `level` | string | `INFO`, `WARN`, `ERROR`, or `DEBUG` |
| `jobId` | string | Filter to one job |
| `search` | string | Full-text search on message |
| `dateFrom` | ISO date | Start of time range |
| `dateTo` | ISO date | End of time range |

---

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics` | Full analytics payload — 13 metric groups |

**Response includes:** status counts, success/failure/warning rates, 7-day trend, top failure reasons, source & destination distribution, avg/max/min duration, CPU & memory distribution, retry distribution, records processed, AI risk distribution, high-risk job list, auto-recovery stats.

---

### AI Prediction

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/predict/model` | Model metadata and accuracy metrics |
| `GET` | `/api/predict/at-risk` | Top at-risk jobs (sorted by risk score) |
| `GET` | `/api/predict/history` | Stored prediction log |
| `POST` | `/api/predict` | Run prediction from custom inputs |
| `GET` | `/api/predict/:jobId` | Run prediction for a live job |
| `POST` | `/api/predict/pre-execute` | Pre-execution risk score for a job before it starts |

**POST /api/predict request body:**
```json
{
  "cpuUsage": 85,
  "memoryUsage": 78,
  "retryCount": 2,
  "duration": 1800,
  "recordsProcessed": 2500000,
  "jobName": "Sales Pipeline ETL"
}
```

---

### Root Cause Analysis

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rca/:jobId` | Get cached RCA or run analysis lazily |
| `POST` | `/api/rca/:jobId/analyse` | Force re-run RCA |

**RCA categories:** `database_connection`, `timeout`, `memory_issue`, `missing_file`, `schema_mismatch`, `network_error`, `permission_denied`

---

### Auto-Recovery

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/recovery/stats` | Fleet-wide recovery summary |
| `GET` | `/api/recovery/:jobId` | Recovery state for one job |
| `POST` | `/api/recovery/:jobId/trigger` | Manually trigger recovery |

---

### Alerts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/alerts` | List alerts (filter by `unread`, `type`) |
| `PUT` | `/api/alerts/:id/read` | Mark one alert as read |
| `PUT` | `/api/alerts/read-all` | Mark all alerts as read |
| `POST` | `/api/alerts/email` | Simulate an email alert |

---

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Server health check |

---

## Deployment

### Docker (recommended)

Create a `docker-compose.yml` at the project root:

```yaml
version: '3.9'
services:
  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/etl_system
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  mongo_data:
```

Add a `Dockerfile` to `backend/`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 5000
CMD ["node", "src/server.js"]
```

Add a `Dockerfile` to `frontend/`:

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`frontend/nginx.conf`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:5000;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**Run:**
```bash
docker-compose up --build
```

---

### AWS Deployment

#### Backend — AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

cd backend
eb init etl-predict-backend --platform node.js --region us-east-1
eb create production

# Set environment variables
eb setenv \
  MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/etl_system" \
  JWT_SECRET="your_secret" \
  NODE_ENV="production"
```

#### Frontend — AWS S3 + CloudFront

```bash
cd frontend
npm run build

# Create S3 bucket
aws s3 mb s3://etl-predict-ai-frontend

# Upload build
aws s3 sync dist/ s3://etl-predict-ai-frontend --delete

# Enable static website hosting
aws s3 website s3://etl-predict-ai-frontend \
  --index-document index.html \
  --error-document index.html
```

Then create a CloudFront distribution pointing to the S3 bucket and add a `/api/*` behaviour that forwards to your Elastic Beanstalk URL.

#### Database — MongoDB Atlas

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Whitelist your server IP under **Network Access**
3. Create a database user under **Database Access**
4. Copy the connection string and set it as `MONGO_URI`

---

### Render (free tier)

**Backend:**
1. New → Web Service → connect your repo
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node src/server.js`
5. Add environment variables from `.env`

**Frontend:**
1. New → Static Site → connect your repo
2. Root directory: `frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add redirect rule: `/* → /index.html` (200)

---

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
cd backend
railway init
railway up

# Deploy frontend
cd ../frontend
railway init
railway up
```

---

## Login Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| Admin | `admin@etl.com` | `admin123` | Full read/write access |
| Viewer | `viewer@etl.com` | `viewer123` | Read-only access |

> **Security note:** Change these credentials before any public deployment. Update `authController.js` or configure a MongoDB `User` collection with hashed passwords.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Backend server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `MONGO_URI` | No | — | MongoDB connection string. Required in production; omit only for local dev fallback |
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens |
| `AI_SERVICE_URL` | No | `http://localhost:8000` | Python Flask AI service URL |
| `SMTP_HOST` | No | — | SMTP server hostname. Leave empty to disable emails |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_SECURE` | No | `false` | `true` for port 465 (SSL) |
| `SMTP_USER` | No | — | SMTP username / email |
| `SMTP_PASS` | No | — | SMTP password or app password |
| `EMAIL_FROM` | No | `noreply@etl-predict.local` | Sender address in outgoing emails |
| `EMAIL_TO` | No | `admin@etl.com` | Recipient for all alert emails |
| `EMAIL_RISK_THRESHOLD` | No | `70` | Minimum AI risk score (0–100) that triggers a high-risk email |

---

<div align="center">

Built with ❤️ using React, Node.js, MongoDB, and a weighted AI scoring engine.

</div>
