#!/usr/bin/env python3
"""
Job Description Condenser - Uses LLM to extract key info from job descriptions
"""

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

class JobCondenser:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.llm = ChatOpenAI(api_key=self.openai_api_key, model_name="gpt-4o-mini", temperature=0.3)
    
    def condense_job_description(self, job_description, job_title):
        """Condense job description into structured bullets"""
        
        prompt = f"""
        Extract key information from this job description and format as bullets:
        
        JOB TITLE: {job_title}
        DESCRIPTION: {job_description}
        
        Extract and format as:
        
        RESPONSIBILITIES:
        • [bullet 1]
        • [bullet 2]
        • [bullet 3]
        
        REQUIREMENTS:
        • [bullet 1]
        • [bullet 2]
        • [bullet 3]
        
        KEY TECHNOLOGIES:
        • [bullet 1]
        • [bullet 2]
        • [bullet 3]
        
        Keep each bullet under 15 words. Focus on most important items only.
        """
        
        try:
            result = self.llm.invoke(prompt)
            
            # Handle ChatOpenAI response format
            if hasattr(result, 'content'):
                condensed = result.content.strip()
            elif isinstance(result, str):
                condensed = result.strip()
            else:
                condensed = str(result).strip()
            
            return condensed
        except Exception as e:
            print(f"⚠️  Error condensing job description: {e}")
            return f"RESP: {job_title} duties\nREQ: Not available\nTECH: Not specified"
    
    def condense_all_jobs(self, scraped_jobs):
        """Condense descriptions for all jobs"""
        condensed_jobs = []
        
        print(f"🔄 Condensing {len(scraped_jobs)} job descriptions...")
        
        for i, job in enumerate(scraped_jobs, 1):
            print(f"📝 Condensing job {i}/{len(scraped_jobs)}: {job.get('title', 'Unknown')}")
            
            description = job.get('description', 'No description available')
            title = job.get('title', 'Unknown Position')
            
            # Condense the description
            condensed_desc = self.condense_job_description(description, title)
            
            # Create new job object with condensed description REPLACING original
            condensed_job = job.copy()
            condensed_job['condensed_description'] = condensed_desc
            # Remove the original long description to save space
            condensed_job['description'] = condensed_desc  # Replace with condensed version
            condensed_jobs.append(condensed_job)
        
        print(f"✅ Condensed all {len(condensed_jobs)} job descriptions")
        return condensed_jobs