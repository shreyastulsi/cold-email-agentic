# Complete Setup Guide - Full Stack Application

This guide will walk you through setting up the entire application so frontend, backend, and database all work together.

## Prerequisites

Before starting, ensure you have:
- ✅ Docker Desktop installed (or Docker + Docker Compose)
- ✅ Node.js 18+ installed
- ✅ Python 3.11+ installed
- ✅ A Supabase account (for authentication)
- ✅ API keys for: Unipile, Apollo, OpenAI, SMTP (Gmail)

---

## Step-by-Step Setup

### Step 1: Environment Files Setup

Create all necessary environment files:

```bash
# Navigate to project root
cd /Users/shreyastulsi/Cold-Email

# Copy example files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp infra/.env.postgres.example infra/.env.postgres
```

---

### Step 2: Get Your Supabase Credentials

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project (or use existing)
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role secret** key

5. Go to **Settings** → **Auth** → **JWT Settings**
6. Copy the **JWT Secret**

**Update `backend/.env`:**
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

**Update `frontend/.env`:**
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

### Step 3: Configure Backend Environment

Edit `backend/.env` with all your API keys:

```env
# Database (Docker Compose)
DATABASE_URL=postgresql+asyncpg://app:app@db:5432/app

# Supabase Auth
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Unipile API
BASE_URL=https://api12.unipile.com:14248/api/v1
UNIPILE_API_KEY=your-unipile-api-key
UNIPILE_ACCOUNT_ID=your-unipile-account-id

# Apollo API
APOLLO_API_KEY=your-apollo-api-key

# SMTP (Gmail)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use Gmail App Password, not regular password
FROM_EMAIL=your-email@gmail.com

# OpenAI (for email generation)
OPENAI_API_KEY=sk-your-openai-key

# CORS
CORS_ORIGINS=http://localhost:5173
```

