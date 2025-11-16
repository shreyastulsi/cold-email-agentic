#!/usr/bin/env python3
"""
Resume Message Generator - Creates personalized messages from resume content
Uses LangChain to process PDF resumes and generate LinkedIn connection messages
Now integrated with ResumeParser for efficient resume content reuse
"""

import os
import sys
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

load_dotenv()

class ResumeMessageGenerator:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        # Initialize ChatOpenAI LLM with GPT-4o-mini (cheaper alternative to GPT-4)
        self.llm = ChatOpenAI(api_key=self.openai_api_key, model_name="gpt-4o-mini", temperature=0.7)
        
        # Initialize resume parser for efficient content extraction
        try:
            from .resume_parser import ResumeParser
            self.resume_parser = ResumeParser()
            print("✅ Resume parser integrated successfully")
        except Exception as e:
            print(f"⚠️  Resume parser not available: {e}")
            self.resume_parser = None
        
        # Add caching for resume content to avoid reloading PDF multiple times
        self._cached_resume_content = None
        self._cached_resume_file = None
        
        # Note: Prompt template will be created dynamically based on character limit
    
    def load_resume(self, pdf_path):
        """
        Load and extract text content from a PDF resume.
        Uses caching to avoid reloading the same file multiple times.
        """
        # Normalize path for consistent caching
        pdf_path = os.path.abspath(pdf_path) if os.path.exists(pdf_path) else pdf_path
        
        # Check if we already have this file cached
        if self._cached_resume_content and self._cached_resume_file == pdf_path:
            print(f"✅ Using cached resume content from: {pdf_path}")
            return self._cached_resume_content
        
        print(f"📄 Loading resume from: {pdf_path}")
        
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"Resume file not found: {pdf_path}")
        
        try:
            # Load PDF using LangChain's PyPDFLoader
            loader = PyPDFLoader(pdf_path)
            documents = loader.load()
            
            # Combine all pages into a single text
            resume_content = "\n".join([doc.page_content for doc in documents])
            
            # Cache the content for future use
            self._cached_resume_content = resume_content
            self._cached_resume_file = pdf_path
            
            print(f"✅ Successfully loaded resume ({len(documents)} pages) - cached for reuse")
            return resume_content
            
        except Exception as e:
            print(f"❌ Error loading resume: {e}")
            raise
    
    def clear_resume_cache(self):
        """
        Clear the cached resume content.
        Useful when resume file is updated and needs to be reloaded.
        """
        self._cached_resume_content = None
        self._cached_resume_file = None
        print("🔄 Resume cache cleared")
    
    def _create_prompt_template(self, char_limit):
        """Create prompt template with dynamic character limit."""
        max_chars = char_limit
        # Target close to the limit with appropriate range based on limit
        # For 200 (free): target 180-195 (stay under 200), for 300 (premium): target 280-295 (stay under 300)
        if char_limit <= 200:
            target_min = 180
            target_max = 195
        else:
            target_min = 280
            target_max = 295
        
        # Create appropriate example for the char limit
        if char_limit <= 200:
            example = '''
            EXAMPLE (195 chars for 200 limit):
            "Dear John Smith, I'm interested in the Software Engineer position at Meta. I'm a CS student at UCLA with Python and React experience from my internships at Google and Amazon. I'd love to discuss how my background fits your team."
            '''
        else:
            example = '''
            EXAMPLE (290 chars for 300 limit):
            "Dear Sarah Johnson, I'm interested in the Machine Learning Engineer position at Google. I'm a Computer Science senior at Stanford graduating in May 2024. During my internships at Meta and Amazon, I built recommendation systems using Python, TensorFlow, and AWS, processing millions of user interactions daily. My experience optimizing ML pipelines and deploying models at scale aligns well with this role. I'd love to discuss how my background fits your team's needs."
            '''
        
        return PromptTemplate(
            input_variables=["resume_content", "recruiter_name", "job_title", "company_name"],
            template=f"""
            CRITICAL TASK: Create a professional LinkedIn connection message that is EXACTLY {target_min}-{target_max} characters.
            Your message will be REJECTED if it's outside this range. Count characters as you write.
            
            TARGET: {target_min}-{target_max} characters (aim for around {int((target_min + target_max) / 2)})
            HARD LIMIT: Must stay UNDER {max_chars} characters
            
            RESUME CONTENT: {{resume_content}}
            RECRUITER: {{recruiter_name}}
            JOB TITLE: {{job_title}}
            COMPANY: {{company_name}}
            
            REQUIRED STRUCTURE:
            1. Opening: "Dear [recruiter_name], I'm interested in the [job_title] position at [company_name]."
            2. Background (2-3 sentences): Include SPECIFIC details from resume:
               - College name, graduation year, major
               - Company names from internships/work experience
               - Technical skills (e.g., Python, React, AWS, SQL, TensorFlow)
               - Relevant projects or achievements with numbers/metrics
            3. Closing: "I'd love to discuss how my background aligns with your team's needs." (or similar)
            
            CRITICAL REQUIREMENTS:
            - MINIMUM: {target_min} characters (messages shorter than this will be rejected)
            - MAXIMUM: {max_chars} characters (messages longer than this will fail)
            - TARGET: {target_min}-{target_max} characters (aim for this range)
            - Use professional, engaging tone
            - Include enough specific detail to reach target length
            - Complete sentences only - no cut-offs
            {example}
            
            COUNT YOUR CHARACTERS. Generate {target_min}-{target_max} characters NOW:
            """
        )
    
    def generate_message(self, resume_content, recruiter_name, job_title, company_name, char_limit=300):
        """
        Generate a personalized LinkedIn connection message.
        resume_content is already parsed bullets from database (or raw content if loading from PDF).
        """
        print(f"🤖 Generating personalized message...")
        print(f"👤 Recruiter: {recruiter_name}")
        print(f"💼 Job: {job_title} at {company_name}")
        print("-" * 50)
        
        try:
            # Resume content from database is already parsed bullets, use directly
            # Only parse if this looks like raw resume content (very long, not bullet format)
            # Parsed bullets are typically under 1000 chars and contain bullet points
            # Check if content looks like parsed bullets (short with bullet-like characters)
            is_parsed_bullets = False
            if resume_content:
                # Check if it's short enough to be parsed bullets
                if len(resume_content) < 1000:
                    # Check if it contains bullet-like characters (•, -, *, etc.)
                    bullet_chars = ['•', '-', '*', '→', '·']
                    lines = resume_content.strip().split('\n')
                    bullet_lines = sum(1 for line in lines if line.strip() and any(line.strip().startswith(char) for char in bullet_chars))
                    # If more than half the non-empty lines start with bullets, it's likely parsed
                    if bullet_lines > len([l for l in lines if l.strip()]) * 0.3:
                        is_parsed_bullets = True
                
                if not is_parsed_bullets and len(resume_content) > 1500:
                    # This looks like raw resume content, parse it
                    if self.resume_parser:
                        try:
                            print("📝 Parsing raw resume content (not from database)...")
                            resume_bullets = self.resume_parser.extract_key_bullets(resume_content)
                            short_resume = resume_bullets
                        except Exception as e:
                            print(f"⚠️  Resume parser failed, using truncated content: {e}")
                            short_resume = resume_content[:1500] + "..." if len(resume_content) > 1500 else resume_content
                    else:
                        short_resume = resume_content[:1500] + "..." if len(resume_content) > 1500 else resume_content
                else:
                    # Already parsed bullets from database, use directly
                    short_resume = resume_content
            else:
                short_resume = 'No resume content available'
            
            # Create prompt template with dynamic character limit
            prompt_template = self._create_prompt_template(char_limit)
            chain = LLMChain(llm=self.llm, prompt=prompt_template)
            
            # Generate message using the LLM chain
            result = chain.invoke({
                "resume_content": short_resume,
                "recruiter_name": recruiter_name,
                "job_title": job_title,
                "company_name": company_name
            })
            
            # Extract text from the result - handle ChatOpenAI format
            if hasattr(result, 'content'):
                message = result.content.strip()
            elif isinstance(result, dict):
                message = result.get('text', result.get('content', str(result))).strip()
            else:
                message = str(result).strip()
            
            # Calculate target range based on character limit
            # For 200: target 180-195, for 300: target 280-295
            if char_limit <= 200:
                target_min = 180
                target_max = 195
            else:
                target_min = 280
                target_max = 295
            
            # Ensure message is within target range: try strict regeneration with multiple attempts
            attempts = 0
            max_attempts = 10  # Increased for better convergence
            while (len(message) < target_min or len(message) > target_max) and attempts < max_attempts:
                if len(message) < target_min:
                    status = f"too short ({len(message)} chars)"
                    guidance = f"Your message needs MORE detail. Add specific company names, technical skills, and experiences."
                else:
                    status = f"too long ({len(message)} chars)"
                    guidance = f"Your message needs to be SHORTER and more concise. Remove unnecessary words."
                
                print(f"⚠️  Message {status}, target: {target_min}-{target_max}, regenerating (attempt {attempts+1}/{max_attempts})...")
                
                extended_prompt = f"""
                CRITICAL: The previous message was {status}. You MUST generate EXACTLY {target_min}-{target_max} characters.
                Target: {target_min}-{target_max} characters (aim for around {int((target_min + target_max) / 2)})
                Hard limit: UNDER {char_limit} characters
                
                {guidance}
                
                RESUME: {short_resume[:500]}
                RECRUITER: {recruiter_name}
                JOB: {job_title} at {company_name}
                
                Required structure:
                1. Opening: "Dear {recruiter_name}, I'm interested in the {job_title} position at {company_name}."
                2. Background (2-3 sentences): Include SPECIFIC college name, graduation year, major, company names from internships, and technical skills (e.g., Python, React, AWS, SQL)
                3. Closing: Brief sentence expressing interest in discussing further
                
                EXAMPLE for {char_limit} char limit (~{int((target_min + target_max) / 2)} chars):
                "Dear Sarah Johnson, I'm interested in the Machine Learning Engineer position at Google. I'm a Computer Science senior at Stanford graduating in May 2024. During my internships at Meta and Amazon, I built recommendation systems using Python, TensorFlow, and AWS, processing millions of user interactions daily. My experience optimizing ML pipelines and deploying models at scale aligns well with this role. I'd love to discuss how my background fits your team's needs."
                
                COUNT YOUR CHARACTERS as you write. Generate {target_min}-{target_max} characters NOW:
                """
                result = self.llm.invoke(extended_prompt)
                if hasattr(result, 'content'):
                    message = result.content.strip()
                elif isinstance(result, dict):
                    message = result.get('text', result.get('content', str(result))).strip()
                else:
                    message = str(result).strip()
                attempts += 1

            # Final fallback: deterministically expand without exceeding limit
            if len(message) < target_min:
                # Expansion candidates ordered by length (longest first)
                expansions = [
                    " I would value the opportunity to connect and share how my background fits.",
                    " I would appreciate connecting to share how my background aligns with this role.",
                    " I'd appreciate connecting to share how my background aligns.",
                    " I would value the opportunity to connect."
                ]
                # Try appending multiple expansions if needed
                while len(message) < target_min:
                    remaining = char_limit - len(message)
                    if remaining <= 1:
                        break
                    appended = False
                    for extra in expansions:
                        if len(extra) <= remaining:
                            candidate = (message + extra).strip()
                            if len(candidate) <= char_limit:
                                message = candidate
                                appended = True
                                if len(message) >= target_min:
                                    break
                    if not appended:
                        break
            
            # Final check and adjustment if still not in range
            if len(message) < target_min:
                print(f"⚠️  Still too short after {max_attempts} attempts ({len(message)} chars). Adding details...")
                # Add professional filler that's relevant
                additions = [
                    " I bring strong problem-solving skills and passion for innovation.",
                    " My technical expertise and collaborative approach would be valuable.",
                    " I'm eager to contribute to your team's success and grow professionally."
                ]
                for addition in additions:
                    if len(message) + len(addition) <= char_limit:
                        # Insert before the closing sentence
                        if "I'd love to discuss" in message or "I'd be happy" in message:
                            parts = message.rsplit('.', 1)
                            if len(parts) == 2:
                                message = parts[0] + '.' + addition + parts[1]
                            else:
                                message = message + addition
                        else:
                            message = message + addition
                        
                        if len(message) >= target_min:
                            break
                print(f"   → Adjusted to {len(message)} characters")
            
            elif len(message) > char_limit:
                print(f"⚠️  Final trim needed ({len(message)} > {char_limit})")
                # Final aggressive trim
                sentences = message.split('. ')
                truncated = ""
                for sentence in sentences:
                    test_msg = truncated + sentence + ('. ' if not sentence.endswith('.') else '')
                    if len(test_msg.strip()) <= char_limit:
                        truncated = test_msg
                    else:
                        break
                message = truncated.strip()
                print(f"   → Final length: {len(message)} characters")
            
            final_length = len(message)
            if target_min <= final_length <= char_limit:
                status = "✅"
            else:
                status = "⚠️"
            
            print(f"{status} Generated message ({final_length} characters, target: {target_min}-{target_max}, limit: {char_limit}):")
            print(f"💬 {message}")
            
            return message
            
        except Exception as e:
            print(f"❌ Error generating message: {e}")
            raise
    
    def process_resume_file(self, pdf_path, recruiter_name, job_title, company_name, char_limit=300):
        """
        Complete workflow: load resume and generate personalized message.
        """
        print("🚀 LinkedIn Message Generator")
        print("=" * 40)
        
        try:
            # Load resume
            resume_content = self.load_resume(pdf_path)
            
            # Generate message
            message = self.generate_message(resume_content, recruiter_name, job_title, company_name, char_limit)
            
            print("\n" + "=" * 50)
            print("📋 FINAL LINKEDIN MESSAGE:")
            print("=" * 50)
            print(message)
            print("=" * 50)
            print(f"📊 Character count: {len(message)}/{char_limit} (LinkedIn limit)")
            
            return message
            
        except Exception as e:
            print(f"❌ Error processing resume: {e}")
            return None

def main():
    """
    Main function to process a resume file.
    """
    try:
        # Initialize the generator
        generator = ResumeMessageGenerator()
        
        # Default resume file
        resume_file = "Resume-Tulsi,Shreyas.pdf"
        
        # Check if file exists
        if not os.path.exists(resume_file):
            print(f"❌ Resume file '{resume_file}' not found in current directory.")
            print("💡 Make sure the PDF file is in the same directory as this script.")
            return
        
        # Get recruiter details
        recruiter_name = input("Enter recruiter name: ").strip() or "Hiring Manager"
        job_title = input("Enter job title: ").strip() or "Software Engineer"
        company_name = input("Enter company name: ").strip() or "the company"
        
        # Process the resume
        message = generator.process_resume_file(resume_file, recruiter_name, job_title, company_name)
        
        if message:
            print("\n✅ Message generated successfully!")
            print("💡 You can now copy this message to send to recruiters.")
        else:
            print("\n❌ Failed to generate message.")
            
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        print("💡 Make sure to set OPENAI_API_KEY in your .env file")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    main()
