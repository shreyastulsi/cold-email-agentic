#!/usr/bin/env python3
"""
Resume Message Generator - Creates personalized messages from resume content
Uses LangChain to process PDF resumes and generate 300-character messages
"""

import os
import sys
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

load_dotenv()

class ResumeMessageGenerator:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        # Initialize OpenAI LLM
        self.llm = OpenAI(api_key=self.openai_api_key, temperature=0.7)
        
        # Create prompt template for message generation
        self.prompt_template = PromptTemplate(
            input_variables=["resume_content", "recruiter_context"],
            template="""
            Based on the following resume content, create a personalized 300-character message for a recruiter.
            
            Resume Content:
            {resume_content}
            
            Context: {recruiter_context}
            
            Requirements:
            - Maximum 300 characters
            - Professional and engaging tone
            - Highlight key skills and experience
            - Show enthusiasm for opportunities
            - Include a call to action
            
            Message:
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
    
    def generate_message(self, resume_content, recruiter_context="general recruitment opportunity"):
        """
        Generate a personalized message based on resume content.
        """
        print(f"🤖 Generating personalized message...")
        print(f"📝 Context: {recruiter_context}")
        print("-" * 50)
        
        try:
            # Generate message using the LLM chain
            result = self.chain.invoke({
                "resume_content": resume_content,
                "recruiter_context": recruiter_context
            })
            
            # Extract text from the result (invoke returns a dict with 'text' key)
            message = result.get('text', str(result)).strip()
            
            # Truncate if over 300 characters
            if len(message) > 300:
                message = message[:297] + "..."
            
            print(f"✅ Generated message ({len(message)} characters):")
            print(f"💬 {message}")
            
            return message
            
        except Exception as e:
            print(f"❌ Error generating message: {e}")
            raise
    
    def process_resume_file(self, pdf_path, recruiter_context="general recruitment opportunity"):
        """
        Complete workflow: load resume and generate message.
        """
        print("🚀 Resume Message Generator")
        print("=" * 40)
        
        try:
            # Load resume
            resume_content = self.load_resume(pdf_path)
            
            # Generate message
            message = self.generate_message(resume_content, recruiter_context)
            
            print("\n" + "=" * 50)
            print("📋 FINAL MESSAGE:")
            print("=" * 50)
            print(message)
            print("=" * 50)
            print(f"📊 Character count: {len(message)}/300")
            
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
        
        # Optional: Get custom recruiter context
        recruiter_context = input("Enter recruiter context (or press Enter for default): ").strip()
        if not recruiter_context:
            recruiter_context = "general recruitment opportunity"
        
        # Process the resume
        message = generator.process_resume_file(resume_file, recruiter_context)
        
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
