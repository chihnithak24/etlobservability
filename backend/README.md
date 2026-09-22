# ETL Backend — Node.js + Express

## Setup

```bash
npm install
npm run dev      # development (nodemon) → http://localhost:5000
npm start        # production
```

## Environment Variables (`.env`)

| Variable        | Default                              | Description              |
|-----------------|--------------------------------------|--------------------------|
| PORT            | 5000                                 | Server port              |
| MONGO_URI       | mongodb://localhost:27017/etl_system | MongoDB connection string (required in production) |
| JWT_SECRET      | etl_super_secret_jwt_key_2024        | JWT signing secret       |
| AIRFLOW_BASE_URL | http://localhost:8080               | Apache Airflow webserver URL (no trailing slash) |
| AIRFLOW_USERNAME | admin                               | Airflow REST username    |
| AIRFLOW_PASSWORD | admin                               | Airflow REST password    |
| AIRFLOW_ENABLED  | true                                | Enable Airflow sync loop |
| AI_SERVICE_URL   | http://localhost:8000               | Python AI service URL    |
| NODE_ENV         | development                         | Environment              |

> MongoDB is required in production. In development, the server can temporarily fall back to an in-memory store only when `MONGO_URI` is not configured.
>
> If local Airflow is not available, set `AIRFLOW_ENABLED=false` in `backend/.env` to keep the backend running without Airflow sync.
>
> To verify Airflow connectivity, call `GET /api/airflow/ping` after the backend starts. The route returns real Airflow error details when the service is unreachable.
>
> Local Airflow must be running on `http://localhost:8080` and reachable from the backend for `/api/airflow/runs` to return live data.
>
> If your environment has Python 3.7, upgrade to Python 3.11+ before installing Airflow.

---

## Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                  # MongoDB connection (graceful fallback)
│   ├── controllers/
│   │   ├── authController.js      # Login, JWT issue
│   │   ├── jobController.js       # CRUD + retry logic
│   │   ├── analyticsController.js # Stats, trends, failure reasons
│   │   ├── alertController.js     # Alerts + email simulation
│   │   └── predictionController.js# Rule-based AI risk scoring
│   ├── data/
│   │   ├── seedData.js            # Dev-only sample job generator
│   │   └── store.js               # Shared in-memory data store
│   ├── middleware/
│   │   └── auth.js                # JWT verification middleware
│   ├── models/
│   │   ├── Job.js                 # Mongoose Job schema
│   │   ├── User.js                # Mongoose User schema
│   │   └── Alert.js               # Mongoose Alert schema
│   ├── routes/
│   │   ├── auth.js
│   │   ├── jobs.js
│   │   ├── analytics.js
│   │   ├── alerts.js
│   │   └── predict.js
│   └── server.js                  # Express app entry point
├── .env
└── package.json
```

---

## REST API Reference

### Auth

| Method | Endpoint         | Auth | Description     |
|--------|------------------|------|-----------------|
| POST   | /api/auth/login  | No   | Login, get JWT  |

**POST /api/auth/login**
```json
// Request
{ "email": "admin@etl.com", "password": "admin123" }

