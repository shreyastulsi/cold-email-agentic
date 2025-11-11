"""Search endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.base import get_db
from app.services.unified_messenger.adapter import (
    search_company,
    search_jobs,
    search_recruiters,
    map_jobs_to_recruiters,
    filter_jobs
)

router = APIRouter()


class CompanySearchRequest(BaseModel):
    name: str


class JobsSearchRequest(BaseModel):
    company_ids: List[str]
    job_titles: List[str]
    job_types: Optional[List[str]] = None  # e.g. ["full_time", "internship"]
    company_names: Optional[List[str]] = None
    location_id: Optional[str] = "102571732"
    locations: Optional[List[str]] = None
    location: Optional[str] = None  # Free-text fallback for filtering (deprecated)
    experience_levels: Optional[List[str]] = None  # e.g. ["entry level", "associate"]
    experience_level: Optional[str] = None  # Deprecated single value
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None


class RecruitersSearchRequest(BaseModel):
    company_ids: List[str]


class MapRequest(BaseModel):
    jobs: List[dict]
    recruiters: List[dict]
    max_pairs: Optional[int] = 5


class FilterJobsRequest(BaseModel):
    jobs: List[dict]
    resume_file: Optional[str] = "Resume-Tulsi,Shreyas.pdf"


@router.post("/search/company")
async def search_company_endpoint(
    request: CompanySearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Search for a company. Checks database cache first to avoid API calls."""
    try:
        return await search_company(request.name, db=db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/search/jobs")
async def search_jobs_endpoint(
    request: JobsSearchRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Search for jobs."""
    try:
        print(f"🔎 /search/jobs request payload: {request.dict()}")
        jobs = await search_jobs(
            request.company_ids,
            request.job_titles,
            request.job_types,
            company_names=request.company_names,
            location_id=request.location_id,
            locations=request.locations,
            location=request.location,
            experience_levels=request.experience_levels or ([request.experience_level] if request.experience_level else None),
            salary_min=request.salary_min,
            salary_max=request.salary_max
        )
        print(f"🔎 /search/jobs returning {len(jobs) if jobs else 0} job(s)")
        return {"jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job search failed: {str(e)}")


@router.post("/search/recruiters")
async def search_recruiters_endpoint(
    request: RecruitersSearchRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Search for recruiters."""
    try:
        recruiters = await search_recruiters(request.company_ids)
        return {"recruiters": recruiters}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recruiter search failed: {str(e)}")


@router.post("/search/filter")
async def filter_jobs_endpoint(
    request: FilterJobsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Filter jobs using AI to get top 5 most relevant jobs."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"🔍 DEBUG: filter_jobs_endpoint called with {len(request.jobs) if request.jobs else 0} jobs")
        logger.info(f"🔍 DEBUG: Resume file: {request.resume_file}")
        
        if not request.jobs:
            logger.error("❌ DEBUG: No jobs in request")
            raise HTTPException(status_code=400, detail="No jobs provided in request")
        
        # Get resume content from database (user's edited version)
        from app.services.unified_messenger.resume_content_loader import get_resume_content_from_db
        resume_content = await get_resume_content_from_db(current_user.id, db)
        
        result = await filter_jobs(
            request.jobs,
            request.resume_file,
            resume_content
        )
        
        logger.info(f"🔍 DEBUG: filter_jobs returned. Has error: {'error' in result}, Has filtered_jobs: {'filtered_jobs' in result}")
        
        if 'error' in result:
            logger.error(f"❌ DEBUG: Filter jobs returned error: {result.get('error')}")
            logger.error(f"❌ DEBUG: Debug info: {result.get('debug', {})}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ DEBUG: Exception in filter_jobs_endpoint: {e}")
        import traceback
        traceback_str = traceback.format_exc()
        logger.error(f"❌ DEBUG: Full traceback:\n{traceback_str}")
        raise HTTPException(
            status_code=500, 
            detail=f"Job filtering failed: {str(e)}",
            headers={"X-Debug-Traceback": traceback_str}
        )


@router.post("/search/map")
async def map_jobs_to_recruiters_endpoint(
    request: MapRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Map jobs to best recruiters."""
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"🔍 DEBUG: map_jobs_to_recruiters_endpoint called")
        logger.info(f"🔍 DEBUG: Jobs count: {len(request.jobs) if request.jobs else 0}")
        logger.info(f"🔍 DEBUG: Recruiters count: {len(request.recruiters) if request.recruiters else 0}")
        logger.info(f"🔍 DEBUG: Max pairs: {request.max_pairs}")
        
        # Validate inputs
        if not request.jobs:
            logger.error("❌ DEBUG: No jobs provided in request")
            raise HTTPException(status_code=400, detail="No jobs provided. Please select at least one job.")
        
        if not request.recruiters:
            logger.error("❌ DEBUG: No recruiters provided in request")
            raise HTTPException(status_code=400, detail="No recruiters provided. Please search for recruiters first.")
        
        # Log first job and recruiter structure for debugging
        if request.jobs:
            logger.info(f"🔍 DEBUG: First job structure: {list(request.jobs[0].keys()) if isinstance(request.jobs[0], dict) else type(request.jobs[0])}")
            logger.info(f"🔍 DEBUG: First job title: {request.jobs[0].get('title') if isinstance(request.jobs[0], dict) else 'N/A'}")
        
        if request.recruiters:
            logger.info(f"🔍 DEBUG: First recruiter structure: {list(request.recruiters[0].keys()) if isinstance(request.recruiters[0], dict) else type(request.recruiters[0])}")
            logger.info(f"🔍 DEBUG: First recruiter name: {request.recruiters[0].get('name') if isinstance(request.recruiters[0], dict) else 'N/A'}")
        
        result = await map_jobs_to_recruiters(
            request.jobs,
            request.recruiters,
            request.max_pairs
        )
        
        logger.info(f"🔍 DEBUG: map_jobs_to_recruiters returned")
        logger.info(f"🔍 DEBUG: Result type: {type(result)}")
        logger.info(f"🔍 DEBUG: Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
        logger.info(f"🔍 DEBUG: Mapping count: {len(result.get('mapping', [])) if isinstance(result, dict) else 0}")
        logger.info(f"🔍 DEBUG: Selected recruiters count: {len(result.get('selected_recruiters', [])) if isinstance(result, dict) else 0}")
        
        if isinstance(result, dict):
            if not result.get('mapping') or len(result.get('mapping', [])) == 0:
                logger.warning("⚠️ DEBUG: Mapping returned empty results")
                logger.warning(f"⚠️ DEBUG: Input had {len(request.jobs)} jobs and {len(request.recruiters)} recruiters")
                # Still return the result, let frontend handle it with better error message
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ DEBUG: Exception in map_jobs_to_recruiters_endpoint: {e}")
        traceback_str = traceback.format_exc()
        logger.error(f"❌ DEBUG: Full traceback:\n{traceback_str}")
        raise HTTPException(
            status_code=500, 
            detail=f"Mapping failed: {str(e)}. Check server logs for details.",
            headers={"X-Debug-Traceback": traceback_str}
        )
