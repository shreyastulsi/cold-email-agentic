#!/bin/bash
# Fix migration state after inserting new migration in the middle of the chain

echo "Checking migration state..."

# Check if unipile_account_id column exists
cd backend
python3 << 'EOF'
import asyncio
from sqlalchemy import create_engine, text
from app.core.config import settings

database_url = settings.database_url.replace('+asyncpg', '')
engine = create_engine(database_url)

with engine.connect() as conn:
    # Check current version
    try:
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        current_version = result.scalar()
        print(f"Current migration version: {current_version}")
    except Exception as e:
        print(f"Error getting version: {e}")
        current_version = None
    
    # Check if unipile_account_id exists
    try:
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'linkedin_accounts' 
            AND column_name = 'unipile_account_id'
        """))
        has_unipile = result.scalar() is not None
        print(f"unipile_account_id column exists: {has_unipile}")
    except Exception as e:
        print(f"Error checking column: {e}")
        has_unipile = False
    
    # Check if drafts table exists
    try:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'drafts'
        """))
        has_drafts = result.scalar() is not None
        print(f"drafts table exists: {has_drafts}")
    except Exception as e:
        print(f"Error checking table: {e}")
        has_drafts = False
    
    # Determine what to do
    if has_drafts and current_version in ['add_linkedin_accounts', 'add_unipile_account_id']:
        print("\n✅ Database has drafts table but migration is before it.")
        print("   Stamping to add_draft_sent_status_fields...")
        print("   Run: alembic stamp add_draft_sent_status_fields")
    elif has_unipile and current_version == 'add_linkedin_accounts':
        print("\n✅ Database has unipile_account_id but migration doesn't reflect it.")
        print("   Stamping to add_unipile_account_id...")
        print("   Run: alembic stamp add_unipile_account_id")
    else:
        print("\n✅ Migration state looks OK. Try running: alembic upgrade head")

EOF

echo ""
echo "If you see stamping instructions above, run them first, then:"
echo "  alembic upgrade head"

