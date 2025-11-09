"""Script to fix migration state after adding new migration in the middle of the chain."""
import asyncio
from sqlalchemy import create_engine, text
from app.core.config import settings

async def check_and_fix_migration_state():
    """Check current migration state and fix if needed."""
    # Use sync engine for this simple check
    database_url = settings.database_url.replace('+asyncpg', '')
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Check current version
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        current_version = result.scalar()
        print(f"Current migration version in database: {current_version}")
        
        # Check if unipile_account_id column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'linkedin_accounts' 
            AND column_name = 'unipile_account_id'
        """))
        has_unipile_column = result.scalar() is not None
        print(f"unipile_account_id column exists: {has_unipile_column}")
        
        # Check if drafts table exists
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'drafts'
        """))
        has_drafts_table = result.scalar() is not None
        print(f"drafts table exists: {has_drafts_table}")
        
        # If drafts table exists but we're before add_unipile_account_id, we need to stamp
        if has_drafts_table and current_version == 'add_drafts_table':
            print("\n⚠️  Migration state mismatch detected!")
            print("The database has the drafts table but the migration chain has changed.")
            print("You need to manually stamp the database to the correct revision.")
            print("\nRun this command:")
            print("  alembic stamp add_draft_sent_status_fields")
            print("\nThen run:")
            print("  alembic upgrade head")
        elif has_unipile_column and current_version in ['add_linkedin_accounts', 'add_drafts_table']:
            print("\n⚠️  Migration state mismatch detected!")
            print("The database has unipile_account_id column but migration history doesn't reflect it.")
            print("You should stamp to add_unipile_account_id:")
            print("  alembic stamp add_unipile_account_id")
            print("\nThen run:")
            print("  alembic upgrade head")

if __name__ == "__main__":
    asyncio.run(check_and_fix_migration_state())

