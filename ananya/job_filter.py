#!/usr/bin/env python3
"""
Job Filter Framework - Uses LLM to rank jobs by relevance to resume
"""

import os
import json
from dotenv import load_dotenv
from scraper import scrape_job
from resume_message_generator import ResumeMessageGenerator
from job_condenser import JobCondenser
from job_context_tracker import JobContextTracker
from resume_parser import ResumeParser

load_dotenv()

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
            print(f"📄 Scraping job {i}/{len(job_urls)}")
            print(f"🔗 URL: {url}")
            
            try:
                job_data = scrape_job(url)
                if job_data:
                    scraped_jobs.append(job_data)
                    print(f"✅ Successfully scraped: {job_data.get('title', 'Unknown')}")
                else:
                    print(f"❌ Failed to scrape job")
            except Exception as e:
                print(f"❌ Error scraping job: {e}")
            
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
        jobs_content = self.format_jobs_for_llm(condensed_jobs)
        
        # Extract key resume bullets once
        print(f"\n📋 Extracting key resume bullets...")
        resume_bullets = self.resume_parser.extract_key_bullets(resume_content)
        
        prompt = f"""
        Rank these jobs by relevance to candidate profile.
        
        CANDIDATE PROFILE:
        {resume_bullets}
        
        {jobs_content}
        
        Rank top 5 most relevant jobs (1=most relevant):
        
        1. [Job #X] [Title] at [Company]
        2. [Job #X] [Title] at [Company]
        3. [Job #X] [Title] at [Company]
        4. [Job #X] [Title] at [Company]
        5. [Job #X] [Title] at [Company]
        """
        
        try:
            # Debug: Show prompt length
            print(f"🔍 Debug - Prompt length: {len(prompt)} characters")
            print(f"🔍 Debug - Resume bullets length: {len(resume_bullets)} characters")
            print(f"🔍 Debug - Jobs content length: {len(jobs_content)} characters")
            
            result = self.resume_generator.llm.invoke(prompt)
            
            # Handle ChatOpenAI response format
            if hasattr(result, 'content'):
                ranking = result.content.strip()
            elif isinstance(result, dict):
                ranking = result.get('text', result.get('content', str(result))).strip()
            else:
                ranking = str(result).strip()
            
            return ranking
        except Exception as e:
            print(f"❌ Error ranking jobs: {e}")
            print(f"🔍 Debug - Error type: {type(e)}")
            print(f"🔍 Debug - Estimated tokens: ~{len(prompt) // 4}")
            print(f"🔍 Debug - Full error details: {str(e)}")
            return None
    
    def extract_top_job_urls(self, ranking_result, condensed_jobs):
        """Extract URLs of top 5 ranked jobs from LLM response"""
        top_urls = []
        
        try:
            lines = ranking_result.split('\n')
            for line in lines:
                if line.strip().startswith(('1.', '2.', '3.', '4.', '5.')):
                    # Extract job number from line like "1. [Job #3] Title at Company"
                    if '[Job #' in line and ']' in line:
                        job_num_str = line.split('[Job #')[1].split(']')[0]
                        try:
                            job_num = int(job_num_str) - 1  # Convert to 0-based index
                            if 0 <= job_num < len(condensed_jobs):
                                url = condensed_jobs[job_num].get('url')
                                if url:
                                    top_urls.append(url)
                        except ValueError:
                            continue
        except Exception as e:
            print(f"⚠️  Error extracting URLs from ranking: {e}")
        
        return top_urls
    
    def filter_jobs(self, jobs, resume_file="Resume-Tulsi,Shreyas.pdf"):
        """Main function to filter and rank jobs"""
        print("🎯 Starting Job Filtering Framework")
        print("=" * 50)
        
        # Load resume content
        try:
            resume_content = self.resume_generator.load_resume(resume_file)
            print(f"✅ Resume loaded: {len(resume_content)} characters")
        except Exception as e:
            print(f"❌ Error loading resume: {e}")
            return None, None
        
        # Extract job URLs
        job_urls = self.extract_job_urls(jobs)
        print(f"📋 Found {len(job_urls)} job URLs to analyze")
        
        if not job_urls:
            print("❌ No job URLs found")
            return None, None
        
        # Scrape all jobs
        scraped_jobs = self.scrape_all_jobs(job_urls)
        
        if not scraped_jobs:
            print("❌ No jobs successfully scraped")
            return None, None
        
        # Condense job descriptions using LLM
        print(f"\n📝 Condensing job descriptions...")
        condensed_jobs = self.job_condenser.condense_all_jobs(scraped_jobs)
        
        # Store job contexts for later LinkedIn message generation
        self.context_tracker.store_all_job_contexts(condensed_jobs)
        
        # Rank jobs using LLM
        print(f"\n🤖 Analyzing {len(condensed_jobs)} jobs with LLM...")
        ranking_result = self.rank_jobs_by_relevance(condensed_jobs, resume_content)
        
        if not ranking_result:
            print("❌ Failed to rank jobs")
            return None, None
        
        # Extract top job URLs
        top_urls = self.extract_top_job_urls(ranking_result, condensed_jobs)
        
        # Save results
        self.save_results(ranking_result, condensed_jobs, top_urls)
        
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