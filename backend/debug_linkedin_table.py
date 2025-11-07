"""Debug script to check linkedin_accounts table."""
import asyncio
from app.db.base import engine, AsyncSessionLocal
from sqlalchemy import text, inspect
from app.db.models.linkedin_account import LinkedInAccount

async def debug_table():
    print("=" * 60)
    print("DEBUGGING LINKEDIN_ACCOUNTS TABLE")
    print("=" * 60)
    
    # Check 1: Direct SQL query
    print("\n1. Checking if table exists via direct SQL...")
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'linkedin_accounts'
        """))
        rows = result.fetchall()
        if rows:
            print(f"   ✅ Table found: {rows[0][0]}")
        else:
            print("   ❌ Table NOT found in information_schema")
        
        # Check all tables
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """))
        tables = [row[0] for row in result.fetchall()]
        print(f"\n   All tables in database: {', '.join(tables)}")
        
        # Check if linkedin_accounts is in the list
        if 'linkedin_accounts' in tables:
            print("   ✅ linkedin_accounts is in the tables list")
        else:
            print("   ❌ linkedin_accounts is NOT in the tables list")
    
    # Check 2: Try to query the table directly
    print("\n2. Attempting direct query on linkedin_accounts...")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT COUNT(*) FROM linkedin_accounts"))
            count = result.scalar()
            print(f"   ✅ Query successful! Row count: {count}")
    except Exception as e:
        print(f"   ❌ Query failed: {e}")
    
    # Check 3: Check SQLAlchemy model reflection
    print("\n3. Checking SQLAlchemy model...")
    print(f"   Model table name: {LinkedInAccount.__tablename__}")
    print(f"   Model class: {LinkedInAccount}")
    
    # Check 4: Try to use the model with a session
    print("\n4. Attempting to use model with session...")
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            result = await session.execute(select(LinkedInAccount))
            accounts = result.scalars().all()
            print(f"   ✅ Model query successful! Found {len(accounts)} accounts")
    except Exception as e:
        print(f"   ❌ Model query failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    # Check 5: Check database connection string
    print("\n5. Database connection info...")
    from app.core.config import settings
    db_url = settings.database_url
    # Mask password
    if '@' in db_url:
        parts = db_url.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split('://')[1]
            if ':' in user_pass:
                user = user_pass.split(':')[0]
                db_url = db_url.replace(user_pass, f"{user}:***")
    print(f"   Database URL: {db_url[:50]}...")
    
    # Check 6: Check schema
    print("\n6. Checking current schema...")
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT current_schema()"))
        schema = result.scalar()
        print(f"   Current schema: {schema}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(debug_table())

