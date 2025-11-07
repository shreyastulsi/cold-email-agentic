# Fix Database Connection Issues

## Problem
The Supabase database hostname `db.kavetbruqkavbfcmfcnz.supabase.co` cannot be resolved.

## Solutions

### Option 1: Use Supabase Connection Pooler (Recommended)

Supabase provides a connection pooler URL that's more reliable. Update your `backend/.env`:

```bash
# Connection Pooler (port 6543)
DATABASE_URL=postgresql+asyncpg://postgres.kavetbruqkavbfcmfcnz:ShreyasRaman2025@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Or try different regions:
# aws-0-us-west-1.pooler.supabase.com
# aws-0-eu-west-1.pooler.supabase.com
# aws-0-ap-southeast-1.pooler.supabase.com
```

**To find your pooler URL:**
1. Go to Supabase Dashboard → Settings → Database
2. Look for "Connection Pooling" section
3. Copy the "Connection string" for "Session mode" or "Transaction mode"

### Option 2: Verify Supabase Project Status

1. Log into https://supabase.com/dashboard
2. Check if project `kavetbruqkavbfcmfcnz` is active
3. If paused, click "Restore project"
4. Go to Settings → Database → Connection string
5. Copy the correct connection string

### Option 3: Use Direct Connection (If Pooler Doesn't Work)

Try the direct connection format:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:[ShreyasRaman2025]@db.kavetbruqkavbfcmfcnz.supabase.co:5432/postgres?sslmode=require
```

Note: Password should be URL-encoded if it contains special characters.

### Option 4: Use Local PostgreSQL (For Development)

If Supabase is not accessible, use a local PostgreSQL:

```bash
# Install PostgreSQL locally (macOS)
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb app
psql -d app -c "CREATE USER app WITH PASSWORD 'app';"
psql -d app -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"

# Update backend/.env
DATABASE_URL=postgresql+asyncpg://app:app@localhost:5432/app
```

### Option 5: Use Docker PostgreSQL (Easiest)

```bash
cd infra
docker-compose up -d db

# Update backend/.env
DATABASE_URL=postgresql+asyncpg://app:app@localhost:5432/app
```

## Test Connection

After updating, test the connection:

```bash
cd backend
source venv/bin/activate
python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def test():
    engine = create_async_engine(settings.database_url, echo=True)
    async with engine.connect() as conn:
        result = await conn.execute('SELECT 1')
        print('✅ Connection successful!', result.fetchone())
    await engine.dispose()

asyncio.run(test())
"
```

## Next Steps

1. Try Option 1 (Connection Pooler) first
2. If that doesn't work, check Supabase dashboard (Option 2)
3. For local development, use Option 4 or 5

