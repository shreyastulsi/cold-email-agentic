# Quick Start Guide

## Option 1: Docker Compose (Recommended)

### Step 1: Set up environment files

```bash
# Copy environment examples
cp infra/.env.postgres.example infra/.env.postgres 2>/dev/null || echo "Skipping postgres .env"
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 2: Configure environment variables

**Edit `backend/.env`** - Add your API keys:

```env
DATABASE_URL=postgresql+asyncpg://app:app@db:5432/app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
BASE_URL=https://api12.unipile.com:14248/api/v1
UNIPILE_API_KEY=your-unipile-key
UNIPILE_ACCOUNT_ID=your-account-id
APOLLO_API_KEY=your-apollo-key
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
OPENAI_API_KEY=your-openai-key
CORS_ORIGINS=http://localhost:5173
```

**Edit `frontend/.env`**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

### Step 3: Start with Docker Compose

```bash
# Start all services
cd infra
docker-compose up -d

# Wait a few seconds for services to start
sleep 5

# Run database migrations
cd ../backend
alembic upgrade head

# (Optional) Seed database
python -m app.db.seed
```

**Or use the Makefile:**

```bash
# From project root
make dev
```

### Step 4: Access the application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/healthz

### Useful Commands

```bash
# View logs
make logs
# or
cd infra && docker-compose logs -f

# Stop services
make down
# or
cd infra && docker-compose down

# Rebuild and restart
make build
make up
```

---

## Option 2: Local Development (Without Docker)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 16+ (running locally)

### Step 1: Set up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your keys
# Update DATABASE_URL to: postgresql+asyncpg://app:app@localhost:5432/app

# Run migrations
alembic upgrade head

# (Optional) Seed database
python -m app.db.seed

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 2: Set up Frontend (in a new terminal)

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase keys

# Start development server
npm run dev
```

### Step 3: Set up PostgreSQL locally

If you don't have PostgreSQL running:

```bash
# On macOS (using Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb app
psql -U your-username -d app -c "CREATE USER app WITH PASSWORD 'app';"
psql -U your-username -d app -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"

# Update backend/.env DATABASE_URL:
# postgresql+asyncpg://app:app@localhost:5432/app
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :8000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process or change ports in docker-compose.yml
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps  # In infra directory

# Or check local PostgreSQL
pg_isready -h localhost -p 5432
```

### Migration Errors

```bash
# Reset database (WARNING: deletes all data)
cd backend
alembic downgrade base
alembic upgrade head
```

### Frontend Not Connecting to Backend

1. Check `VITE_API_BASE_URL` in `frontend/.env`
2. Verify CORS settings in `backend/app/core/config.py`
3. Check browser console for errors

### Missing Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

---

## First-Time Setup Checklist

- [ ] Docker Desktop installed (if using Docker)
- [ ] Python 3.11+ installed (if running locally)
- [ ] Node.js 18+ installed
- [ ] PostgreSQL running (if running locally)
- [ ] Environment files created and filled
- [ ] Supabase project created and keys added
- [ ] API keys added (Unipile, Apollo, OpenAI, SMTP)
- [ ] Database migrations run
- [ ] Services started and accessible

---

## Development Workflow

1. **Make changes** to code
2. **Hot reload** is enabled for both frontend and backend
3. **Check logs** with `make logs` or `docker-compose logs -f`
4. **Test API** at http://localhost:8000/docs
5. **Test Frontend** at http://localhost:5173

---

## Stopping the Application

```bash
# With Docker
make down

# Or manually
cd infra
docker-compose down

# With local setup
# Press Ctrl+C in each terminal running services
```

---

## Need Help?

- Check the main README.md for more details
- Review docker-compose logs: `make logs`
- Check backend logs: `docker-compose logs backend`
- Check frontend logs: `docker-compose logs frontend`

