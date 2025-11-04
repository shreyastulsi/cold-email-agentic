"""Adapter layer for UnifiedMessenger - wraps methods as async functions."""
import asyncio
import os
from typing import Dict, List, Optional, Any
from .clients import get_messenger

# Import verbose logger
try:
    from app.services.verbose_logger import verbose_logger
    VERBOSE_LOGGING = True
except ImportError:
    VERBOSE_LOGGING = False
    verbose_logger = None

async def emit_verbose_log(message: str, level: str = "info", emoji: str = ""):
    """Helper to emit verbose logs."""
    if VERBOSE_LOGGING and verbose_logger:
        await verbose_logger.log(message, level, emoji)


async def linkedin_url_to_provider_id(url: str) -> Dict[str, Any]:
    """
    Convert LinkedIn URL to Provider ID.
    
    Args:
        url: LinkedIn profile URL
        
    Returns:
        Dict with provider_id and user_meta
    """
    messenger = get_messenger()
    
    # Run in thread pool since this is synchronous code
    loop = asyncio.get_event_loop()
    provider_id, user_info = await loop.run_in_executor(
        None,
        messenger.get_provider_id_from_linkedin_url,
        url
    )
    
    if provider_id:
        return {
            "provider_id": provider_id,
            "user_meta": user_info
        }
    else:
        return {
            "provider_id": None,
            "user_meta": None
        }


async def find_existing_chat(name: str) -> Dict[str, Any]:
    """
    Find existing chat by name.
    
    Args:
        name: Person's name to search for
        
    Returns:
        Dict with chat_id and user_id
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    chat_id, user_id = await loop.run_in_executor(
        None,
        messenger.find_existing_chat_by_name,
        name
    )
    
    return {
        "chat_id": chat_id,
        "user_id": user_id
    }


async def send_message_existing(chat_id: str, text: str) -> Dict[str, Any]:
    """
    Send message to existing chat.
    
    Args:
        chat_id: Chat ID
        text: Message text
        
    Returns:
        Dict with success status and result/error
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    success, result = await loop.run_in_executor(
        None,
        messenger.send_message_to_existing_chat,
        chat_id,
        text
    )
    
    if success:
        return {
            "success": True,
            "result": result
        }
    else:
        return {
            "success": False,
            "error": result
        }


async def send_message_new(provider_id: str, text: str, inmail: bool = False) -> Dict[str, Any]:
    """
    Send message to new user.
    
    Args:
        provider_id: Provider ID
        text: Message text
        inmail: Whether to use InMail
        
    Returns:
        Dict with success status and result/error
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    success, result = await loop.run_in_executor(
        None,
        messenger.send_message_to_new_user,
        provider_id,
        text,
        inmail
    )
    
    if success:
        return {
            "success": True,
            "result": result
        }
    else:
        return {
            "success": False,
            "error": result
        }


async def send_invitation(provider_id: str, text: str) -> Dict[str, Any]:
    """
    Send LinkedIn connection invitation.
    
    Args:
        provider_id: Provider ID
        text: Invitation message
        
    Returns:
        Dict with success status and result/error
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    success, result = await loop.run_in_executor(
        None,
        messenger.send_invitation,
        provider_id,
        text
    )
    
    if success:
        return {
            "success": True,
            "result": result
        }
    else:
        return {
            "success": False,
            "error": result
        }


async def search_company(name: str) -> Dict[str, Any]:
    """
    Search for a company.
    
    Args:
        name: Company name
        
    Returns:
        Dict with company_id and company info
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    company_id, company_info = await loop.run_in_executor(
        None,
        messenger.search_company,
        name
    )
    
    return {
        "company_id": company_id,
        "company": company_info
    }


async def search_jobs(
    company_ids: List[str],
    job_titles: List[str],
    job_type: str,
    location_id: str = "102571732"
) -> List[Dict[str, Any]]:
    """
    Search for jobs.
    
    Args:
        company_ids: List of company IDs
        job_titles: List of job titles
        job_type: "full_time" or "internship"
        location_id: Location ID (default: 102571732)
        
    Returns:
        List of job dictionaries
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    jobs = await loop.run_in_executor(
        None,
        messenger.search_jobs,
        company_ids,
        job_titles,
        job_type,
        location_id
    )
    
    return jobs


