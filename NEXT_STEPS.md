# Next Steps - Running Your Application

## ✅ Current Status

- ✅ **Frontend**: Running at http://localhost:5173
- ✅ **Configuration**: All .env files are set up
- ⚠️ **Database**: Need to set up (choose option below)
- ⚠️ **Backend**: Need to start (after database)

---

## 🚀 Next Steps (Choose Your Path)

### Option A: Use Local PostgreSQL (No Docker Needed!)

Since you have PostgreSQL running locally, you can skip Docker entirely:

#### Step 1: Set up Local Database

```bash
# Create database and user
createdb app 2>/dev/null || echo "Database may already exist"
psql -d postgres -c "CREATE USER app WITH PASSWORD 'app';" 2>/dev/null || echo "User may already exist"
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"
psql -d postgres -c "ALTER USER app CREATEDB;"
```

#### Step 2: Update backend/.env

Change the `DATABASE_URL` in `backend/.env`:

```env
# Change from:
DATABASE_URL=postgresql+asyncpg://app:app@db:5432/app

# To:
DATABASE_URL=postgresql+asyncpg://app:app@localhost:5432/app
```

#### Step 3: Run Database Migrations

```bash
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies (if not done)
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# (Optional) Seed database
python -m app.db.seed
```

#### Step 4: Start Backend

```bash
# In backend directory, with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**That's it!** Your backend will be at http://localhost:8000

---

### Option B: Use Docker (If You Prefer)

If you want to use Docker instead:

#### Step 1: Start Docker Database

```bash
cd infra
docker-compose up -d db

# Wait for it to start
sleep 10

# Check it's running
docker-compose ps
```

#### Step 2: Run Migrations

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed
```

#### Step 3: Start Backend

**Option 3a: Using Docker**
```bash
cd infra
docker-compose up -d backend
```

**Option 3b: Locally (Recommended for development)**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🎯 Recommended: Option A (Local PostgreSQL)

Since you already have PostgreSQL running locally, **Option A is easiest** and you don't need Docker at all!

**Steps:**
1. ✅ Set up local database (commands above)
2. ✅ Update `backend/.env` DATABASE_URL to use `localhost` instead of `db`
3. ✅ Run migrations: `alembic upgrade head`
4. ✅ Start backend: `uvicorn app.main:app --reload`

---

## ✅ Verification

Once backend is running:

1. **Check health:**
   ```bash
   curl http://localhost:8000/healthz
   # Should return: {"ok":true}
   ```

2. **Check API docs:**
   - Open: http://localhost:8000/docs
   - Should see Swagger UI

3. **Check frontend:**
   - Already running at http://localhost:5173
   - Should connect to backend

---

## 📋 Quick Command Reference

```bash
# Set up local database (one-time)
createdb app
psql -d postgres -c "CREATE USER app WITH PASSWORD 'app';"
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"

# Run migrations
cd backend
source venv/bin/activate
alembic upgrade head

# Start backend
uvicorn app.main:app --reload
```

---

## 🎉 You're Done When:

- ✅ Database is set up
- ✅ Migrations are run
- ✅ Backend is running at http://localhost:8000
- ✅ Frontend is running at http://localhost:5173
- ✅ Backend health check returns `{"ok":true}`

**You don't need Docker right now** if you use local PostgreSQL! 🚀

