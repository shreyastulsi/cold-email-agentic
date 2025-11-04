#!/usr/bin/env python3
"""
Job Filter Framework - Uses LLM to rank jobs by relevance to resume
"""

import os
import json
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from .scraper import scrape_job
from .resume_message_generator import ResumeMessageGenerator
from .job_condenser import JobCondenser
from .job_context_tracker import JobContextTracker
from .resume_parser import ResumeParser

load_dotenv()

# Import verbose logger for thread-safe logging
try:
    from app.services.verbose_logger import verbose_logger
    
    def emit_verbose_log_sync(message: str, level: str = "info", emoji: str = ""):
        """Thread-safe verbose logging."""
        try:
            # Use a thread-safe approach - schedule coroutine in existing loop or create new one
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If loop is running (in async context), schedule it
                    asyncio.ensure_future(verbose_logger.log(message, level, emoji))
                else:
                    # If no loop, run it
                    loop.run_until_complete(verbose_logger.log(message, level, emoji))
            except RuntimeError:
                # No event loop in this thread, create one
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(verbose_logger.log(message, level, emoji))
                finally:
                    loop.close()
        except Exception:
            pass  # Fail silently if verbose logging unavailable
    VERBOSE_LOGGING = True
except ImportError:
    VERBOSE_LOGGING = False
    def emit_verbose_log_sync(message: str, level: str = "info", emoji: str = ""):
        pass