async def filter_jobs(
    jobs: List[Dict[str, Any]], 
    resume_file: str = "Resume-Tulsi,Shreyas.pdf",
    resume_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    Filter jobs using AI to get top 2 most relevant jobs (testing mode).
    
    Args:
        jobs: List of job dictionaries
        resume_file: Path to resume file (fallback if resume_content not provided)
        resume_content: Resume content from database (preferred over PDF)
        
    Returns:
        Dict with filtered_jobs (top 2) and ranking analysis
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        await emit_verbose_log("🎯 Starting AI Job Filtering Process...", "info", "🎯")
        await emit_verbose_log(f"   Analyzing {len(jobs) if jobs else 0} jobs against resume", "info", "📊")
        logger.info(f"🔍 DEBUG: Starting filter_jobs with {len(jobs) if jobs else 0} jobs")
        logger.info(f"🔍 DEBUG: Resume file path: {resume_file}")
        
        if not jobs or len(jobs) == 0:
            await emit_verbose_log("❌ No jobs provided to filter", "error", "❌")
            logger.error("❌ DEBUG: No jobs provided to filter")
            return {
                "error": "No jobs provided to filter",
                "filtered_jobs": [],
                "debug": "No jobs in input"
            }
        
        await emit_verbose_log("🔍 Loading job filter engine...", "info", "🔍")
        logger.info(f"🔍 DEBUG: Getting messenger instance...")
        messenger = get_messenger()
        logger.info(f"✅ DEBUG: Messenger instance obtained")
        
        # Get the job filter instance
        logger.info(f"🔍 DEBUG: Getting job_filter from messenger...")
        if not hasattr(messenger, 'job_filter') or messenger.job_filter is None:
            await emit_verbose_log("❌ Job filter not available", "error", "❌")
            logger.error("❌ DEBUG: messenger.job_filter is None or not available")
            return {
                "error": "Job filter not available on messenger instance",
                "filtered_jobs": [],
                "debug": "job_filter attribute missing or None"
            }
        
        job_filter = messenger.job_filter
        logger.info(f"✅ DEBUG: Job filter obtained: {type(job_filter)}")
        
        await emit_verbose_log("🚀 Starting job scraping and analysis...", "info", "🚀")
        logger.info(f"🔍 DEBUG: Running filter_jobs in executor...")
        logger.info(f"🔍 DEBUG: Resume content provided: {resume_content is not None}")
        loop = asyncio.get_event_loop()
        ranking_result, top_urls = await loop.run_in_executor(
            None,
            job_filter.filter_jobs,
            jobs,
            resume_file,
            resume_content
        )
        
        await emit_verbose_log(f"📝 Condensing job descriptions with AI...", "info", "📝")
        await emit_verbose_log(f"🤖 Analyzing job-relevance using LLM...", "info", "🤖")
        
        if top_urls and len(top_urls) > 0:
            await emit_verbose_log(f"✅ Filtering complete: Found {len(top_urls)} top job(s)", "success", "✅")
        
        logger.info(f"🔍 DEBUG: filter_jobs returned")
        logger.info(f"🔍 DEBUG: ranking_result is None: {ranking_result is None}")
        logger.info(f"🔍 DEBUG: top_urls is None: {top_urls is None}")
        logger.info(f"🔍 DEBUG: top_urls type: {type(top_urls).__name__ if top_urls is not None else 'None'}")
        logger.info(f"🔍 DEBUG: top_urls length: {len(top_urls) if top_urls else 0}")
        logger.info(f"🔍 DEBUG: top_urls value: {top_urls}")
        
        # Check if ranking_result is None or empty string
        ranking_is_valid = ranking_result is not None and (not isinstance(ranking_result, str) or len(ranking_result.strip()) > 0)
        
        # Check if top_urls is None or empty list
        urls_is_valid = top_urls is not None and (isinstance(top_urls, list) and len(top_urls) > 0)
        
        logger.info(f"🔍 DEBUG: ranking_is_valid: {ranking_is_valid}")
        logger.info(f"🔍 DEBUG: urls_is_valid: {urls_is_valid}")
        
        if not ranking_is_valid or not urls_is_valid:
            error_msg = f"Failed to filter jobs - ranking_result valid: {ranking_is_valid}, top_urls valid: {urls_is_valid}"
            
            # Provide more helpful error messages
            if ranking_result is None:
                if not resume_content:
                    error_msg += ". Possible causes: Resume content not found (check if resume is uploaded), or LLM call failed (check OPENAI_API_KEY)."
                else:
                    error_msg += ". LLM ranking returned None - check OPENAI_API_KEY and prompt length."
            elif isinstance(ranking_result, str) and len(ranking_result.strip()) == 0:
                error_msg += ". LLM returned empty ranking."
            
            if top_urls is None or (isinstance(top_urls, list) and len(top_urls) == 0):
                if ranking_result:
                    error_msg += " Ranking result exists but URL extraction failed - check ranking format."
                else:
                    error_msg += " No URLs extracted because ranking failed."
            
            logger.error(f"❌ DEBUG: {error_msg}")
            logger.error(f"❌ DEBUG: ranking_result type: {type(ranking_result).__name__ if ranking_result is not None else 'None'}")
            logger.error(f"❌ DEBUG: ranking_result preview: {str(ranking_result)[:500] if ranking_result else 'None'}")
            logger.error(f"❌ DEBUG: top_urls type: {type(top_urls).__name__ if top_urls is not None else 'None'}")
            logger.error(f"❌ DEBUG: top_urls value: {top_urls}")
            logger.error(f"❌ DEBUG: resume_content was provided: {resume_content is not None}")
            if resume_content:
                logger.error(f"❌ DEBUG: resume_content length: {len(resume_content)} chars")
            else:
                logger.error(f"❌ DEBUG: No resume_content - PDF fallback may have failed")
            
            return {
                "error": error_msg,
                "filtered_jobs": [],
                "debug": {
                    "ranking_result_is_none": ranking_result is None,
                    "ranking_result_is_empty": isinstance(ranking_result, str) and len(ranking_result.strip()) == 0 if ranking_result is not None else False,
                    "top_urls_is_none": top_urls is None,
                    "top_urls_is_empty": isinstance(top_urls, list) and len(top_urls) == 0 if top_urls is not None else False,
                    "ranking_result_type": type(ranking_result).__name__ if ranking_result is not None else None,
                    "top_urls_type": type(top_urls).__name__ if top_urls is not None else None,
                    "top_urls_value": top_urls if top_urls is not None else None,
                    "ranking_result_preview": str(ranking_result)[:500] if ranking_result else None,
                    "resume_content_provided": resume_content is not None,
                    "resume_content_length": len(resume_content) if resume_content else None
                }
            }
        
        # Filter jobs to only include top 5 URLs
        logger.info(f"🔍 DEBUG: Filtering jobs by URLs. Total jobs: {len(jobs)}, Top URLs: {len(top_urls)}")
        filtered_jobs = [job for job in jobs if job.get('url') in top_urls]
        logger.info(f"✅ DEBUG: Filtered to {len(filtered_jobs)} jobs")
        
        return {
            "filtered_jobs": filtered_jobs,
            "ranking": ranking_result,
            "top_urls": top_urls,
            "debug": {
                "input_jobs_count": len(jobs),
                "top_urls_count": len(top_urls),
                "filtered_jobs_count": len(filtered_jobs)
            }
        }
    except Exception as e:
        logger.exception(f"❌ DEBUG: Exception in filter_jobs: {e}")
        import traceback
        traceback_str = traceback.format_exc()
        logger.error(f"❌ DEBUG: Full traceback:\n{traceback_str}")
        return {
            "error": f"Failed to filter jobs: {str(e)}",
            "filtered_jobs": [],
            "debug": {
                "exception_type": type(e).__name__,
                "exception_message": str(e),
                "traceback": traceback_str
            }
        }


async def search_recruiters(company_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Search for recruiters.
    
    Args:
        company_ids: List of company IDs
        
    Returns:
        List of recruiter dictionaries
    """
    await emit_verbose_log("🔍 Searching for recruiters...", "info", "🔍")
    await emit_verbose_log(f"   Companies: {len(company_ids)}", "info", "📊")
    
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    recruiters = await loop.run_in_executor(
        None,
        messenger.search_recruiters,
        company_ids,
        "recruiter"
    )
    
    await emit_verbose_log(f"✅ Found {len(recruiters)} recruiters", "success", "✅")
    
    return recruiters


async def map_jobs_to_recruiters(
    jobs: List[Dict[str, Any]],
    recruiters: List[Dict[str, Any]],
    max_pairs: int = 5
) -> Dict[str, Any]:
    """
    Map jobs to best recruiters.
    
    Args:
        jobs: List of job dictionaries
        recruiters: List of recruiter dictionaries
        max_pairs: Maximum number of pairs
        
    Returns:
        Dict with mapping and selected_recruiters
    """
    import logging
    logger = logging.getLogger(__name__)
    
    await emit_verbose_log(f"🔗 Starting job-to-recruiter mapping...", "info", "🔗")
    await emit_verbose_log(f"   Input: {len(jobs)} jobs, {len(recruiters)} recruiters, max_pairs={max_pairs}", "info", "📊")
    
    logger.info(f"🔍 DEBUG: adapter.map_jobs_to_recruiters called with {len(jobs)} jobs, {len(recruiters)} recruiters, max_pairs={max_pairs}")
    
    if not jobs:
        await emit_verbose_log("❌ No jobs provided for mapping", "error", "❌")
        logger.warning("⚠️ DEBUG: No jobs provided to map_jobs_to_recruiters")
        return {"mapping": [], "selected_recruiters": []}
    
    if not recruiters:
        await emit_verbose_log("❌ No recruiters provided for mapping", "error", "❌")
        logger.warning("⚠️ DEBUG: No recruiters provided to map_jobs_to_recruiters")
        return {"mapping": [], "selected_recruiters": []}
    
    try:
        await emit_verbose_log("🔍 Analyzing job and recruiter compatibility...", "info", "🔍")
        messenger = get_messenger()
        
        await emit_verbose_log("🤖 Computing best matches using AI scoring...", "info", "🤖")
        loop = asyncio.get_event_loop()
        selected_recruiters, mapping = await loop.run_in_executor(
            None,
            messenger.map_jobs_to_recruiters,
            jobs,
            recruiters,
            max_pairs
        )
        
        await emit_verbose_log(f"✅ Mapping complete: {len(mapping)} pairs created", "success", "✅")
        await emit_verbose_log(f"   Selected {len(selected_recruiters)} unique recruiters", "success", "👥")
        
        logger.info(f"🔍 DEBUG: map_jobs_to_recruiters returned {len(mapping)} mappings and {len(selected_recruiters)} selected recruiters")
        
        if not mapping:
            await emit_verbose_log("⚠️ Warning: No mappings created", "warning", "⚠️")
            logger.warning(f"⚠️ DEBUG: Mapping returned empty list. Jobs: {len(jobs)}, Recruiters: {len(recruiters)}")
        
        # Log each mapping
        for i, map_item in enumerate(mapping, 1):
            job_title = map_item.get('job_title', 'Unknown')
            job_company = map_item.get('job_company', 'Unknown')
            recruiter_name = map_item.get('recruiter_name', 'Unknown')
            recruiter_company = map_item.get('recruiter_company', 'Unknown')
            await emit_verbose_log(f"   {i}. {job_title} @ {job_company} → {recruiter_name} @ {recruiter_company}", "success", "🧩")
        
        return {
            "mapping": mapping,
            "selected_recruiters": selected_recruiters
        }
    except Exception as e:
        await emit_verbose_log(f"❌ Error during mapping: {str(e)}", "error", "❌")
        logger.error(f"❌ DEBUG: Exception in map_jobs_to_recruiters adapter: {e}")
        import traceback
        logger.error(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
        raise


async def extract_emails_for_recruiters(recruiters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract emails for recruiters using Apollo API.
    
    Args:
        recruiters: List of recruiter dictionaries
        
    Returns:
        List of recruiters with extracted_email field
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    recruiters_with_emails = await loop.run_in_executor(
        None,
        messenger.extract_emails_for_recruiters,
        recruiters
    )
    
    return recruiters_with_emails


async def generate_email(
    job_titles: List[str],
    job_type: str,
    recruiter: Dict[str, Any],
    resume_content: Optional[str] = None
) -> Dict[str, str]:
    """
    Generate email content for recruiter.
    
    Args:
        job_titles: List of job titles
        job_type: "full_time" or "internship"
        recruiter: Recruiter dictionary
        resume_content: Resume content from database (preferred over PDF)
        
    Returns:
        Dict with subject and body
    """
    messenger = get_messenger()
    
    # Use provided resume content, or fallback to loading from PDF
    if not resume_content and messenger.resume_generator:
        try:
            resume_file = "Resume-Tulsi,Shreyas.pdf"
            if os.path.exists(resume_file):
                resume_content = messenger.resume_generator.load_resume(resume_file)
        except Exception:
            pass
    
    loop = asyncio.get_event_loop()
    subject, body = await loop.run_in_executor(
        None,
        messenger.generate_email_content,
        job_titles,
        job_type,
        recruiter,
        resume_content
    )
    
    return {
        "subject": subject,
        "body": body
    }


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    email_account: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Send email via SMTP or OAuth (Gmail/Outlook API).
    
    Args:
        to_email: Recipient email
        subject: Email subject
        body: Email body
        email_account: Optional EmailAccount model instance
        
    Returns:
        Dict with success status and result/error
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    
    # If email_account provided, use it; otherwise use default SMTP from env
    if email_account:
        success, result = await loop.run_in_executor(
            None,
            messenger.send_email_with_account,
            to_email,
            subject,
            body,
            email_account
        )
    else:
        success, result = await loop.run_in_executor(
            None,
            messenger.send_email,
            to_email,
            subject,
            body
        )
    
    if success:
        return {
            "success": True,
            "result": result
        }
    else:
        return {
            "success": False,
            "error": result
        }


async def email_only_outreach(
    recruiters: List[Dict[str, Any]],
    job_titles: List[str],
    job_type: str
) -> Dict[str, Any]:
    """
    Execute email-only outreach campaign.
    
    Args:
        recruiters: List of recruiter dictionaries
        job_titles: List of job titles
        job_type: "full_time" or "internship"
        
    Returns:
        Summary dictionary
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        messenger.email_only_outreach,
        recruiters,
        job_titles,
        job_type
    )
    
    # Return summary - in production, track actual results
    return {
        "status": "completed",
        "message": "Email-only outreach completed"
    }


async def enhanced_dual_outreach(
    recruiters: List[Dict[str, Any]],
    job_titles: List[str],
    job_type: str
) -> Dict[str, Any]:
    """
    Execute enhanced dual outreach campaign (LinkedIn + Email).
    
    Args:
        recruiters: List of recruiter dictionaries
        job_titles: List of job titles
        job_type: "full_time" or "internship"
        
    Returns:
        Summary dictionary
    """
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        messenger.enhanced_dual_outreach,
        recruiters,
        job_titles,
        job_type
    )
    
    # Return summary - in production, track actual results
    return {
        "status": "completed",
        "message": "Enhanced dual outreach completed"
    }


