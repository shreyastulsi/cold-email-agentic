"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title="Cold Email API",
    description="Full-stack cold email outreach platform",
    version="1.0.0"
)

# CORS middleware - MUST be added before other middleware
# Ensure CORS origins includes frontend URL
cors_origins = settings.cors_origins if settings.cors_origins else ["http://localhost:5173"]
if "http://localhost:5173" not in cors_origins:
    cors_origins.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Health check endpoint
@app.get("/healthz")
async def health_check():
    """Health check endpoint."""
    return {"ok": True}

# Include API router
app.include_router(api_router, prefix=settings.api_v1_prefix)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

