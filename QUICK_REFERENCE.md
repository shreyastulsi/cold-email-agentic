# Quick Reference - Setup Commands

## 🚀 Quick Start (All-in-One)

```bash
# Option 1: Use the automated script
./start-dev.sh

# Option 2: Manual setup
./setup.sh                    # Create .env files
# Edit backend/.env and frontend/.env with your API keys
make dev                      # Start all services
```

---

## 📝 Step-by-Step Manual Setup

### 1. Environment Files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp infra/.env.postgres.example infra/.env.postgres
```

### 2. Edit Environment Variables

**backend/.env** - Add:
- `SUPABASE_URL` - From Supabase dashboard
- `SUPABASE_ANON_KEY` - From Supabase dashboard  
- `SUPABASE_JWT_SECRET` - From Supabase JWT settings
- `UNIPILE_API_KEY` - Your Unipile API key
- `UNIPILE_ACCOUNT_ID` - Your Unipile account ID
- `APOLLO_API_KEY` - Your Apollo API key
- `OPENAI_API_KEY` - Your OpenAI API key
- `SMTP_USERNAME` - Your Gmail address
- `SMTP_PASSWORD` - Gmail App Password (not regular password)
- `FROM_EMAIL` - Your email address

**frontend/.env** - Add:
- `VITE_SUPABASE_URL` - Same as backend SUPABASE_URL
- `VITE_SUPABASE_ANON_KEY` - Same as backend SUPABASE_ANON_KEY

### 3. Start Database
```bash
cd infra
docker-compose up -d db
sleep 10  # Wait for database to start
```

### 4. Run Migrations
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed  # Optional: seed default data
```

### 5. Start Backend
```bash
# Option A: Docker
cd infra
docker-compose up -d backend

# Option B: Local development
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Start Frontend
```bash
# Option A: Docker (if configured in docker-compose)
cd infra
docker-compose up -d frontend

# Option B: Local development
cd frontend
npm install  # First time only
npm run dev
```

---

## ✅ Verification Commands

```bash
# Test database
docker-compose ps db
# or
pg_isready -h localhost -p 5432

# Test backend
curl http://localhost:8000/healthz
# Should return: {"ok":true}

# Open API docs
open http://localhost:8000/docs

# Test frontend
open http://localhost:5173
```

---

## 📋 Common Commands

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

# Restart service
cd infra && docker-compose restart backend

# Check status
cd infra && docker-compose ps
```

---

## 🔗 Access URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/healthz
- **Database**: localhost:5432 (user: app, password: app, db: app)

---

## 🐛 Quick Troubleshooting

### Backend won't start
```bash
# Check logs
cd infra && docker-compose logs backend

# Check environment
cat backend/.env

# Test database connection
curl http://localhost:8000/healthz
```

### Frontend can't connect to backend
```bash
# Verify backend is running
curl http://localhost:8000/healthz

# Check CORS in backend/.env
grep CORS_ORIGINS backend/.env

# Check frontend API URL
grep VITE_API_BASE_URL frontend/.env
```

### Database connection errors
```bash
# Verify database is running
docker-compose ps db

# Check DATABASE_URL in backend/.env
grep DATABASE_URL backend/.env

# Test connection
psql -h localhost -U app -d app -c "SELECT 1;"
```

### Port already in use
```bash
# Find process using port
lsof -i :8000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # Database

# Kill process (replace PID with actual process ID)
kill -9 PID
```

---

## 📚 Documentation Files

- **SETUP_GUIDE.md** - Complete detailed setup instructions
- **QUICK_START.md** - Quick start guide
- **README.md** - Full project documentation
- **QUICK_REFERENCE.md** - This file (command reference)

---

## ⚠️ Important Notes

1. **Gmail App Password**: Don't use your regular Gmail password. Generate an [App Password](https://support.google.com/accounts/answer/185833)

2. **Supabase JWT Secret**: Must match the JWT secret in your Supabase dashboard

3. **CORS**: Frontend URL in `backend/.env` must match where frontend runs (usually `http://localhost:5173`)

4. **Database**: Default credentials are `app:app` on database `app`. Change if needed.

5. **First Run**: Database migrations and seed data setup happens automatically with `make dev` or `./start-dev.sh`

