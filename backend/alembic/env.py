"""Alembic environment configuration."""
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.db.base import Base
from app.db.models import *  # Import all models

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# set the sqlalchemy.url from settings
config.set_main_option("sqlalchemy.url", settings.database_url)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Configure SSL for Supabase connections
    database_url = settings.database_url
    connect_args = {}
    
    # Remove sslmode from URL if present (SQLAlchemy will try to pass it as keyword arg)
    if "?sslmode=" in database_url or "&sslmode=" in database_url:
        # Extract sslmode value
        import urllib.parse
        parsed = urllib.parse.urlparse(database_url)
        query_params = urllib.parse.parse_qs(parsed.query)
        
        if 'sslmode' in query_params:
            sslmode_value = query_params['sslmode'][0]
            # Remove sslmode from query params
            query_params.pop('sslmode')
            # Rebuild URL without sslmode
            new_query = urllib.parse.urlencode(query_params, doseq=True)
            new_url = urllib.parse.urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, new_query, parsed.fragment
            ))
            database_url = new_url
            # Pass SSL mode to asyncpg via connect_args
            connect_args['ssl'] = sslmode_value
        elif "supabase.co" in database_url:
            # If Supabase but no sslmode, add it
            connect_args['ssl'] = 'require'
    elif "supabase.co" in database_url:
        # Supabase requires SSL
        connect_args['ssl'] = 'require'
    
    connectable = create_async_engine(
        database_url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())

