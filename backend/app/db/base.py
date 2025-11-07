"""Database base configuration."""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Configure SSL for Supabase connections
# SQLAlchemy's asyncpg dialect doesn't handle sslmode in URL correctly,
# so we need to extract it and pass via connect_args
database_url = settings.database_url
connect_args = {}

if "?sslmode=" in database_url or "&sslmode=" in database_url:
    # Extract sslmode from URL and pass via connect_args
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
    # Supabase requires SSL - add it if not in URL
    connect_args['ssl'] = 'require'

# Create async engine with proper connection pooling
# pool_size: number of connections to maintain persistently
# max_overflow: max connections beyond pool_size that can be created
# pool_timeout: seconds to wait for a connection from the pool
# pool_recycle: seconds after which a connection is discarded and replaced
# pool_pre_ping: verify connections before using them (handles stale connections)
engine = create_async_engine(
    database_url,
    echo=True,
    future=True,
    connect_args=connect_args if connect_args else None,
    pool_size=5,  # Maintain 5 persistent connections
    max_overflow=10,  # Allow up to 10 additional connections
    pool_timeout=30,  # Wait up to 30 seconds for a connection
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True,  # Verify connections before using (handles stale connections)
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


async def get_db() -> AsyncSession:
    """
    Dependency for getting database session.
    The pool_pre_ping setting ensures connections are verified before use,
    automatically handling stale connections.
    
    Yields:
        AsyncSession instance
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