**Important Notes:**
- **Gmail App Password**: If using Gmail, you need to generate an [App Password](https://support.google.com/accounts/answer/185833)
- **Unipile**: Sign up at [Unipile](https://unipile.com) to get API keys
- **Apollo**: Sign up at [Apollo.io](https://apollo.io) for email extraction

---

### Step 4: Configure Frontend Environment

Edit `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_BASE_URL=http://localhost:8000
```

---

### Step 5: Start Database (PostgreSQL)

**Option A: Using Docker Compose (Recommended)**

```bash
# Start only the database
cd infra
docker-compose up -d db

# Wait for database to be ready (about 10 seconds)
sleep 10

# Verify database is running
docker-compose ps
```

**Option B: Local PostgreSQL**

If you prefer to run PostgreSQL locally:

```bash
# Install PostgreSQL (macOS)
brew install postgresql@16
brew services start postgresql@16

# Create database and user
createdb app
psql -d app -c "CREATE USER app WITH PASSWORD 'app';"
psql -d app -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"
psql -d app -c "ALTER USER app CREATEDB;"

# Update backend/.env DATABASE_URL:
# DATABASE_URL=postgresql+asyncpg://app:app@localhost:5432/app
```

---

### Step 6: Set Up Backend

**Option A: Using Docker (Recommended)**

```bash
# From project root
cd infra

# Build and start backend
docker-compose up -d backend

# Check logs
docker-compose logs backend

# Wait a few seconds for backend to start
sleep 5
```

**Option B: Local Backend Development**

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# (Optional) Seed database with default pipeline stages
python -m app.db.seed

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: **http://localhost:8000**

---

### Step 7: Verify Backend is Working

Test the backend in multiple ways:

**Method 1: Health Check**
```bash
curl http://localhost:8000/healthz
# Should return: {"ok":true}
```

**Method 2: API Documentation**
Open in browser: **http://localhost:8000/docs**

You should see the Swagger UI with all API endpoints.

**Method 3: Test Authentication (requires valid JWT)**
```bash
# This will fail without auth, but shows the endpoint exists
curl http://localhost:8000/api/v1/auth/me
# Should return: {"detail":"Not authenticated"}
```

---

### Step 8: Set Up Frontend

**Option A: Using Docker**

```bash
cd infra
docker-compose up -d frontend
```

**Option B: Local Frontend Development**

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The frontend will be available at: **http://localhost:5173**

---

### Step 9: Verify Frontend is Working

1. Open browser: **http://localhost:5173**
2. You should see:
   - Sidebar with navigation (Dashboard, Search, Email, Pipeline, Settings)
   - Top header
   - Dashboard page with KPI cards and tables

3. Try navigating between pages - all should load

---

### Step 10: Test Full Stack Integration

**Test 1: Frontend → Backend Connection**

1. Open browser console (F12)
2. Navigate to Dashboard
3. Check Network tab for API calls
4. If you see errors, check:
   - `VITE_API_BASE_URL` in `frontend/.env` matches `http://localhost:8000`
   - Backend is running on port 8000
   - CORS is configured correctly

**Test 2: Backend → Database Connection**

```bash
# If using Docker
docker-compose exec backend python -c "
from app.db.base import engine
from sqlalchemy import text
import asyncio

async def test():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT 1'))
        print('Database connection successful!')

asyncio.run(test())
"
```

**Test 3: Authentication Flow**

1. In frontend, try to make an authenticated request
2. You'll need a valid Supabase JWT token
3. Check browser console for auth errors

---

## Complete Docker Compose Setup (All-in-One)

If you want to run everything together with Docker:

```bash
# From project root
cd infra

# Start all services (database, backend, frontend)
docker-compose up -d

# Wait for services to start
sleep 10

# Run database migrations
cd ../backend
alembic upgrade head

# Seed database (optional)
python -m app.db.seed

# Check all services are running
cd ../infra
docker-compose ps
```

**Services:**
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **Database**: localhost:5432
- **API Docs**: http://localhost:8000/docs

---

## Troubleshooting

### Issue: Frontend can't connect to backend

**Symptoms:**
- CORS errors in browser console
- Network requests failing

**Solutions:**
1. Check `frontend/.env` has: `VITE_API_BASE_URL=http://localhost:8000`
2. Check `backend/.env` has: `CORS_ORIGINS=http://localhost:5173`
3. Verify backend is running: `curl http://localhost:8000/healthz`
4. Check backend logs: `docker-compose logs backend` or backend terminal

---

### Issue: Backend can't connect to database

**Symptoms:**
- Database connection errors
- Migration failures

**Solutions:**
1. Verify database is running:
   ```bash
   docker-compose ps db
   # or
   pg_isready -h localhost -p 5432
   ```

2. Check `DATABASE_URL` in `backend/.env`:
   - Docker: `postgresql+asyncpg://app:app@db:5432/app`
   - Local: `postgresql+asyncpg://app:app@localhost:5432/app`

3. Test connection:
   ```bash
   psql -h localhost -U app -d app -c "SELECT 1;"
   ```

---

### Issue: Authentication not working

**Symptoms:**
- 401 Unauthorized errors
- JWT verification failures

**Solutions:**
1. Verify Supabase credentials in `backend/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET` (must match Supabase dashboard)

2. Verify Supabase credentials in `frontend/.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. Check JWT secret matches in both frontend and backend

---

### Issue: Migration errors

**Symptoms:**
- `alembic upgrade head` fails
- Database schema errors

**Solutions:**
```bash
cd backend

# Reset migrations (WARNING: deletes all data)
alembic downgrade base
alembic upgrade head

# Or create fresh migration
alembic revision --autogenerate -m "initial_migration"
alembic upgrade head
```

---

### Issue: Port already in use

**Symptoms:**
- Service won't start
- Port conflict errors

**Solutions:**
```bash
# Find what's using the port
lsof -i :8000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # Database

# Kill the process or change ports in docker-compose.yml
```

---

## Verification Checklist

Before declaring setup complete, verify:

- [ ] Database is running and accessible
- [ ] Backend starts without errors
- [ ] Backend health check returns `{"ok":true}`
- [ ] Backend API docs available at http://localhost:8000/docs
- [ ] Frontend starts without errors
- [ ] Frontend loads at http://localhost:5173
- [ ] All pages load (Dashboard, Search, Email, Pipeline, Settings)
- [ ] Browser console shows no critical errors
- [ ] CORS errors resolved
- [ ] Environment variables are set correctly

---

## Common Commands Reference

```bash
# Start all services
cd infra && docker-compose up -d

# Stop all services
cd infra && docker-compose down

# View logs
cd infra && docker-compose logs -f
cd infra && docker-compose logs -f backend
cd infra && docker-compose logs -f frontend

# Run migrations
cd backend && alembic upgrade head

# Create new migration
cd backend && alembic revision --autogenerate -m "description"

# Seed database
cd backend && python -m app.db.seed

# Rebuild services
cd infra && docker-compose build
cd infra && docker-compose up -d

# Check service status
cd infra && docker-compose ps

# Restart a service
cd infra && docker-compose restart backend
```

---

## Next Steps

Once everything is running:

1. **Set up Supabase Auth** in your Supabase dashboard
2. **Create a test user** through Supabase Auth
3. **Get a JWT token** from Supabase
4. **Test API endpoints** using the JWT token
5. **Customize the UI** to match your needs
6. **Add your API keys** for Unipile, Apollo, OpenAI
7. **Test the full flow**: Search → Map → Outreach

---

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables
3. Ensure all prerequisites are installed
4. Check this guide's troubleshooting section
5. Review the main README.md for additional details