// Response
{ "token": "<jwt>", "user": { "id", "name", "email", "role" } }
```

Demo credentials:
- `admin@etl.com` / `admin123` (role: admin)
- `viewer@etl.com` / `viewer123` (role: viewer)

---

### Jobs

All job routes require `Authorization: Bearer <token>` header.

| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| GET    | /api/jobs             | Get all jobs (paginated) |
| GET    | /api/jobs/:id         | Get job by ID            |
| POST   | /api/jobs             | Create a new job         |
| PUT    | /api/jobs/:id         | Update a job             |
| DELETE | /api/jobs/:id         | Delete a job             |
| POST   | /api/jobs/:id/retry   | Trigger auto-retry       |

**GET /api/jobs — Query Parameters**

| Param   | Type   | Default    | Description                              |
|---------|--------|------------|------------------------------------------|
| page    | number | 1          | Page number                              |
| limit   | number | 10         | Results per page                         |
| status  | string | all        | Filter: all, running, success, failed, warning, pending |
| search  | string | —          | Search by job name or job ID             |
| sortBy  | string | startTime  | Field to sort by                         |
| order   | string | desc       | asc or desc                              |

**GET /api/jobs — Response**
```json
{
  "jobs": [ { ...jobObject } ],
  "total": 40,
  "page": 1,
  "pages": 4
}
```

**Job Object Fields**

| Field            | Type    | Description                          |
|------------------|---------|--------------------------------------|
| jobId            | string  | Unique ID e.g. JOB-0001              |
| jobName          | string  | Human-readable name                  |
| source           | string  | Source system (S3, MySQL, Kafka …)   |
| destination      | string  | Destination system                   |
| status           | string  | running / success / failed / warning / pending |
| startTime        | date    | Job start timestamp                  |
| endTime          | date    | Job end timestamp (null if running)  |
| duration         | number  | Seconds                              |
| cpuUsage         | number  | Percentage 0–100                     |
| memoryUsage      | number  | Percentage 0–100                     |
| recordsProcessed | number  | Total records handled                |
| failureReason    | string  | Reason string or null                |
| retryCount       | number  | Number of retries attempted          |
| aiRiskScore      | number  | 0–99 AI-computed risk score          |
| predictedStatus  | string  | stable / at_risk / likely_fail       |
| logs             | array   | `[{ timestamp, level, message }]`    |
| recoveryActions  | array   | Suggested recovery steps             |
| anomalies        | array   | Detected anomalies                   |

**POST /api/jobs — Request Body**
```json
{
  "jobName": "My ETL Job",
  "source": "S3",
  "destination": "Redshift"
}
```

**PUT /api/jobs/:id — Request Body** (any subset of job fields)
```json
{ "status": "failed", "failureReason": "Connection timeout" }
```

---

### Analytics

| Method | Endpoint        | Auth | Description              |
|--------|-----------------|------|--------------------------|
| GET    | /api/analytics  | Yes  | Dashboard stats + trends |

**Response**
```json
{
  "total": 40,
  "running": 2,
  "success": 28,
  "failed": 7,
  "warning": 3,
  "predicted": 5,
  "successRate": 70.0,
  "trend": [ { "date": "Jan 1", "failed": 2, "success": 5, "total": 7 } ],
  "topFailureReasons": [ { "reason": "Connection timeout", "count": 3 } ],
  "sourceDistribution": [ { "source": "S3", "count": 12 } ],
  "avgDuration": { "success": 900, "failed": 450 }
}
```

---

### Alerts

| Method | Endpoint              | Auth | Description            |
|--------|-----------------------|------|------------------------|
| GET    | /api/alerts           | Yes  | Get all alerts         |
| PUT    | /api/alerts/:id/read  | Yes  | Mark alert as read     |
| POST   | /api/alerts/email     | Yes  | Simulate email alert   |

**GET /api/alerts — Query Parameters**

| Param  | Type    | Description              |
|--------|---------|--------------------------|
| unread | boolean | If true, return unread only |

**POST /api/alerts/email — Request Body**
```json
{ "jobId": "JOB-0001", "jobName": "Customer Data Sync", "reason": "Job failed" }
```

---

### AI Prediction

| Method | Endpoint      | Auth | Description                    |
|--------|---------------|------|--------------------------------|
| POST   | /api/predict  | Yes  | Predict failure risk for a job |

**Request Body**
```json
{
  "cpuUsage": 85,
  "memoryUsage": 78,
  "retryCount": 2,
  "duration": 1800,
  "recordsProcessed": 500000,
  "source": "Kafka"
}
```

**Response**
```json
{
  "riskScore": 74,
  "predictedStatus": "likely_fail",
  "confidence": 91.3,
  "rootCause": "High resource utilization...",
  "recoveryActions": ["Scale up compute resources", "Enable auto-retry"],
  "anomalies": ["Critical CPU spike detected"]
}
```

---

### Health Check

| Method | Endpoint     | Auth | Description  |
|--------|--------------|------|--------------|
| GET    | /api/health  | No   | Server status |

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

---

## Local Development

This backend is built for production use with live Airflow sync and MongoDB persistence. In development, you can optionally enable seeding with `SEED_DB=true` to populate MongoDB with 40 sample ETL jobs when the collection is empty.

Do not rely on seed data for production workloads.
