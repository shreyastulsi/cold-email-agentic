# Setup Without Docker - Alternative Options

Since Docker/OrbStack isn't running, here are alternative ways to run PostgreSQL:

## Option 1: Start Docker/OrbStack (Recommended)

### If you're using OrbStack:
```bash
# Open OrbStack application
open -a OrbStack

# Or start via command line
open -a /Applications/OrbStack.app

# Wait a few seconds for it to start
sleep 5

# Then try again
cd infra
docker-compose up -d db
```

### If you're using Docker Desktop:
```bash
# Open Docker Desktop
open -a Docker

# Wait for it to start
sleep 10

# Then try again
cd infra
docker-compose up -d db
```

---

## Option 2: Install PostgreSQL Locally (No Docker Needed)

### macOS (using Homebrew):
```bash
# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Wait for it to start
sleep 5

# Create database and user
createdb app
psql -d app -c "CREATE USER app WITH PASSWORD 'app';"
psql -d app -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"
psql -d app -c "ALTER USER app CREATEDB;"
```

### Update backend/.env:
```env
# Change from:
DATABASE_URL=postgresql+asyncpg://app:app@db:5432/app

# To:
DATABASE_URL=postgresql+asyncpg://app:app@localhost:5432/app
```

---

## Option 3: Use Cloud PostgreSQL (Supabase or Other)

If you have a Supabase project, you can use their PostgreSQL database:

1. Go to Supabase Dashboard → Settings → Database
2. Copy the connection string
3. Update `backend/.env`:

```env
# Use Supabase PostgreSQL connection string
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@[host]:5432/postgres
```

**Note**: This uses your Supabase project's database instead of local Docker.

---

## Option 4: Quick Start - Run Backend Only (Skip DB for Now)

If you just want to test the frontend connecting to backend without the database:

```bash
# Start backend (will show DB errors, but API endpoints will work)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Backend will run but database-dependent endpoints will fail
# Health check will work: http://localhost:8000/healthz
```

---

## Recommended: Start OrbStack

Since you're using OrbStack, the easiest solution is:

```bash
# 1. Start OrbStack
open -a /Applications/OrbStack.app

# 2. Wait ~10 seconds for it to fully start
sleep 10

# 3. Verify Docker is running
docker ps

# 4. Start database
cd infra
docker-compose up -d db

# 5. Check it's running
docker-compose ps
```

---

## Troubleshooting

### Check if Docker/OrbStack is installed:
```bash
which docker
which orbstack
open -a OrbStack  # If this works, OrbStack is installed
```

### Check if Docker is accessible:
```bash
docker version
```

### If OrbStack is installed but not running:
```bash
# Start it manually
open -a /Applications/OrbStack.app

# Wait and verify
sleep 10
docker ps
```

---

## After Starting PostgreSQL

Once PostgreSQL is running (either via Docker or locally):

1. **Run migrations:**
   ```bash
   cd backend
   source venv/bin/activate
   alembic upgrade head
   ```

2. **Start backend:**
   ```bash
   # With Docker
   cd infra
   docker-compose up -d backend
   
   # Or locally
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

3. **Verify:**
   ```bash
   curl http://localhost:8000/healthz
   # Should return: {"ok":true}
   ```

---

## Quick Decision Guide

- **Have Docker/OrbStack?** → Start it and use Docker (easiest)
- **No Docker but have Homebrew?** → Install PostgreSQL locally
- **Have Supabase?** → Use Supabase PostgreSQL (cloud)
- **Just testing frontend?** → Skip database for now

I recommend **Option 1** (start OrbStack) if you already have it installed.

