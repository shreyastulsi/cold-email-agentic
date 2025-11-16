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


async def linkedin_url_to_provider_id(url: str, account_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Convert LinkedIn URL to Provider ID.
    
    Args:
        url: LinkedIn profile URL
        account_id: Optional Unipile account ID to use for the lookup
        
    Returns:
        Dict with provider_id and user_meta
    """
    messenger = get_messenger()
    
    # Run in thread pool since this is synchronous code
    loop = asyncio.get_event_loop()
    provider_id, user_info = await loop.run_in_executor(
        None,
        messenger.get_provider_id_from_linkedin_url,
        url,
        account_id
    )
    
    if provider_id:
        return {
            "provider_id": provider_id,
            "user_meta": user_info
        }
    else:
        return {
            "provider_id": None,
            "user_meta": None,
            "error": "Failed to convert LinkedIn URL to provider_id. The URL may be invalid or the user may not be accessible."
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


async def send_invitation(provider_id: str, text: str, user_id: Optional[str] = None, db: Optional[Any] = None, linkedin_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Send LinkedIn connection invitation via Unipile API.
    
    Uses user's connected Unipile account ID if available, otherwise falls back to default.
    
    Args:
        provider_id: Provider ID of the recipient
        text: Invitation message
        user_id: User ID (optional, but recommended for using user's account)
        db: Database session (optional, needed if user_id is provided)
        linkedin_url: Optional LinkedIn profile URL (not used, kept for compatibility)
        
    Returns:
        Dict with success status and result/error
    """
    import os
    
    try:
        from app.core.config import settings
        from app.db.models.linkedin_account import LinkedInAccount
        from sqlalchemy import select
        from datetime import datetime
        
        # Validate provider_id first
        if not provider_id:
            return {
                "success": False,
                "error": "Provider ID is required but was not provided. Please check the LinkedIn URL is valid.",
                "method": "unipile"
            }
        
        # Determine which Unipile account ID to use
        unipile_account_id = None
        linkedin_account = None
        
        # If user_id and db are provided, try to get user's connected LinkedIn account
        if user_id and db:
            # First, try to get active account with Unipile account ID (prioritize default)
            result = await db.execute(
                select(LinkedInAccount)
                .where(LinkedInAccount.owner_id == user_id)
                .where(LinkedInAccount.is_active == True)
                .where(LinkedInAccount.unipile_account_id.isnot(None))
                .order_by(LinkedInAccount.is_default.desc(), LinkedInAccount.created_at.desc())
                .limit(1)
            )
            linkedin_account = result.scalar_one_or_none()
            
            if linkedin_account and linkedin_account.unipile_account_id:
                unipile_account_id = linkedin_account.unipile_account_id
                print(f"✅ Using user's active LinkedIn account (ID: {linkedin_account.id}, Unipile: {unipile_account_id})")
            else:
                # Check if user has any LinkedIn accounts (to provide better error message)
                result = await db.execute(
                    select(LinkedInAccount)
                    .where(LinkedInAccount.owner_id == user_id)
                    .limit(1)
                )
                any_account = result.scalar_one_or_none()
                
                if any_account:
                    if not any_account.is_active:
                        print(f"⚠️  User has LinkedIn account but it's not active (ID: {any_account.id})")
                        return {
                            "success": False,
                            "error": "Your LinkedIn account is not active. Please enable it in Settings > LinkedIn Accounts.",
                            "method": "unipile"
                        }
                    elif not any_account.unipile_account_id:
                        print(f"⚠️  User has LinkedIn account but no Unipile account ID (ID: {any_account.id})")
                        return {
                            "success": False,
                            "error": "Your LinkedIn account is not properly connected to Unipile. Please reconnect your LinkedIn account in Settings > LinkedIn Accounts.",
                            "method": "unipile"
                        }
                else:
                    print(f"⚠️  User has no LinkedIn accounts")
                    return {
                        "success": False,
                        "error": "No LinkedIn account connected. Please connect your LinkedIn account in Settings > LinkedIn Accounts.",
                        "method": "unipile"
                    }
        
        # Fall back to default Unipile account ID if no user account found
        if not unipile_account_id:
            unipile_account_id = settings.unipile_account_id
            if not unipile_account_id:
                return {
                    "success": False,
                    "error": "No Unipile account configured. Please connect your LinkedIn account in Settings > LinkedIn Accounts.",
                    "method": "unipile"
                }
            print(f"📧 Using default Unipile account from env: {unipile_account_id}")
        
        # Use Unipile API to send invitation
        messenger = get_messenger()
        
        loop = asyncio.get_event_loop()
        success, result = await loop.run_in_executor(
            None,
            messenger.send_invitation,
            provider_id,
            text,
            unipile_account_id
        )
        
        if success:
            # Update last_used_at if we have a linkedin_account
            if user_id and db and linkedin_account:
                linkedin_account.last_used_at = datetime.utcnow()
                await db.commit()
            
            print(f"✅ LinkedIn invitation sent successfully via Unipile")
            return {
                "success": True,
                "result": result,
                "method": "unipile",
                "account_id": unipile_account_id
            }
        else:
            error_msg = result if isinstance(result, str) else str(result)
            print(f"❌ Failed to send LinkedIn invitation via Unipile: {error_msg}")
            # Try to extract more details from the error
            if isinstance(result, dict):
                error_detail = result.get("detail", result.get("error", result.get("message", str(result))))
                error_type = result.get("type", "")
                
                # Convert technical errors to user-friendly messages
                if "cannot_resend_yet" in error_type.lower() or "temporary provider limit" in error_detail.lower():
                    user_friendly_error = "You have hit your LinkedIn monthly cap for connection requests. The limit will reset at the start of next month."
                elif "too_many_characters" in error_type.lower() or "character limit" in error_detail.lower():
                    user_friendly_error = "Your LinkedIn message is too long. LinkedIn connection requests have a character limit of 300 characters (or 200 for free accounts). Please shorten your message and try again."
                elif "not_connected" in error_type.lower() or "connection" in error_detail.lower():
                    user_friendly_error = "Unable to connect with this person. They may have restricted connection requests or you may already be connected."
                elif "rate_limit" in error_type.lower() or "too many" in error_detail.lower():
                    user_friendly_error = "You've sent too many LinkedIn requests recently. Please wait a few minutes before trying again."
                elif "invalid" in error_type.lower() or "not found" in error_detail.lower():
                    user_friendly_error = "This LinkedIn profile could not be found or is invalid. Please check the profile URL and try again."
                else:
                    # Default: use the error detail but remove technical jargon
                    user_friendly_error = error_detail
                    # Remove common technical prefixes
                    user_friendly_error = user_friendly_error.replace("errors/", "").replace("error:", "").strip()
                
                error_msg = user_friendly_error
            return {
                "success": False,
                "error": error_msg,
                "method": "unipile",
                "account_id": unipile_account_id
            }
        
    except Exception as e:
        print(f"⚠️  Error sending LinkedIn invitation: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Error sending invitation: {str(e)}",
            "method": "unipile"
        }


async def search_company(name: str, db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Search for a company.
    Checks database cache first, then calls API if not found.
    
    Args:
        name: Company name
        db: Optional database session for caching
        
    Returns:
        Dict with company_id and company info
    """
    from app.db.models.company import Company
    from sqlalchemy import select
    from datetime import datetime
    
    # Normalize company name for caching (lowercase, trim)
    normalized_name = name.strip().lower()
    
    # Check database cache first if db session is available
    if db:
        try:
            result = await db.execute(
                select(Company).where(Company.company_name == normalized_name)
            )
            cached_company = result.scalar_one_or_none()
            
            if cached_company:
                print(f"✅ Found company in cache: {cached_company.company_name} -> {cached_company.company_id}")
                return {
                    "company_id": cached_company.company_id,
                    "company": cached_company.company_data or {}
                }
        except Exception as e:
            print(f"⚠️  Error checking cache: {e}")
            # Continue to API call if cache check fails
    
    # Not in cache, call API
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    company_id, company_info = await loop.run_in_executor(
        None,
        messenger.search_company,
        name
    )
    
    # If API call successful and we have a db session, cache the result
    if company_id and company_info and db:
        try:
            # Check again to avoid race condition (another request might have added it)
            result = await db.execute(
                select(Company).where(Company.company_name == normalized_name)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing cache entry
                existing.company_id = company_id
                existing.company_data = company_info
                existing.updated_at = datetime.utcnow()
                print(f"✅ Updated company cache: {normalized_name} -> {company_id}")
            else:
                # Create new cache entry
                new_company = Company(
                    company_name=normalized_name,
                    company_id=company_id,
                    company_data=company_info
                )
                db.add(new_company)
                print(f"✅ Cached company: {normalized_name} -> {company_id}")
            
            await db.commit()
        except Exception as e:
            print(f"⚠️  Error caching company: {e}")
            await db.rollback()
            # Continue even if caching fails
    
    return {
        "company_id": company_id,
        "company": company_info
    }


async def search_jobs(
    company_ids: List[str],
    job_titles: List[str],
    job_types: Optional[List[str]] = None,
    company_names: Optional[List[str]] = None,
    location_id: Optional[str] = "102571732",
    locations: Optional[List[str]] = None,
    location: Optional[str] = None,
    experience_levels: Optional[List[str]] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None
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
        job_types,
        company_names,
        location_id,
        locations,
        location,
        experience_levels,
        salary_min,
        salary_max
    )
    
    return jobs


async def filter_jobs(
    jobs: List[Dict[str, Any]], 
    resume_file: str = "Resume-Tulsi,Shreyas.pdf",
    resume_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    Filter jobs using AI to surface the top 5 most relevant jobs.
    
    Args:
        jobs: List of job dictionaries
        resume_file: Path to resume file (fallback if resume_content not provided)
        resume_content: Resume content from database (preferred over PDF)
        
    Returns:
        Dict with filtered_jobs (top 5) and ranking analysis
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        await emit_verbose_log(f"Analyzing {len(jobs) if jobs else 0} jobs against your resume", "info", "🎯")
        logger.info(f"🔍 DEBUG: Starting filter_jobs with {len(jobs) if jobs else 0} jobs")
        logger.info(f"🔍 DEBUG: Resume file path: {resume_file}")
        
        if not jobs or len(jobs) == 0:
            await emit_verbose_log("No jobs provided to analyze", "error", "❌")
            logger.error("❌ DEBUG: No jobs provided to filter")
            return {
                "error": "No jobs provided to filter",
                "filtered_jobs": [],
                "debug": "No jobs in input"
            }
        
        logger.info(f"🔍 DEBUG: Getting messenger instance...")
        messenger = get_messenger()
        logger.info(f"✅ DEBUG: Messenger instance obtained")
        
        # Get the job filter instance
        logger.info(f"🔍 DEBUG: Getting job_filter from messenger...")
        if not hasattr(messenger, 'job_filter') or messenger.job_filter is None:
            await emit_verbose_log("Job filter engine unavailable", "error", "❌")
            logger.error("❌ DEBUG: messenger.job_filter is None or not available")
            return {
                "error": "Job filter not available on messenger instance",
                "filtered_jobs": [],
                "debug": "job_filter attribute missing or None"
            }
        
        job_filter = messenger.job_filter
        logger.info(f"✅ DEBUG: Job filter obtained: {type(job_filter)}")
        
        await emit_verbose_log("Extracting job requirements and qualifications", "info", "📝")
        logger.info(f"🔍 DEBUG: Running filter_jobs in executor...")
        logger.info(f"🔍 DEBUG: Resume content provided: {resume_content is not None}")
        loop = asyncio.get_event_loop()
        ranking_result, top_urls = await loop.run_in_executor(
            None,
            job_filter.filter_jobs,
            jobs,
            resume_file,
            resume_content,
            loop
        )
        
        if top_urls and len(top_urls) > 0:
            await emit_verbose_log(f"Found {len(top_urls)} relevant {('job' if len(top_urls) == 1 else 'jobs')} for you", "success", "✅")
        
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
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    recruiters = await loop.run_in_executor(
        None,
        messenger.search_recruiters,
        company_ids,
        "recruiter"
    )
    
    return recruiters


async def store_job_contexts_for_jobs(jobs: List[Dict[str, Any]], db) -> int:
    """
    Store job contexts for manually selected jobs.
    Scrapes, condenses, and stores jobs that don't have contexts yet.
    
    Args:
        jobs: List of job dictionaries
        db: Async database session
        
    Returns:
        Number of contexts stored
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from .job_context_tracker import JobContextTracker
        from .scraper import scrape_job
        from .job_condenser import JobCondenser
        
        # Initialize services
        condenser = JobCondenser()
        tracker = JobContextTracker(db)
        
        logger.info(f"🗂️ Checking/storing contexts for {len(jobs)} manually-selected jobs...")
        await emit_verbose_log(f"🗂️ Processing job contexts for {len(jobs)} job(s)...", "info", "🗂️")
        
        stored_count = 0
        skipped_count = 0
        
        for idx, job in enumerate(jobs, 1):
            job_url = job.get('url') or job.get('job_url')
            job_title = job.get('title', 'Unknown')
            
            if not job_url:
                logger.warning(f"⚠️ Skipping job without URL: {job_title}")
                continue
            
            try:
                # Check if context already exists
                existing_context = await tracker.fetch_job_context(job_url)
                if existing_context and existing_context.get('requirements'):
                    logger.info(f"✅ Context already exists for {job_title}")
                    skipped_count += 1
                    continue
                
                # If job doesn't have condensed_description, scrape and condense it
                if not job.get('condensed_description'):
                    logger.info(f"🔍 [{idx}/{len(jobs)}] Scraping: {job_title}")
                    await emit_verbose_log(f"   Scraping: {job_title}", "info", "🔍")
                    
                    # Run scraping in executor since it's synchronous
                    loop = asyncio.get_event_loop()
                    scraped = await loop.run_in_executor(None, scrape_job, job_url)
                    
                    if scraped and scraped.get('description'):
                        logger.info(f"✅ Scraped successfully, condensing...")
                        condensed = await loop.run_in_executor(None, condenser.condense_job, scraped)
                        if condensed and condensed.get('condensed_description'):
                            job['condensed_description'] = condensed.get('condensed_description', '')
                            logger.info(f"✅ Condensed successfully")
                        else:
                            logger.warning(f"⚠️ Condensing failed for {job_title}")
                    else:
                        logger.warning(f"⚠️ Scraping failed for {job_title}")
                
                # Store the context if we have condensed description
                if job.get('condensed_description'):
                    await tracker.store_job_context(job_url, job)
                    stored_count += 1
                    logger.info(f"✅ [{idx}/{len(jobs)}] Stored context for {job_title}")
                    await emit_verbose_log(f"   ✅ Stored: {job_title}", "success", "✅")
                else:
                    logger.warning(f"⚠️ No condensed description available for {job_title}")
                    
            except Exception as e:
                logger.error(f"❌ Error storing context for {job_url}: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                continue
        
        logger.info(f"✅ Job context storage complete: {stored_count} stored, {skipped_count} already existed")
        await emit_verbose_log(f"✅ Job contexts: {stored_count} stored, {skipped_count} already existed", "success", "✅")
        return stored_count
        
    except Exception as e:
        logger.error(f"❌ Error in store_job_contexts_for_jobs: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return 0


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
        messenger = get_messenger()
        
        loop = asyncio.get_event_loop()
        selected_recruiters, mapping = await loop.run_in_executor(
            None,
            messenger.map_jobs_to_recruiters,
            jobs,
            recruiters,
            max_pairs
        )
        
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
    resume_content: Optional[str] = None,
    job_url: Optional[str] = None,
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
    from app.services.verbose_logger import verbose_logger
    
    messenger = get_messenger()
    recruiter_name = recruiter.get('name', 'recruiter')
    
    await verbose_logger.log(f"Constructing email for {recruiter_name}", "info", "✉️")
    
    # Use provided resume content, or fallback to loading from PDF
    if not resume_content and messenger.resume_generator:
        try:
            resume_file = "Resume-Tulsi,Shreyas.pdf"
            if os.path.exists(resume_file):
                resume_content = messenger.resume_generator.load_resume(resume_file)
        except Exception:
            pass
    
    # Now we can call async method directly - no executor needed! 🎉
    subject, body = await messenger.generate_email_content(
        job_titles,
        job_type,
        recruiter,
        resume_content,
        job_url,
    )
    
    await verbose_logger.log(f"Email content generated for {recruiter_name}", "success", "✅")
    
    return {
        "subject": subject,
        "body": body
    }


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    email_account: Optional[Any] = None,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Send email via SMTP or OAuth (Gmail/Outlook API).
    
    Args:
        to_email: Recipient email
        subject: Email subject
        body: Email body
        email_account: Optional EmailAccount model instance
        db: Optional database session for token refresh
        
    Returns:
        Dict with success status and result/error
    """
    from datetime import datetime
    messenger = get_messenger()
    
    loop = asyncio.get_event_loop()
    
    # If email_account provided, use it; otherwise use default SMTP from env
    if email_account:
        # Check if token is expired and refresh if needed
        if (email_account.provider in ['gmail', 'outlook'] and 
            email_account.access_token and 
            email_account.token_expires_at and 
            email_account.token_expires_at < datetime.utcnow() and
            email_account.refresh_token):
            
            # Token expired - refresh it
            print(f"Access token expired for {email_account.email}, refreshing...")
            success_refresh, new_access_token, new_expires_at, error, new_refresh_token = await loop.run_in_executor(
                None,
                messenger.refresh_access_token,
                email_account
            )
            
            if success_refresh and new_access_token and db:
                # Update the account in database
                email_account.access_token = new_access_token
                email_account.token_expires_at = new_expires_at
                if new_refresh_token:
                    email_account.refresh_token = new_refresh_token
                email_account.updated_at = datetime.utcnow()
                await db.commit()
                print(f"Token refreshed successfully for {email_account.email}")
            elif not success_refresh:
                return {
                    "success": False,
                    "error": f"Failed to refresh access token: {error}. Please re-link your email account."
                }
        
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
    resume_file: str = "Resume-Tulsi,Shreyas.pdf",
    user_id: Optional[str] = None,
    db: Optional[Any] = None
) -> str:
    """
    Generate personalized LinkedIn message for a recruiter-job pair.
    
    Args:
        recruiter: Recruiter dictionary with name and company
        job_title: Job title string
        company_name: Company name string
        resume_content: Resume content from database (preferred over PDF)
        resume_file: Path to resume file (fallback if resume_content not provided)
        user_id: Optional user ID to fetch LinkedIn account premium status
        db: Optional database session to fetch LinkedIn account premium status
        
    Returns:
        Generated LinkedIn message (targets close to character limit based on premium status)
    """
    import logging
    logger = logging.getLogger(__name__)
    from app.services.verbose_logger import verbose_logger
    
    messenger = get_messenger()
    recruiter_name = recruiter.get('name', 'recruiter')
    
    await verbose_logger.log(f"Constructing LinkedIn message for {recruiter_name}", "info", "💼")
    
    # Determine character limit based on user's LinkedIn account premium status
    # Default to 300 (premium) if unknown, 200 if free account
    char_limit = 300  # Default to premium limit
    if user_id and db:
        try:
            from sqlalchemy import select
            from app.db.models.linkedin_account import LinkedInAccount
            from app.services.user_settings_service import get_or_create_user_settings
            
            # Get user settings to find active LinkedIn account
            user_settings = await get_or_create_user_settings(user_id, db)
            if user_settings and user_settings.active_linkedin_account_id:
                result = await db.execute(
                    select(LinkedInAccount)
                    .where(LinkedInAccount.id == user_settings.active_linkedin_account_id)
                    .where(LinkedInAccount.owner_id == user_id)
                )
                linkedin_account = result.scalar_one_or_none()
                if linkedin_account and linkedin_account.is_premium is False:
                    char_limit = 200  # Free account
                    logger.info(f"Using free account character limit (200) for user {user_id}")
                else:
                    logger.info(f"Using premium account character limit (300) for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not fetch LinkedIn account premium status: {e}, defaulting to premium limit")
            # Continue with default premium limit
    
    if not messenger.resume_generator:
        raise ValueError("Resume generator not available")
    
    # Check if job_url is available and ensure context is stored
    job_url = recruiter.get('job_url')
    if job_url:
        logger.info(f"🔍 Checking job context for URL: {job_url}")
        try:
            from app.db.base import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                from app.services.unified_messenger.job_context_tracker import JobContextTracker
                tracker = JobContextTracker(db)
                
                # Check if context exists
                existing_context = await tracker.fetch_job_context(job_url)
                
                if not existing_context or not existing_context.get('requirements'):
                    logger.info(f"📝 Job context not found for {job_url}, creating now...")
                    
                    # Create a minimal job dict with the URL
                    job_dict = {
                        'url': job_url,
                        'title': job_title,
                        'company': {'name': company_name} if isinstance(company_name, str) else company_name
                    }
                    
                    # Scrape and condense the job
                    from app.services.unified_messenger.scraper import scrape_job
                    from app.services.unified_messenger.job_condenser import JobCondenser
                    
                    loop = asyncio.get_event_loop()
                    scraped = await loop.run_in_executor(None, scrape_job, job_url)
                    
                    if scraped and scraped.get('description'):
                        logger.info(f"✅ Scraped job successfully, condensing...")
                        condenser = JobCondenser()
                        
                        # Use condense_job_description method
                        description = scraped.get('description', '')
                        title = scraped.get('title', job_title)
                        condensed_desc = await loop.run_in_executor(
                            None, 
                            condenser.condense_job_description,
                            description,
                            title
                        )
                        
                        if condensed_desc:
                            job_dict['condensed_description'] = condensed_desc
                            # Also update the scraped job's description
                            job_dict['description'] = condensed_desc
                            
                            # Store the context
                            await tracker.store_job_context(job_url, job_dict)
                            logger.info(f"✅ Stored job context for {job_url}")
                        else:
                            logger.warning(f"⚠️ Failed to condense job {job_url}")
                    else:
                        logger.warning(f"⚠️ Failed to scrape job {job_url}")
                else:
                    logger.info(f"✅ Job context already exists for {job_url}")
        except Exception as e:
            logger.error(f"⚠️ Error ensuring job context: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Continue anyway - message generation can still work without context
    
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
    
    recruiter_name_for_generation = recruiter.get('name', 'Hiring Manager')
    
    loop = asyncio.get_event_loop()
    message = await loop.run_in_executor(
        None,
        messenger.resume_generator.generate_message,
        resume_content,
        recruiter_name_for_generation,
        job_title,
        company_name,
        char_limit  # Pass character limit based on premium status
    )
    
    await verbose_logger.log(f"LinkedIn message generated for {recruiter_name} ({len(message) if message else 0}/{char_limit} chars)", "success", "✅")
    
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

