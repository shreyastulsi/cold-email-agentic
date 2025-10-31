#!/usr/bin/env python3
"""
Job Context Tracker - Stores condensed job info for LinkedIn message generation
"""

import json
import os

class JobContextTracker:
    def __init__(self):
        self.context_file = "job_contexts.json"
        self.job_contexts = self.load_contexts()
    
    def load_contexts(self):
        """Load existing job contexts from file"""
        if os.path.exists(self.context_file):
            try:
                with open(self.context_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_contexts(self):
        """Save job contexts to file"""
        with open(self.context_file, 'w', encoding='utf-8') as f:
            json.dump(self.job_contexts, f, indent=2, ensure_ascii=False)
    
    def store_job_context(self, job_url, condensed_job):
        """Store condensed job info for later use"""
        # Extract key info from condensed description
        condensed_desc = condensed_job.get('condensed_description', '')
        
        # Parse condensed description to extract structured info
        context = {
            'title': condensed_job.get('title'),
            'company': condensed_job.get('company', {}).get('name'),
            'url': job_url,
            'responsibilities': self.extract_bullets(condensed_desc, 'RESPONSIBILITIES:'),
            'requirements': self.extract_bullets(condensed_desc, 'REQUIREMENTS:'),
            'technologies': self.extract_bullets(condensed_desc, 'KEY TECHNOLOGIES:'),
            'employment_type': self.get_employment_type(condensed_job)
        }
        
        self.job_contexts[job_url] = context
        self.save_contexts()
        print(f"📝 Stored context for: {context['title']} at {context['company']}")
    
    def extract_bullets(self, text, section_header):
        """Extract bullet points from a section"""
        bullets = []
        if section_header in text:
            section = text.split(section_header)[1].split('\n\n')[0]
            for line in section.split('\n'):
                if line.strip().startswith('•'):
                    bullets.append(line.strip()[1:].strip())
        return bullets[:3]  # Limit to top 3
    
    def get_employment_type(self, job):
        """Extract employment type from criteria"""
        if job.get('criteria'):
            for criterion in job['criteria']:
                if 'employment' in criterion.get('name', '').lower():
                    return criterion.get('value', 'Full-time')
        return 'Full-time'
    
    def get_job_context(self, job_url):
        """Get stored context for a job URL"""
        return self.job_contexts.get(job_url)
    
    def store_all_job_contexts(self, condensed_jobs):
        """Store contexts for all condensed jobs"""
        print(f"\n📚 Storing contexts for {len(condensed_jobs)} jobs...")
        for job in condensed_jobs:
            job_url = job.get('url')
            if job_url:
                self.store_job_context(job_url, job)
        print(f"✅ Stored {len(condensed_jobs)} job contexts")
    
    def generate_job_specific_message(self, job_url, recruiter_name, resume_generator, resume_content):
        """Generate LinkedIn message using stored job context"""
        context = self.get_job_context(job_url)
        if not context:
            print(f"❌ No context found for job URL: {job_url}")
            return None
        
        # Create enhanced prompt with job-specific context
        job_specific_prompt = f"""
        Create a personalized LinkedIn connection message using specific job context.
        
        RESUME: {resume_content[:800]}...
        RECRUITER: {recruiter_name}
        JOB TITLE: {context['title']}
        COMPANY: {context['company']}
        
        JOB CONTEXT:
        Key Requirements: {', '.join(context['requirements'][:2])}
        Key Technologies: {', '.join(context['technologies'][:2])}
        Type: {context['employment_type']}
        
        STRUCTURE:
        1. "Dear {recruiter_name}, I'm interested in the {context['title']} position at {context['company']}."
        2. Mention 1-2 specific requirements/technologies you match from the job context
        3. Brief background from resume that aligns with job requirements
        4. Professional closing
        
        REQUIREMENTS:
        - 280-295 characters total
        - Reference specific job requirements/technologies
        - Professional tone
        - Complete sentences only
        
        Generate message:
        """
        
        try:
            result = resume_generator.llm.invoke(job_specific_prompt)
            # Handle ChatOpenAI response format properly
            if hasattr(result, 'content'):
                message = result.content.strip()
            elif isinstance(result, str):
                message = result.strip()
            else:
                message = str(result).strip()
            
            # Ensure proper length
            if len(message) > 295:
                sentences = message.split('. ')
                truncated = ""
                for sentence in sentences:
                    test_msg = truncated + sentence + ('. ' if not sentence.endswith('.') else '')
                    if len(test_msg.strip()) <= 295:
                        truncated = test_msg
                    else:
                        break
                message = truncated.strip()
            
            print(f"✅ Generated job-specific message ({len(message)} chars)")
            print(f"🎯 Used context: {', '.join(context['technologies'][:2])}")
            return message
            
        except Exception as e:
            print(f"❌ Error generating job-specific message: {e}")
            return None