class JobFilter:
    def __init__(self):
        self.resume_generator = ResumeMessageGenerator()
        self.job_condenser = JobCondenser()
        self.context_tracker = JobContextTracker()
        self.resume_parser = ResumeParser()
        
    def extract_job_urls(self, jobs):
        """Extract job URLs from unified_messenger job results"""
        job_urls = []
        for job in jobs:
            url = job.get('url')
            if url and url != 'N/A':
                job_urls.append(url)
        return job_urls
    
    def scrape_all_jobs(self, job_urls):
        """Scrape detailed content from all job URLs"""
        scraped_jobs = []
        
        print(f"🔍 Scraping {len(job_urls)} job listings...")
        print("=" * 50)
        
        for i, url in enumerate(job_urls, 1):
            emit_verbose_log_sync(f"📄 Scraping job {i}/{len(job_urls)}: {url[:50]}...", "info", "📄")
            print(f"📄 Scraping job {i}/{len(job_urls)}")
            print(f"🔗 URL: {url}")
            
            try:
                job_data = scrape_job(url)
                if job_data:
                    scraped_jobs.append(job_data)
                    title = job_data.get('title', 'Unknown')
                    print(f"✅ Successfully scraped: {title}")
                    emit_verbose_log_sync(f"✅ Scraped: {title}", "success", "✅")
                else:
                    print(f"❌ Failed to scrape job")
                    emit_verbose_log_sync(f"❌ Failed to scrape job {i}", "warning", "❌")
            except Exception as e:
                print(f"❌ Error scraping job: {e}")
                emit_verbose_log_sync(f"❌ Error scraping job {i}: {str(e)[:50]}", "error", "❌")
            
            print("-" * 30)
        
        print(f"✅ Successfully scraped {len(scraped_jobs)} out of {len(job_urls)} jobs")
        return scraped_jobs
    
    def format_jobs_for_llm(self, condensed_jobs):
        """Format condensed job data for LLM analysis"""
        formatted_content = "JOBS:\n\n"
        
        for i, job in enumerate(condensed_jobs, 1):
            formatted_content += f"JOB #{i}:\n"
            formatted_content += f"TITLE: {job.get('title', 'N/A')}\n"
            formatted_content += f"COMPANY: {job.get('company', {}).get('name', 'N/A')}\n"
            
            # Use condensed description instead of truncated original
            condensed_desc = job.get('condensed_description', 'No description available')
            formatted_content += f"{condensed_desc}\n"
            
            # Employment type from criteria
            if job.get('criteria'):
                for criterion in job['criteria']:
                    if 'employment' in criterion.get('name', '').lower():
                        formatted_content += f"TYPE: {criterion.get('value', 'N/A')}\n"
                        break
            
            formatted_content += "\n" + "-"*30 + "\n\n"
        
        return formatted_content
    
    def rank_jobs_by_relevance(self, condensed_jobs, resume_content):
        """Use LLM to rank jobs by relevance to resume using bullets"""
        import logging
        logger = logging.getLogger(__name__)
        
        jobs_content = self.format_jobs_for_llm(condensed_jobs)
        
        # Extract key resume bullets once
        print(f"\n📋 Extracting key resume bullets...")
        logger.info(f"🔍 DEBUG: Extracting resume bullets...")
        resume_bullets = self.resume_parser.extract_key_bullets(resume_content)
        logger.info(f"✅ DEBUG: Extracted resume bullets ({len(resume_bullets)} chars)")
        
        prompt = f"""
        Rank these jobs by relevance to candidate profile.
        
        CANDIDATE PROFILE:
        {resume_bullets}
        
        {jobs_content}
        
        Rank the top 2 most relevant jobs (1=most relevant):
        
        1. [Job #X] [Title] at [Company]
        2. [Job #Y] [Title] at [Company]
        """
        
        try:
            # Debug: Show prompt length
            print(f"🔍 Debug - Prompt length: {len(prompt)} characters")
            print(f"🔍 Debug - Resume bullets length: {len(resume_bullets)} characters")
            print(f"🔍 Debug - Jobs content length: {len(jobs_content)} characters")
            logger.info(f"🔍 DEBUG: Calling LLM with prompt ({len(prompt)} chars)")
            logger.info(f"🔍 DEBUG: Resume bullets length: {len(resume_bullets)} chars")
            logger.info(f"🔍 DEBUG: Jobs content length: {len(jobs_content)} chars")
            
            if not self.resume_generator or not self.resume_generator.llm:
                error_msg = "LLM not available - check OPENAI_API_KEY"
                logger.error(f"❌ DEBUG: {error_msg}")
                print(f"❌ {error_msg}")
                return None
            
            result = self.resume_generator.llm.invoke(prompt)
            
            logger.info(f"🔍 DEBUG: LLM result type: {type(result).__name__}")
            logger.info(f"🔍 DEBUG: LLM result has content attr: {hasattr(result, 'content')}")
            
            # Handle ChatOpenAI response format
            if hasattr(result, 'content'):
                ranking = result.content.strip()
                logger.info(f"✅ DEBUG: Extracted ranking from result.content ({len(ranking)} chars)")
            elif isinstance(result, dict):
                ranking = result.get('text', result.get('content', str(result))).strip()
                logger.info(f"✅ DEBUG: Extracted ranking from dict ({len(ranking)} chars)")
            else:
                ranking = str(result).strip()
                logger.info(f"✅ DEBUG: Extracted ranking from str() ({len(ranking)} chars)")
            
            if not ranking or len(ranking.strip()) == 0:
                logger.warning(f"⚠️ DEBUG: Ranking result is empty after extraction")
                print(f"⚠️ Warning: LLM returned empty ranking")
                return None
            
            logger.info(f"✅ DEBUG: Ranking result length: {len(ranking)} chars")
            logger.info(f"✅ DEBUG: Ranking preview: {ranking[:200]}")
            
            return ranking
        except Exception as e:
            error_msg = f"Error ranking jobs: {e}"
            print(f"❌ {error_msg}")
            logger.exception(f"❌ DEBUG: {error_msg}")
            print(f"🔍 Debug - Error type: {type(e)}")
            print(f"🔍 Debug - Estimated tokens: ~{len(prompt) // 4}")
            print(f"🔍 Debug - Full error details: {str(e)}")
            import traceback
            logger.error(f"❌ DEBUG: Full traceback:\n{traceback.format_exc()}")
            return None
    
    def extract_top_job_urls(self, ranking_result, condensed_jobs):
        """Extract URLs of top 2 ranked jobs from LLM response (testing mode)"""
        import logging
        logger = logging.getLogger(__name__)
        
        top_urls = []
        
        if not ranking_result:
            logger.warning("⚠️ DEBUG: ranking_result is None or empty in extract_top_job_urls")
            return top_urls
        
        if not condensed_jobs:
            logger.warning("⚠️ DEBUG: condensed_jobs is empty in extract_top_job_urls")
            return top_urls
        
        try:
            ranking_str = str(ranking_result)
            logger.info(f"🔍 DEBUG: Extracting URLs from ranking result (length: {len(ranking_str)} chars)")
            logger.info(f"🔍 DEBUG: Ranking result preview:\n{ranking_str[:500]}")
            
            lines = ranking_str.split('\n')
            logger.info(f"🔍 DEBUG: Split into {len(lines)} lines")
            
            # Try multiple patterns to find job numbers
            import re
            
            # Pattern 1: "1. [Job #3] Title at Company"
            pattern1 = r'(\d+)\.\s*\[Job\s*#(\d+)\]'
            # Pattern 2: "1. Job #3: Title at Company"
            pattern2 = r'(\d+)\.\s*Job\s*#(\d+)'
            # Pattern 3: Just find job numbers in order
            pattern3 = r'Job\s*#(\d+)'
            
            found_jobs = []
            
            for line in lines:
                line_clean = line.strip()
                if not line_clean:
                    continue
                    
                logger.info(f"🔍 DEBUG: Processing line: {line_clean[:100]}")
                
                # Try pattern 1
                match = re.search(pattern1, line_clean, re.IGNORECASE)
                if match:
                    rank_num = int(match.group(1))
                    job_num = int(match.group(2))
                    logger.info(f"🔍 DEBUG: Pattern 1 match - Rank: {rank_num}, Job: {job_num}")
                    found_jobs.append((rank_num, job_num))
                    continue
                
                # Try pattern 2
                match = re.search(pattern2, line_clean, re.IGNORECASE)
                if match:
                    rank_num = int(match.group(1))
                    job_num = int(match.group(2))
                    logger.info(f"🔍 DEBUG: Pattern 2 match - Rank: {rank_num}, Job: {job_num}")
                    found_jobs.append((rank_num, job_num))
                    continue
                
                # Try pattern 3 if line starts with number
                if re.match(r'^\d+\.', line_clean):
                    match = re.search(pattern3, line_clean, re.IGNORECASE)
                    if match:
                        job_num = int(match.group(1))
                        # Extract rank from beginning of line
                        rank_match = re.match(r'^(\d+)\.', line_clean)
                        rank_num = int(rank_match.group(1)) if rank_match else len(found_jobs) + 1
                        logger.info(f"🔍 DEBUG: Pattern 3 match - Rank: {rank_num}, Job: {job_num}")
                        found_jobs.append((rank_num, job_num))
                        continue
            
            logger.info(f"🔍 DEBUG: Found {len(found_jobs)} job references")
            
            # Sort by rank number and extract URLs
            found_jobs.sort(key=lambda x: x[0])  # Sort by rank
            
            for rank_num, job_num in found_jobs[:2]:  # Top 2 (testing mode)
                try:
                    job_idx = job_num - 1  # Convert to 0-based index
                    logger.info(f"🔍 DEBUG: Trying to extract URL for job #{job_num} (index {job_idx})")
                    
                    if 0 <= job_idx < len(condensed_jobs):
                        job = condensed_jobs[job_idx]
                        url = job.get('url')
                        logger.info(f"🔍 DEBUG: Job at index {job_idx}: {job.get('title', 'Unknown')} - URL: {url}")
                        
                        if url and url not in top_urls:
                            top_urls.append(url)
                            logger.info(f"✅ DEBUG: Added URL {len(top_urls)}: {url}")
                        else:
                            logger.warning(f"⚠️ DEBUG: URL missing or duplicate for job #{job_num}")
                    else:
                        logger.warning(f"⚠️ DEBUG: Job index {job_idx} out of range (max: {len(condensed_jobs) - 1})")
                except (ValueError, IndexError) as e:
                    logger.warning(f"⚠️ DEBUG: Error processing job #{job_num}: {e}")
                    continue
            
            # Fallback: if no URLs found but we have condensed_jobs, just take first 2
            if len(top_urls) == 0 and len(condensed_jobs) > 0:
                logger.warning("⚠️ DEBUG: No URLs extracted via pattern matching. Using fallback: first 2 jobs")
                for i in range(min(2, len(condensed_jobs))):
                    url = condensed_jobs[i].get('url')
                    if url:
                        top_urls.append(url)
                        logger.info(f"✅ DEBUG: Fallback added URL {len(top_urls)}: {url}")
            
            logger.info(f"✅ DEBUG: Final top_urls count: {len(top_urls)}")
            logger.info(f"✅ DEBUG: Final top_urls: {top_urls}")
            
        except Exception as e:
            logger.exception(f"⚠️ DEBUG: Error extracting URLs from ranking: {e}")
            import traceback
            logger.error(f"⚠️ DEBUG: Traceback:\n{traceback.format_exc()}")
            print(f"⚠️  Error extracting URLs from ranking: {e}")
        
        return top_urls
    
    def filter_jobs(self, jobs, resume_file="Resume-Tulsi,Shreyas.pdf", resume_content=None):
        """Main function to filter and rank jobs"""
        import logging
        logger = logging.getLogger(__name__)
        
        emit_verbose_log_sync("🎯 Starting Job Filtering Framework", "info", "🎯")
        print("🎯 Starting Job Filtering Framework")
        print("=" * 50)
        logger.info("🔍 DEBUG: filter_jobs called")
        logger.info(f"🔍 DEBUG: Input jobs count: {len(jobs) if jobs else 0}")
        logger.info(f"🔍 DEBUG: Resume file parameter: {resume_file}")
        logger.info(f"🔍 DEBUG: Resume content provided: {resume_content is not None}")
        
        if not jobs or len(jobs) == 0:
            error_msg = "No jobs provided to filter"
            print(f"❌ {error_msg}")
            logger.error(f"❌ DEBUG: {error_msg}")
            return None, None
        
        # Use provided resume content, or fallback to loading from PDF
        if not resume_content:
            # Resolve resume file path - check multiple locations
            current_file_dir = os.path.dirname(__file__)
            logger.info(f"🔍 DEBUG: Current file directory: {current_file_dir}")
            
            resume_paths = [
                resume_file,  # Try as-is first
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), resume_file),  # Backend root
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "resumes", resume_file),  # Backend/uploads/resumes
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ananya", resume_file),  # Project root/ananya
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), resume_file),  # Project root
            ]
            
            logger.info(f"🔍 DEBUG: Checking resume paths:")
            for i, path in enumerate(resume_paths, 1):
                exists = os.path.exists(path)
                logger.info(f"   {i}. {path} - {'✅ EXISTS' if exists else '❌ NOT FOUND'}")
            
            resume_path = None
            for path in resume_paths:
                if os.path.exists(path):
                    resume_path = path
                    logger.info(f"✅ DEBUG: Found resume at: {resume_path}")
                    break
            
            if not resume_path:
                error_msg = f"Resume file not found. Searched in {len(resume_paths)} locations"
                print(f"❌ {error_msg}")
                print(f"Searched in:")
                for path in resume_paths:
                    print(f"   • {path}")
                logger.error(f"❌ DEBUG: {error_msg}")
                return None, None
            
            # Load resume content from PDF
            try:
                logger.info(f"🔍 DEBUG: Loading resume from: {resume_path}")
                resume_content = self.resume_generator.load_resume(resume_path)
                print(f"✅ Resume loaded: {len(resume_content)} characters")
                logger.info(f"✅ DEBUG: Resume loaded successfully, {len(resume_content)} characters")
            except Exception as e:
                error_msg = f"Error loading resume: {e}"
                print(f"❌ {error_msg}")
                logger.exception(f"❌ DEBUG: {error_msg}")
                import traceback
                logger.error(f"❌ DEBUG: Traceback:\n{traceback.format_exc()}")
                return None, None
        else:
            logger.info(f"✅ DEBUG: Using provided resume content ({len(resume_content)} characters)")
            print(f"✅ Using resume content from database ({len(resume_content)} characters)")
            emit_verbose_log_sync(f"✅ Using resume content from database ({len(resume_content)} characters)", "success", "✅")
        
        # Extract job URLs
        logger.info(f"🔍 DEBUG: Extracting job URLs...")
        job_urls = self.extract_job_urls(jobs)
        print(f"📋 Found {len(job_urls)} job URLs to analyze")
        logger.info(f"🔍 DEBUG: Extracted {len(job_urls)} job URLs")
        
        if not job_urls:
            error_msg = "No job URLs found"
            print(f"❌ {error_msg}")
            logger.error(f"❌ DEBUG: {error_msg}")
            return None, None
        
        # Scrape all jobs
        emit_verbose_log_sync(f"🔍 Scraping {len(job_urls)} job listing(s)...", "info", "🔍")
        logger.info(f"🔍 DEBUG: Starting to scrape {len(job_urls)} jobs...")
        scraped_jobs = self.scrape_all_jobs(job_urls)
        logger.info(f"🔍 DEBUG: Scraped {len(scraped_jobs) if scraped_jobs else 0} jobs")
        if scraped_jobs:
            emit_verbose_log_sync(f"✅ Successfully scraped {len(scraped_jobs)} job(s)", "success", "✅")
        
        if not scraped_jobs:
            error_msg = "No jobs successfully scraped"
            print(f"❌ {error_msg}")
            logger.error(f"❌ DEBUG: {error_msg}")
            return None, None
        
        # Condense job descriptions using LLM
        emit_verbose_log_sync(f"📝 Condensing {len(scraped_jobs)} job descriptions using AI...", "info", "📝")
        print(f"\n📝 Condensing job descriptions...")
        logger.info(f"🔍 DEBUG: Condensing {len(scraped_jobs)} job descriptions...")
        try:
            condensed_jobs = self.job_condenser.condense_all_jobs(scraped_jobs)
            logger.info(f"✅ DEBUG: Condensed to {len(condensed_jobs) if condensed_jobs else 0} jobs")
            if condensed_jobs:
                emit_verbose_log_sync(f"✅ Condensed to {len(condensed_jobs)} job(s)", "success", "✅")
        except Exception as e:
            error_msg = f"Error condensing jobs: {e}"
            print(f"❌ {error_msg}")
            logger.exception(f"❌ DEBUG: {error_msg}")
            return None, None
        
        # Store job contexts for later LinkedIn message generation
        try:
            logger.info(f"🔍 DEBUG: Storing job contexts...")
            self.context_tracker.store_all_job_contexts(condensed_jobs)
            logger.info(f"✅ DEBUG: Job contexts stored")
        except Exception as e:
            logger.warning(f"⚠️ DEBUG: Error storing job contexts: {e}")
            # Don't fail on this, continue
        
        # Rank jobs using LLM
        emit_verbose_log_sync(f"🤖 Analyzing {len(condensed_jobs)} job(s) with LLM for relevance...", "info", "🤖")
        print(f"\n🤖 Analyzing {len(condensed_jobs)} jobs with LLM...")
        logger.info(f"🔍 DEBUG: Ranking {len(condensed_jobs)} jobs with LLM...")
        logger.info(f"🔍 DEBUG: resume_generator available: {self.resume_generator is not None}")
        logger.info(f"🔍 DEBUG: resume_parser available: {self.resume_parser is not None}")
        logger.info(f"🔍 DEBUG: llm available: {self.resume_generator.llm is not None if self.resume_generator else False}")
        
        try:
            ranking_result = self.rank_jobs_by_relevance(condensed_jobs, resume_content)
            logger.info(f"🔍 DEBUG: Ranking result type: {type(ranking_result).__name__ if ranking_result else None}")
            logger.info(f"🔍 DEBUG: Ranking result is None: {ranking_result is None}")
            logger.info(f"🔍 DEBUG: Ranking result is empty string: {ranking_result == '' if isinstance(ranking_result, str) else 'N/A'}")
            if ranking_result:
                logger.info(f"🔍 DEBUG: Ranking result length: {len(str(ranking_result))} characters")
                logger.info(f"🔍 DEBUG: Ranking result preview (first 500 chars): {str(ranking_result)[:500] if ranking_result else None}")
        except Exception as e:
            error_msg = f"Error ranking jobs: {e}"
            print(f"❌ {error_msg}")
            logger.exception(f"❌ DEBUG: {error_msg}")
            import traceback
            traceback_str = traceback.format_exc()
            logger.error(f"❌ DEBUG: Traceback:\n{traceback_str}")
            print(f"❌ Full traceback:\n{traceback_str}")
            return None, None
        
        if not ranking_result or (isinstance(ranking_result, str) and len(ranking_result.strip()) == 0):
            error_msg = f"Failed to rank jobs - ranking_result is None or empty. Type: {type(ranking_result).__name__}, Value: {repr(ranking_result)}"
            print(f"❌ {error_msg}")
            logger.error(f"❌ DEBUG: {error_msg}")
            return None, None
        
        # Extract top job URLs
        emit_verbose_log_sync(f"🔍 Extracting top ranked job(s) from LLM analysis...", "info", "🔍")
        logger.info(f"🔍 DEBUG: Extracting top job URLs from ranking...")
        logger.info(f"🔍 DEBUG: ranking_result type before extraction: {type(ranking_result).__name__}")
        logger.info(f"🔍 DEBUG: condensed_jobs length: {len(condensed_jobs) if condensed_jobs else 0}")
        try:
            top_urls = self.extract_top_job_urls(ranking_result, condensed_jobs)
            logger.info(f"🔍 DEBUG: Extracted {len(top_urls) if top_urls else 0} top URLs")
            if top_urls:
                emit_verbose_log_sync(f"✅ Extracted {len(top_urls)} top job URL(s)", "success", "✅")
            logger.info(f"🔍 DEBUG: top_urls type: {type(top_urls).__name__}")
            logger.info(f"🔍 DEBUG: top_urls value: {top_urls}")
            
            if top_urls:
                logger.info(f"🔍 DEBUG: Top URLs: {top_urls}")
            else:
                logger.warning(f"⚠️ DEBUG: No URLs extracted. Ranking result sample:\n{str(ranking_result)[:500]}")
                # Fallback: try to extract URLs using a different pattern
                logger.info(f"🔍 DEBUG: Attempting fallback URL extraction...")
                # If no URLs found, try alternative extraction methods
                if isinstance(ranking_result, str):
                    # Check if ranking mentions job numbers differently
                    import re
                    # Try to find any job numbers mentioned
                    job_num_pattern = r'Job\s*#(\d+)'
                    matches = re.findall(job_num_pattern, ranking_result, re.IGNORECASE)
                    logger.info(f"🔍 DEBUG: Found job number matches: {matches}")
                    if matches:
                        for match in matches[:5]:  # Top 5
                            try:
                                job_idx = int(match) - 1
                                if 0 <= job_idx < len(condensed_jobs):
                                    url = condensed_jobs[job_idx].get('url')
                                    if url and url not in top_urls:
                                        top_urls.append(url)
                                        logger.info(f"🔍 DEBUG: Fallback extracted URL {job_idx + 1}: {url}")
                            except (ValueError, IndexError):
                                continue
        except Exception as e:
            error_msg = f"Error extracting top URLs: {e}"
            print(f"❌ {error_msg}")
            logger.exception(f"❌ DEBUG: {error_msg}")
            import traceback
            logger.error(f"❌ DEBUG: Traceback:\n{traceback.format_exc()}")
            return None, None
        
        if not top_urls or len(top_urls) == 0:
            error_msg = f"No top URLs extracted from ranking. Ranking result preview:\n{str(ranking_result)[:500] if ranking_result else 'None'}"
            print(f"❌ {error_msg}")
            logger.error(f"❌ DEBUG: {error_msg}")
            logger.error(f"❌ DEBUG: Full ranking result:\n{str(ranking_result) if ranking_result else 'None'}")
            logger.error(f"❌ DEBUG: Condensed jobs URLs: {[job.get('url') for job in condensed_jobs[:5] if job.get('url')]}")
            return None, None
        
        # Save results
        try:
            logger.info(f"🔍 DEBUG: Saving results...")
            self.save_results(ranking_result, condensed_jobs, top_urls)
            logger.info(f"✅ DEBUG: Results saved")
        except Exception as e:
            logger.warning(f"⚠️ DEBUG: Error saving results: {e}")
            # Don't fail on this, continue
        
        logger.info(f"✅ DEBUG: filter_jobs completed successfully")
        return ranking_result, top_urls
    
    def save_results(self, ranking_result, scraped_jobs, top_urls):
        """Save filtering results to files"""
        # Save ranking analysis
        with open("job_ranking.txt", "w", encoding="utf-8") as f:
            f.write("JOB RELEVANCE RANKING ANALYSIS\n")
            f.write("=" * 50 + "\n\n")
            f.write(ranking_result)
        
        # Save top job URLs
        with open("top_job_urls.txt", "w", encoding="utf-8") as f:
            f.write("TOP 5 RANKED JOB URLs\n")
            f.write("=" * 30 + "\n\n")
            for i, url in enumerate(top_urls, 1):
                f.write(f"{i}. {url}\n")
        
        # Save all scraped job data
        with open("all_scraped_jobs.json", "w", encoding="utf-8") as f:
            json.dump(scraped_jobs, f, indent=2, ensure_ascii=False)
        
        print(f"\n📄 Results saved:")
        print(f"   • job_ranking.txt - LLM analysis and ranking")
        print(f"   • top_job_urls.txt - Top 5 job URLs")
        print(f"   • all_scraped_jobs.json - All scraped job data")
        print(f"   • job_contexts.json - Job contexts for LinkedIn messages")
    
    def generate_linkedin_message_for_job(self, job_url, recruiter_name, resume_file="Resume-Tulsi,Shreyas.pdf"):
        """Generate job-specific LinkedIn message using stored context"""
        try:
            # Load resume
            resume_content = self.resume_generator.load_resume(resume_file)
            
            # Generate job-specific message
            message = self.context_tracker.generate_job_specific_message(
                job_url, recruiter_name, self.resume_generator, resume_content
            )
            
            return message
            
        except Exception as e:
            print(f"❌ Error generating LinkedIn message: {e}")
            return None

def main():
    """Test the job filter with sample data"""
    # Sample job data (normally from unified_messenger)
    sample_jobs = [
        {"url": "https://www.linkedin.com/jobs/view/4331488540"},
        # Add more URLs as needed
    ]
    
    filter_system = JobFilter()
    ranking, top_urls = filter_system.filter_jobs(sample_jobs)
    
    if ranking:
        print("\n🎯 JOB FILTERING COMPLETE!")
        print("=" * 50)
        print(ranking)
        print(f"\n📋 Top {len(top_urls)} job URLs:")
        for i, url in enumerate(top_urls, 1):
            print(f"{i}. {url}")

if __name__ == "__main__":
    main()