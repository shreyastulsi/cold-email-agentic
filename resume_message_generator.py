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
        
        # Initialize ChatOpenAI LLM with GPT-4
        self.llm = ChatOpenAI(api_key=self.openai_api_key, model_name="gpt-4", temperature=0.7)
        
        # Initialize resume parser for efficient content extraction
        try:
            from resume_parser import ResumeParser
            self.resume_parser = ResumeParser()
            print("✅ Resume parser integrated successfully")
        except Exception as e:
            print(f"⚠️  Resume parser not available: {e}")
            self.resume_parser = None
        
        # Create prompt template for personalized LinkedIn connection messages
        self.prompt_template = PromptTemplate(
            input_variables=["resume_content", "recruiter_name", "job_title", "company_name"],
            template="""
            Create a professional LinkedIn connection message.
            
            RESUME: {resume_content}
            RECRUITER: {recruiter_name}
            JOB TITLE: {job_title}
            COMPANY: {company_name}
            
            STRUCTURE (must follow exactly):
            1. "Dear [recruiter_name], I'm interested in the [job_title] position at [company_name]."
            2. Add 1-2 sentences about relevant background from resume (education, experience, skills)
            3. End with professional closing like "I'd love to discuss how my background aligns with your team's needs."
            
            REQUIREMENTS:
            - MUST be 280-295 characters (aim for 285-290)
            - Use professional words: interested, experience, background, skills, discuss, opportunity, align
            - Include specific details from resume (college, internships, technical skills)
            - Complete sentences only - no cut-offs
            - Professional, engaging tone
            
            EXAMPLE LENGTH: "Dear Sarah Johnson, I'm interested in the Software Engineering Intern position at Google. I'm a junior at Stanford studying Computer Science with internship experience at Meta and strong Python/Java skills. I'd love to discuss how my background aligns with your team's needs."
            
            Generate the message (280-295 characters):
            """
        )
        
        # Initialize the chain
        self.chain = LLMChain(llm=self.llm, prompt=self.prompt_template)
    
    def load_resume(self, pdf_path):
        """
        Load and extract text content from a PDF resume.
        """
        print(f"📄 Loading resume from: {pdf_path}")
        
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"Resume file not found: {pdf_path}")
        
        try:
            # Load PDF using LangChain's PyPDFLoader
            loader = PyPDFLoader(pdf_path)
            documents = loader.load()
            
            # Combine all pages into a single text
            resume_content = "\n".join([doc.page_content for doc in documents])
            
            print(f"✅ Successfully loaded resume ({len(documents)} pages)")
            return resume_content
            
        except Exception as e:
            print(f"❌ Error loading resume: {e}")
            raise
    
    def generate_message(self, resume_content, recruiter_name, job_title, company_name):
        """
        Generate a personalized LinkedIn connection message.
        Uses resume_parser for efficient content extraction when available.
        """
        print(f"🤖 Generating personalized message...")
        print(f"👤 Recruiter: {recruiter_name}")
        print(f"💼 Job: {job_title} at {company_name}")
        print("-" * 50)
        
        try:
            # Use resume parser to extract key bullets if available
            if self.resume_parser:
                try:
                    resume_bullets = self.resume_parser.extract_key_bullets(resume_content)
                    # Use condensed bullets instead of full resume content
                    short_resume = resume_bullets
                except Exception as e:
                    print(f"⚠️  Resume parser failed, using truncated content: {e}")
                    short_resume = resume_content[:1500] + "..." if len(resume_content) > 1500 else resume_content
            else:
                # Truncate resume to avoid token limits
                short_resume = resume_content[:1500] + "..." if len(resume_content) > 1500 else resume_content
            
            # Generate message using the LLM chain
            result = self.chain.invoke({
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
            
            # Ensure message is within 280-295 character range
            if len(message) < 280:
                # Message too short - regenerate with explicit length requirement
                print(f"⚠️  Message too short ({len(message)} chars), regenerating...")
                extended_prompt = f"""
                The previous message was too short. Create a LinkedIn message that is EXACTLY 280-295 characters.
                
                RESUME: {short_resume[:500]}
                RECRUITER: {recruiter_name}
                JOB: {job_title} at {company_name}
                
                Must include:
                - "Dear {recruiter_name}, I'm interested in the {job_title} position at {company_name}."
                - Specific background details (college, year, major, internships, skills)
                - Professional closing
                - EXACTLY 280-295 characters total
                
                Generate longer message:
                """
                
                result = self.llm.invoke(extended_prompt)
                if hasattr(result, 'content'):
                    message = result.content.strip()
                elif isinstance(result, dict):
                    message = result.get('text', result.get('content', str(result))).strip()
                else:
                    message = str(result).strip()
            
            if len(message) > 295:
                # Find last complete sentence within limit
                sentences = message.split('. ')
                truncated = ""
                for sentence in sentences:
                    test_msg = truncated + sentence + ('. ' if not sentence.endswith('.') else '')
                    if len(test_msg.strip()) <= 295:
                        truncated = test_msg
                    else:
                        break
                message = truncated.strip()
            
            print(f"✅ Generated message ({len(message)} characters):")
            print(f"💬 {message}")
            
            return message
            
        except Exception as e:
            print(f"❌ Error generating message: {e}")
            raise
    
    def process_resume_file(self, pdf_path, recruiter_name, job_title, company_name):
        """
        Complete workflow: load resume and generate personalized message.
        """
        print("🚀 LinkedIn Message Generator")
        print("=" * 40)
        
        try:
            # Load resume
            resume_content = self.load_resume(pdf_path)
            
            # Generate message
            message = self.generate_message(resume_content, recruiter_name, job_title, company_name)
            
            print("\n" + "=" * 50)
            print("📋 FINAL LINKEDIN MESSAGE:")
            print("=" * 50)
            print(message)
            print("=" * 50)
            print(f"📊 Character count: {len(message)}/295 (LinkedIn limit)")
            
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