async def generate_linkedin_message(
    recruiter: Dict[str, Any],
    job_title: str,
    company_name: str,
    resume_content: Optional[str] = None,
    resume_file: str = "Resume-Tulsi,Shreyas.pdf"
) -> str:
    """
    Generate personalized LinkedIn message for a recruiter-job pair.
    
    Args:
        recruiter: Recruiter dictionary with name and company
        job_title: Job title string
        company_name: Company name string
        resume_content: Resume content from database (preferred over PDF)
        resume_file: Path to resume file (fallback if resume_content not provided)
        
    Returns:
        Generated LinkedIn message (280-295 characters)
    """
    messenger = get_messenger()
    
    if not messenger.resume_generator:
        raise ValueError("Resume generator not available")
    
    # Use provided resume content, or fallback to loading from PDF
    if not resume_content:
        try:
            # Try multiple paths for resume file
            resume_paths = [
                resume_file,
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), resume_file),
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ananya", resume_file),
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), resume_file),
            ]
            
            resume_path = None
            for path in resume_paths:
                if os.path.exists(path):
                    resume_path = path
                    break
            
            if resume_path:
                resume_content = messenger.resume_generator.load_resume(resume_path)
        except Exception as e:
            # If resume can't be loaded, use generic message
            recruiter_name = recruiter.get('name', 'Hiring Manager')
            return f"Dear {recruiter_name}, I'm interested in {job_title} opportunities at {company_name}. I'd love to connect and discuss potential roles that align with my background."
    
    recruiter_name = recruiter.get('name', 'Hiring Manager')
    
    loop = asyncio.get_event_loop()
    message = await loop.run_in_executor(
        None,
        messenger.resume_generator.generate_message,
        resume_content,
        recruiter_name,
        job_title,
        company_name
    )
    
    return message


async def send_linkedin_invitation(
    linkedin_url: str,
    message: str
) -> Dict[str, Any]:
    """
    Send LinkedIn connection invitation.
    
    Args:
        linkedin_url: LinkedIn profile URL
        message: Invitation message
        
    Returns:
        Dict with success status and result/error
    """
    messenger = get_messenger()
    
    # Convert LinkedIn URL to Provider ID
    loop = asyncio.get_event_loop()
    provider_id, user_info = await loop.run_in_executor(
        None,
        messenger.get_provider_id_from_linkedin_url,
        linkedin_url
    )
    
    if not provider_id:
        return {
            "success": False,
            "error": "Could not convert LinkedIn URL to Provider ID"
        }
    
    # Send invitation
    success, result = await loop.run_in_executor(
        None,
        messenger.send_invitation,
        provider_id,
        message
    )
    
    if success:
        return {
            "success": True,
            "result": result
        }
    else:
        return {
            "success": False,
            "error": result
        }

