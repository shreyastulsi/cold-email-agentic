"""Database seeding script."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.db.models.pipeline_stage import PipelineStage

# Create engine and session
engine = create_async_engine(settings.database_url, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def seed_pipeline_stages():
    """Seed default pipeline stages."""
    async with AsyncSessionLocal() as session:
        # Default stages
        default_stages = [
            {"name": "Prospects", "order_index": 0},
            {"name": "Contacted", "order_index": 1},
            {"name": "Replied", "order_index": 2},
            {"name": "Booked", "order_index": 3}
        ]
        
        # Check if stages already exist
        from sqlalchemy import select
        result = await session.execute(select(PipelineStage))
        existing = result.scalars().all()
        
        if not existing:
            # Create default owner_id (use system/default user)
            default_owner_id = "00000000-0000-0000-0000-000000000000"
            
            for stage_data in default_stages:
                stage = PipelineStage(
                    name=stage_data["name"],
                    order_index=stage_data["order_index"],
                    owner_id=default_owner_id
                )
                session.add(stage)
            
            await session.commit()
            print("✅ Seeded default pipeline stages")
        else:
            print("⚠️  Pipeline stages already exist, skipping seed")


async def main():
    """Main seeding function."""
    print("🌱 Starting database seeding...")
    await seed_pipeline_stages()
    print("✅ Database seeding completed")


if __name__ == "__main__":
    asyncio.run(main())

