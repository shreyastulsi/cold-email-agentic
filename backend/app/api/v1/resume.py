"""Resume upload endpoints."""
import os
import shutil
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.resume_content import ResumeContent
from app.db.base import get_db
from app.services.unified_messenger.clients import get_messenger

router = APIRouter()


class ResumeContentUpdate(BaseModel):
    content: str

# Directory to store uploaded resumes
RESUMES_DIR = Path("uploads/resumes")
RESUMES_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a resume PDF file."""
    
    # Validate file type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Validate file size (10MB limit)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")
    
    # Save file with user-specific name
    # Use a standard name so it can be found later
    filename = "Resume-Tulsi,Shreyas.pdf"  # Keep same name for compatibility
    file_path = RESUMES_DIR / filename
    
    # Save the file
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    
    # Also save to ananya folder for compatibility with existing code
    ananya_path = Path("ananya") / filename
    ananya_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(file_path, ananya_path)
    
    # Also save to backend root for immediate access
    backend_path = Path("backend") / filename
    backend_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(file_path, backend_path)
    
    # Extract resume content from PDF and parse into key bullets
    extracted_content = None
    try:
        messenger = get_messenger()
        if messenger and messenger.resume_generator:
            # First, load raw text from PDF
            raw_resume_content = messenger.resume_generator.load_resume(str(file_path))
            print(f"✅ Loaded raw resume content ({len(raw_resume_content)} characters)")
            
            # Then, extract key bullets using ResumeParser
            from app.services.unified_messenger.resume_parser import ResumeParser
            resume_parser = ResumeParser()
            extracted_content = resume_parser.extract_key_bullets(raw_resume_content)
            print(f"✅ Extracted resume bullets ({len(extracted_content)} characters)")
            
            # Also extract structured data (parse once and store)
            structured_data = resume_parser.extract_structured_data(raw_resume_content)
            print(f"✅ Parsed resume into structured data:")
            import json
            print(json.dumps(structured_data, indent=2))
            
            # Clear cache so it doesn't interfere
            messenger.resume_generator.clear_resume_cache()
    except Exception as e:
        print(f"⚠️  Could not extract resume content: {e}")
        import traceback
        print(f"⚠️  Traceback: {traceback.format_exc()}")
        # Continue even if extraction fails
    
    # Save or update resume content in database
    if extracted_content:
        try:
            # Check if resume content already exists for this user
            result = await db.execute(
                select(ResumeContent).where(ResumeContent.owner_id == current_user.id)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing content and structured data
                existing.content = extracted_content
                existing.structured_data = structured_data if 'structured_data' in locals() else None
                from datetime import datetime
                existing.updated_at = datetime.utcnow()
                print(f"✅ Updated existing resume content for user {current_user.id}")
            else:
                # Create new content with structured data
                resume_content = ResumeContent(
                    owner_id=current_user.id,
                    content=extracted_content,
                    structured_data=structured_data if 'structured_data' in locals() else None
                )
                db.add(resume_content)
                print(f"✅ Created new resume content for user {current_user.id}")
            
            await db.commit()
            print("✅ Resume content and structured data saved to database")
        except Exception as e:
            await db.rollback()
            print(f"⚠️  Could not save resume content to database: {e}")
            # Don't fail the upload if database save fails
    
    return {
        "message": "Resume uploaded successfully",
        "filename": filename,
        "size": len(contents),
        "path": str(file_path),
        "content_extracted": extracted_content is not None,
        "content_length": len(extracted_content) if extracted_content else 0
    }


@router.get("/resume/content")
async def get_resume_content(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get extracted resume content for editing."""
    result = await db.execute(
        select(ResumeContent).where(ResumeContent.owner_id == current_user.id)
    )
    resume_content = result.scalar_one_or_none()
    
    if not resume_content:
        raise HTTPException(status_code=404, detail="No resume content found. Please upload a resume first.")
    
    return {
        "content": resume_content.content,
        "created_at": resume_content.created_at.isoformat() if resume_content.created_at else None,
        "updated_at": resume_content.updated_at.isoformat() if resume_content.updated_at else None,
        "content_length": len(resume_content.content)
    }


