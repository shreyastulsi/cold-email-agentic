"""Service helpers for storing and retrieving job contexts."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_context import JobContext


async def upsert_job_context(
    db: AsyncSession,
    *,
    job_url: str,
    title: Optional[str],
    company: Optional[str],
    employment_type: Optional[str],
    condensed_description: Optional[str],
    requirements: Optional[List[str]],
    technologies: Optional[List[str]],
    responsibilities: Optional[List[str]],
    raw_payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Create or update a job context row."""
    stmt = insert(JobContext).values(
        job_url=job_url,
        title=title,
        company=company,
        employment_type=employment_type,
        condensed_description=condensed_description,
        requirements=requirements,
        technologies=technologies,
        responsibilities=responsibilities,
        raw_payload=raw_payload,
    )

    update_columns = {
        "title": stmt.excluded.title,
        "company": stmt.excluded.company,
        "employment_type": stmt.excluded.employment_type,
        "condensed_description": stmt.excluded.condensed_description,
        "requirements": stmt.excluded.requirements,
        "technologies": stmt.excluded.technologies,
        "responsibilities": stmt.excluded.responsibilities,
        "raw_payload": stmt.excluded.raw_payload,
    }

    stmt = stmt.on_conflict_do_update(
        index_elements=[JobContext.job_url],
        set_=update_columns,
    )

    await db.execute(stmt)


async def get_job_context_by_url(
    db: AsyncSession, job_url: str
) -> Optional[JobContext]:
    """Fetch a job context by URL."""
    stmt = select(JobContext).where(JobContext.job_url == job_url)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_job_context_by_url(db: AsyncSession, job_url: str) -> None:
    """Delete a stored job context."""
    stmt = delete(JobContext).where(JobContext.job_url == job_url)
    await db.execute(stmt)

