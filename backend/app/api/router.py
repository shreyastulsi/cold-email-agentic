"""API router configuration."""
from fastapi import APIRouter
from app.api.v1 import auth, linkedin, search, outreach, templates, pipeline, resume, verbose, email_accounts

api_router = APIRouter()

# Include v1 routers (no additional prefix since main.py already adds /api/v1)
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(linkedin.router, tags=["linkedin"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(outreach.router, tags=["outreach"])
api_router.include_router(templates.router, tags=["templates"])
api_router.include_router(pipeline.router, tags=["pipeline"])
api_router.include_router(resume.router, tags=["resume"])
api_router.include_router(verbose.router, tags=["verbose"])
api_router.include_router(email_accounts.router, tags=["email-accounts"])