@router.put("/resume/content")
async def update_resume_content(
    request: ResumeContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update resume content after editing."""
    result = await db.execute(
        select(ResumeContent).where(ResumeContent.owner_id == current_user.id)
    )
    resume_content = result.scalar_one_or_none()
    
    # Re-parse the edited content to update structured data
    structured_data = None
    try:
        from app.services.unified_messenger.resume_parser import ResumeParser
        resume_parser = ResumeParser()
        structured_data = resume_parser.extract_structured_data(request.content)
        print(f"✅ Re-parsed edited resume into structured data")
    except Exception as e:
        print(f"⚠️  Could not parse edited resume content: {e}")
    
    if not resume_content:
        # Create new if doesn't exist
        resume_content = ResumeContent(
            owner_id=current_user.id,
            content=request.content,
            structured_data=structured_data
        )
        db.add(resume_content)
    else:
        # Update existing
        resume_content.content = request.content
        resume_content.structured_data = structured_data
        from datetime import datetime
        resume_content.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(resume_content)
    
    return {
        "message": "Resume content updated successfully",
        "content_length": len(request.content),
        "updated_at": resume_content.updated_at.isoformat() if resume_content.updated_at else None
    }


@router.delete("/resume/content")
async def delete_resume_content(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete resume content from database."""
    result = await db.execute(
        select(ResumeContent).where(ResumeContent.owner_id == current_user.id)
    )
    resume_content = result.scalar_one_or_none()
    
    if not resume_content:
        raise HTTPException(status_code=404, detail="No resume content found to delete.")
    
    # Delete the record
    await db.execute(
        delete(ResumeContent).where(ResumeContent.owner_id == current_user.id)
    )
    await db.commit()
    
    return {
        "message": "Resume content deleted successfully",
        "deleted_at": datetime.utcnow().isoformat()
    }


@router.get("/resume/status")
async def get_resume_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if a resume has been uploaded and if content is extracted."""
    
    # Check database for extracted content
    result = await db.execute(
        select(ResumeContent).where(ResumeContent.owner_id == current_user.id)
    )
    resume_content = result.scalar_one_or_none()
    
    # Check multiple possible locations for PDF file
    possible_paths = [
        RESUMES_DIR / "Resume-Tulsi,Shreyas.pdf",
        Path("ananya/Resume-Tulsi,Shreyas.pdf"),
        Path("backend/Resume-Tulsi,Shreyas.pdf"),
        Path("Resume-Tulsi,Shreyas.pdf"),
    ]
    
    pdf_path = None
    for path in possible_paths:
        if path.exists():
            pdf_path = path
            break
    
    return {
        "uploaded": pdf_path is not None,
        "content_extracted": resume_content is not None,
        "filename": pdf_path.name if pdf_path else None,
        "size": pdf_path.stat().st_size if pdf_path else None,
        "path": str(pdf_path) if pdf_path else None,
        "content_length": len(resume_content.content) if resume_content else None,
        "has_edited_content": resume_content is not None and resume_content.updated_at is not None
    }


@router.get("/resume/structured")
async def get_structured_resume_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get structured resume data (JSON format with all sections)."""
    import json
    
    # Check database for extracted content
    result = await db.execute(
        select(ResumeContent).where(ResumeContent.owner_id == current_user.id)
    )
    resume_content = result.scalar_one_or_none()
    
    if not resume_content:
        raise HTTPException(status_code=404, detail="No resume content found. Please upload a resume first.")
    
    # Check multiple possible locations for PDF file
    possible_paths = [
        RESUMES_DIR / "Resume-Tulsi,Shreyas.pdf",
        Path("ananya/Resume-Tulsi,Shreyas.pdf"),
        Path("backend/Resume-Tulsi,Shreyas.pdf"),
        Path("Resume-Tulsi,Shreyas.pdf"),
    ]
    
    pdf_path = None
    for path in possible_paths:
        if path.exists():
            pdf_path = path
            break
    
    if not pdf_path:
        raise HTTPException(status_code=404, detail="Resume PDF not found. Please upload a resume first.")
    
    try:
        # Load raw resume content from PDF
        messenger = get_messenger()
        if not messenger or not messenger.resume_generator:
            raise HTTPException(status_code=500, detail="Resume generator not available")
        
        raw_resume_content = messenger.resume_generator.load_resume(str(pdf_path))
        
        # Parse structured data
        from app.services.unified_messenger.resume_parser import ResumeParser
        resume_parser = ResumeParser()
        structured_data = resume_parser.get_structured_resume_data(raw_resume_content)
        
        return {
            "structured_data": structured_data,
            "parsed_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        print(f"❌ Error getting structured resume data: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to parse structured resume data: {str(e)}")

