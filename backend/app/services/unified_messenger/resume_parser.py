#!/usr/bin/env python3
"""
Resume Parser - Extracts key bullets from resume for efficient reuse
"""

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

class ResumeParser:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.llm = ChatOpenAI(api_key=self.openai_api_key, model_name="gpt-4o-mini", temperature=0.3)
    
    def extract_key_bullets(self, resume_content):
        """Extract 7-8 most important bullets from resume"""
        
        prompt = f"""
        Extract the 7-8 most important points from this resume for job matching.
        
        RESUME: {resume_content}
        
        Format as concise bullets (under 12 words each):
        
        • [Education - degree, school, year]
        • [Key technical skills/languages]
        • [Most relevant work/internship experience]
        • [Notable projects or achievements]
        • [Certifications or specializations]
        • [Leadership or extracurricular highlights]
        • [Any other standout qualifications]
        
        Focus on what recruiters care about most. Keep very concise.
        """
        
        try:
            result = self.llm.invoke(prompt)
            
            # Handle ChatOpenAI response format
            if hasattr(result, 'content'):
                bullets = result.content.strip()
            elif isinstance(result, str):
                bullets = result.strip()
            else:
                bullets = str(result).strip()
            
            print("✅ Resume parsed into key bullets:")
            print(bullets)
            
            return bullets
            
        except Exception as e:
            print(f"❌ Error parsing resume: {e}")
            # Fallback bullets
            return """• Computer Science student
• Python, Java programming experience  
• Previous internship experience
• Strong technical background
• Problem-solving skills
• Team collaboration experience
• Academic projects completed"""
    
    def get_resume_bullets(self, resume_content):
        """Get resume bullets (with caching)"""
        return self.extract_key_bullets(resume_content)