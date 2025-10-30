#!/usr/bin/env python3
"""
Unified LinkedIn Messenger - Clean solution for messaging through Unipile
Supports both existing chats and new connections via name or LinkedIn URL
"""

import os
import requests
import re
import json
from dotenv import load_dotenv
from resume_message_generator import ResumeMessageGenerator

load_dotenv()

class UnifiedMessenger:
    def __init__(self):
        # Force reload environment variables
        load_dotenv(override=True)
        self.api_key = os.getenv('UNIPILE_API_KEY')
        self.apollo_api_key = os.getenv('APOLLO_API_KEY')
        self.base_url = "https://api12.unipile.com:14267/api/v1"
        self.account_id = "23mPl6ZwTiC3Qv-bHez0Pg"
        
        self.headers = {
            'X-API-KEY': self.api_key,
            'accept': 'application/json'
        }
        
        if not self.api_key:
            raise ValueError("UNIPILE_API_KEY not found in environment variables")
        
        # Debug: Print Apollo API key status
        if self.apollo_api_key:
            print(f"✅ Apollo API key loaded: {self.apollo_api_key[:10]}...")
        else:
            print("❌ Apollo API key not found in environment variables")
        
        # Initialize resume message generator
        try:
            self.resume_generator = ResumeMessageGenerator()
            print("✅ Resume message generator initialized successfully")
        except ValueError as e:
            print(f"⚠️  Resume generator not available: {e}")
            print("⚠️  Please check your OPENAI_API_KEY in .env file")
            self.resume_generator = None
        except Exception as e:
            print(f"⚠️  Resume generator initialization failed: {e}")
            self.resume_generator = None

    def extract_linkedin_identifier(self, linkedin_url):
        """
        Extract the public identifier from a LinkedIn URL.
        Example: https://www.linkedin.com/in/julien-crepieux/ -> julien-crepieux
        """
        # Remove trailing slash and extract the last part
        identifier = linkedin_url.rstrip('/').split('/')[-1]
        return identifier

    def get_provider_id_from_linkedin_url(self, linkedin_url):
        """
        Convert LinkedIn profile URL to Provider ID using Unipile's users endpoint.
        """
        identifier = self.extract_linkedin_identifier(linkedin_url)
        
        print(f"🔍 Converting LinkedIn URL to Provider ID...")
        print(f"📝 URL: {linkedin_url}")
        print(f"🆔 Identifier: {identifier}")
        print("-" * 50)
        
        try:
            # Use the users endpoint with the identifier
            response = requests.get(
                f"{self.base_url}/users/{identifier}",
                headers=self.headers,
                params={'account_id': self.account_id}
            )
            
            if response.status_code == 200:
                result = response.json()
                provider_id = result.get('provider_id')
                name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
                network_distance = result.get('network_distance', 'Unknown')
                
                print(f"✅ Successfully converted!")
                print(f"👤 Name: {name}")
                print(f"🆔 Provider ID: {provider_id}")
                print(f"🔗 Network Distance: {network_distance}")
                
                return provider_id, result
            else:
                print(f"❌ Failed to convert URL")
                print(f"📄 Response: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return None, None

    def find_existing_chat_by_name(self, search_name):
        """
        Find existing chat by searching for a person's name in messages.
        """
        print(f"🔍 Searching for existing chat with '{search_name}'...")
        
        try:
            # Get all chats
            response = requests.get(f"{self.base_url}/chats", headers=self.headers)
            response.raise_for_status()
            chats_data = response.json()
            chats = chats_data.get('items', [])
            
            print(f"📊 Found {len(chats)} total chats")
            
            # Search through each chat's messages
            for i, chat in enumerate(chats):
                chat_id = chat.get('id')
                user_id = chat.get('attendee_provider_id')
                
                try:
                    # Get messages from this chat
                    msg_response = requests.get(
                        f"{self.base_url}/chats/{chat_id}/messages", 
                        headers=self.headers
                    )
                    
                    if msg_response.status_code == 200:
                        messages_data = msg_response.json()
                        messages = messages_data.get('items', [])
                        
                        # Search through messages for the name
                        for message in messages:
                            text = message.get('text', '').lower()
                            
                            if search_name.lower() in text:
                                print(f"✅ Found existing chat with '{search_name}'")
                                print(f"🆔 Chat ID: {chat_id}")
                                print(f"👤 User ID: {user_id}")
                                return chat_id, user_id
                                
                except Exception:
                    continue
            
            print(f"❌ No existing chat found with '{search_name}'")
            return None, None
            
        except Exception as e:
            print(f"❌ Error searching chats: {e}")
            return None, None

    def send_message_to_existing_chat(self, chat_id, message):
        """
        Send message to an existing chat.
        """
        print(f"\n📤 Sending message to existing chat...")
        print(f"🆔 Chat ID: {chat_id}")
        print(f"💬 Message: {message}")
        print("-" * 50)
        
        try:
            response = requests.post(
                f"{self.base_url}/chats/{chat_id}/messages",
                headers=self.headers,
                data={'text': message}
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Message sent successfully!")
                print(f"📨 Message ID: {result.get('id', result.get('message_id', 'Unknown'))}")
                return True, result
            else:
                print(f"❌ Failed to send message")
                return False, response.text
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False, str(e)

    def send_message_to_new_user(self, provider_id, message, use_inmail=False):
        """
        Send message to a new user (creates new chat).
        """
        print(f"\n📤 Sending message to new user...")
        print(f"🆔 Provider ID: {provider_id}")
        print(f"💬 Message: {message}")
        print(f"📧 InMail: {'Yes' if use_inmail else 'No'}")
        print("-" * 50)
        
        data = {
            'account_id': self.account_id,
            'text': message,
            'attendees_ids': provider_id
        }
        
        # Add InMail parameter if requested
        if use_inmail:
            data['linkedin[inmail]'] = 'true'
        
        try:
            response = requests.post(
                f"{self.base_url}/chats",
                headers=self.headers,
                data=data
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Message sent successfully!")
                print(f"📤 Chat ID: {result.get('chat_id', result.get('id', 'Unknown'))}")
                print(f"📨 Message ID: {result.get('message_id', 'Unknown')}")
                return True, result
            else:
                print(f"❌ Failed to send message")
                return False, response.text
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False, str(e)

    def send_invitation(self, provider_id, message="I'd like to connect with you on LinkedIn."):
        """
        Send a LinkedIn connection invitation.
        """
        print(f"\n📨 Sending connection invitation...")
        print(f"🆔 Provider ID: {provider_id}")
        print(f"💬 Message: {message}")
        print("-" * 50)
        
        data = {
            'account_id': self.account_id,
            'provider_id': provider_id,
            'message': message
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/users/invite",
                headers=self.headers,
                json=data
            )
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Invitation sent successfully!")
                print(f"📨 Invitation ID: {result.get('invitation_id', 'Unknown')}")
                return True, result
            else:
                print(f"❌ Failed to send invitation")
                return False, response.text
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False, str(e)

    def search_company(self, company_name):
        """
        Search for a company on LinkedIn and return its company ID.
        """
        print(f"🔍 Searching for company: {company_name}")
        
        try:
            data = {
                "api": "classic",
                "category": "companies",
                "keywords": company_name
            }
            
            response = requests.post(
                f"{self.base_url}/linkedin/search",
                headers={**self.headers, 'content-type': 'application/json'},
                params={'account_id': self.account_id},
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                items = result.get('items', [])
                
                if items:
                    company = items[0]  # Take the first result
                    company_id = company.get('id')
                    company_name_found = company.get('name')
                    
                    print(f"✅ Found company: {company_name_found} (ID: {company_id})")
                    return company_id, company
                else:
                    print(f"❌ No company found with name: {company_name}")
                    return None, None
            else:
                print(f"❌ Failed to search company: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ Error searching company: {e}")
            return None, None

    def search_jobs(self, company_ids, job_titles, job_type, location_id="102571732"):
        """
        Search for jobs using LinkedIn API - sends separate request for each company.
        """
        print(f"🔍 Searching for {job_type} jobs...")
        print(f"🏢 Companies: {company_ids}")
        print(f"💼 Job titles: {job_titles}")
        
        all_jobs = []
        
        for company_id in company_ids:
            try:
                print(f"🔍 Searching jobs at company ID: {company_id}")
                
                data = {
                    "api": "classic",
                    "category": "jobs",
                    "job_type": [job_type],
                    "company": [company_id],  # Single company per request
                    "keywords": " ".join(job_titles),
                    "sort_by": "date",
                    "locations": [location_id]
                }
                
                response = requests.post(
                    f"{self.base_url}/linkedin/search",
                    headers={**self.headers, 'content-type': 'application/json'},
                    params={'account_id': self.account_id},
                    json=data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    items = result.get('items', [])
                    all_jobs.extend(items)
                    print(f"✅ Found {len(items)} jobs for company {company_id}")
                else:
                    print(f"❌ Failed to search jobs for company {company_id}: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error searching jobs for company {company_id}: {e}")
                continue
        
        print(f"✅ Total found {len(all_jobs)} job listings across all companies")
        return all_jobs

    def search_recruiters(self, company_ids, keywords="recruiter"):
        """
        Search for recruiters using LinkedIn API - sends separate request for each company.
        """
        print(f"🔍 Searching for recruiters...")
        print(f"🏢 Companies: {company_ids}")
        print(f"🔑 Keywords: {keywords}")
        
        all_recruiters = []
        
        for company_id in company_ids:
            try:
                print(f"🔍 Searching recruiters at company ID: {company_id}")
                
                data = {
                    "api": "classic",
                    "category": "people",
                    "profile_language": ["en"],
                    "company": [company_id],  # Single company per request
                    "keywords": keywords
                }
                
                response = requests.post(
                    f"{self.base_url}/linkedin/search",
                    headers={**self.headers, 'content-type': 'application/json'},
                    params={'account_id': self.account_id},
                    json=data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    items = result.get('items', [])
                    all_recruiters.extend(items)
                    print(f"✅ Found {len(items)} recruiters for company {company_id}")
                else:
                    print(f"❌ Failed to search recruiters for company {company_id}: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error searching recruiters for company {company_id}: {e}")
                continue
        
        print(f"✅ Total found {len(all_recruiters)} recruiters across all companies")
        return all_recruiters

    def display_jobs(self, jobs):
        """
        Display job listings in a formatted way, grouped by company.
        """
        if not jobs:
            print("❌ No jobs found")
            return
        
        # Group jobs by company
        jobs_by_company = {}
        for job in jobs:
            company_name = job.get('company', {}).get('name', 'Unknown Company')
            if company_name not in jobs_by_company:
                jobs_by_company[company_name] = []
            jobs_by_company[company_name].append(job)
        
        print("\n" + "="*80)
        print("📋 JOB LISTINGS")
        print("="*80)
        print(f"📊 Total jobs found: {len(jobs)} across {len(jobs_by_company)} companies")
        print("="*80)
        
        job_counter = 1
        for company_name, company_jobs in jobs_by_company.items():
            print(f"\n🏢 {company_name} ({len(company_jobs)} jobs)")
            print("-" * 60)
            
            for job in company_jobs:
                print(f"\n{job_counter}. {job.get('title', 'N/A')}")
                print(f"   📍 Location: {job.get('location', 'N/A')}")
                print(f"   💰 Salary: {', '.join(job.get('benefits', ['N/A']))}")
                print(f"   📅 Posted: {job.get('posted_at', 'N/A')}")
                print(f"   🔗 URL: {job.get('url', 'N/A')}")
                print(f"   ⚡ Easy Apply: {'Yes' if job.get('easy_apply') else 'No'}")
                job_counter += 1

    def display_recruiters(self, recruiters):
        """
        Display recruiter information in a formatted way, grouped by company.
        """
        if not recruiters:
            print("❌ No recruiters found")
            return
        
        # Group recruiters by company
        recruiters_by_company = {}
        for recruiter in recruiters:
            # Extract company name from keywords_match or use a default
            company_info = recruiter.get('keywords_match', 'Unknown Company')
            if 'Current:' in company_info:
                company_name = company_info.split('Current:')[1].split(' at ')[-1].strip()
            else:
                company_name = 'Unknown Company'
            
            if company_name not in recruiters_by_company:
                recruiters_by_company[company_name] = []
            recruiters_by_company[company_name].append(recruiter)
        
        print("\n" + "="*80)
        print("👥 RECRUITERS")
        print("="*80)
        print(f"📊 Total recruiters found: {len(recruiters)} across {len(recruiters_by_company)} companies")
        print("="*80)
        
        recruiter_counter = 1
        for company_name, company_recruiters in recruiters_by_company.items():
            print(f"\n🏢 {company_name} ({len(company_recruiters)} recruiters)")
            print("-" * 60)
            
            for recruiter in company_recruiters:
                print(f"\n{recruiter_counter}. {recruiter.get('name', 'N/A')}")
                print(f"   📍 Location: {recruiter.get('location', 'N/A')}")
                print(f"   💼 Headline: {recruiter.get('headline', 'N/A')}")
                print(f"   🔗 Profile: {recruiter.get('profile_url', 'N/A')}")
                print(f"   👥 Followers: {recruiter.get('followers_count', 'N/A')}")
                print(f"   ✅ Verified: {'Yes' if recruiter.get('verified') else 'No'}")
                recruiter_counter += 1

    def is_linkedin_url(self, text):
        """
        Check if the input text is a LinkedIn URL.
        """
        linkedin_pattern = r'https?://(?:www\.)?linkedin\.com/in/[^/\s]+/?'
        return bool(re.match(linkedin_pattern, text.strip()))

    def job_search_workflow(self):
        """
        Interactive workflow for job and recruiter search.
        """
        print("\n🔍 LinkedIn Job & Recruiter Search")
        print("=" * 50)
        
        # Get company names
        print("\n📝 Enter company names (comma-separated):")
        company_input = input("Companies: ").strip()
        if not company_input:
            print("❌ No companies provided. Exiting.")
            return
            
        company_names = [name.strip() for name in company_input.split(',')]
        print(f"🏢 Searching for companies: {', '.join(company_names)}")
        
        # Search for company IDs
        company_ids = []
        for company_name in company_names:
            company_id, company_info = self.search_company(company_name)
            if company_id:
                company_ids.append(company_id)
            else:
                print(f"⚠️  Skipping {company_name} - not found")
        
        if not company_ids:
            print("❌ No valid companies found. Exiting.")
            return
            
        # Get job titles
        print("\n💼 Enter job titles (comma-separated):")
        job_input = input("Job titles: ").strip()
        if not job_input:
            print("❌ No job titles provided. Exiting.")
            return
            
        job_titles = [title.strip() for title in job_input.split(',')]
        print(f"💼 Searching for roles: {', '.join(job_titles)}")
        
        # Get job type
        print("\n📋 Select job type:")
        print("1. Full-time")
        print("2. Internship")
        job_type_choice = input("Enter choice (1/2): ").strip()
        
        if job_type_choice == "1":
            job_type = "full_time"
        elif job_type_choice == "2":
            job_type = "internship"
        else:
            print("❌ Invalid choice. Defaulting to full_time.")
            job_type = "full_time"
        
        print(f"📋 Job type: {job_type}")
        
        # Search for jobs
        print("\n" + "="*50)
        jobs = self.search_jobs(company_ids, job_titles, job_type)
        self.display_jobs(jobs)
        
        # Search for recruiters
        print("\n" + "="*50)
        recruiters = self.search_recruiters(company_ids)
        self.display_recruiters(recruiters)
        
        # Enhanced outreach options with email extraction
        if recruiters:
            print("\n" + "="*50)
            print("🚀 ENHANCED OUTREACH OPTIONS")
            print("="*50)
            print("1. Basic LinkedIn invitations only")
            print("2. Enhanced dual outreach (LinkedIn + Email extraction)")
            print("3. Skip outreach")
            
            outreach_choice = input("Choose outreach method (1-3): ").strip()
            
            if outreach_choice == "1":
                self.send_connection_invitations_to_recruiters(recruiters, job_titles, job_type)
            elif outreach_choice == "2":
                self.enhanced_dual_outreach(recruiters, job_titles, job_type)
            else:
                print("✅ Search completed without sending invitations.")
        else:
            print("\n✅ Search completed - no recruiters found.")

    def send_connection_invitations_to_recruiters(self, recruiters, job_titles, job_type):
        """
        Send connection invitations to all recruiters with personalized messages.
        """
        print(f"\n📨 Sending connection invitations to {len(recruiters)} recruiters...")
        print("=" * 60)
        
        # Generate personalized message using resume content
        if self.resume_generator:
            try:
                # Load resume content
                resume_file = "Resume-Tulsi,Shreyas.pdf"
                if os.path.exists(resume_file):
                    resume_content = self.resume_generator.load_resume(resume_file)
                    
                    # Create context for the message
                    job_context = f"opportunities in {', '.join(job_titles)} roles ({job_type})"
                    
                    # Generate personalized message
                    personalized_message = self.resume_generator.generate_message(
                        resume_content, job_context
                    )
                    
                    print(f"📝 Generated personalized message:")
                    print(f"💬 {personalized_message}")
                    print("-" * 60)
                    
                else:
                    print("⚠️  Resume file not found, using default message.")
                    personalized_message = "Hi! I'm interested in connecting to learn about opportunities at your company. I'd love to discuss potential roles that align with my background."
                    
            except Exception as e:
                print(f"⚠️  Error generating personalized message: {e}")
                personalized_message = "Hi! I'm interested in connecting to learn about opportunities at your company. I'd love to discuss potential roles that align with my background."
        else:
            print("⚠️  Resume generator not available, using default message.")
            personalized_message = "Hi! I'm interested in connecting to learn about opportunities at your company. I'd love to discuss potential roles that align with my background."
        
        # Send invitations to each recruiter
        successful_invitations = 0
        failed_invitations = 0
        
        for i, recruiter in enumerate(recruiters, 1):
            print(f"\n📤 Sending invitation {i}/{len(recruiters)}")
            print(f"👤 Recruiter: {recruiter.get('name', 'Unknown')}")
            print(f"🏢 Company: {recruiter.get('company', 'Unknown')}")
            
            # Get LinkedIn URL and convert to provider ID
            linkedin_url = recruiter.get('profile_url')
            if linkedin_url:
                provider_id, user_info = self.get_provider_id_from_linkedin_url(linkedin_url)
                
                if provider_id:
                    # Send connection invitation
                    success, result = self.send_invitation(provider_id, personalized_message)
                    
                    if success:
                        successful_invitations += 1
                        print(f"✅ Invitation sent successfully!")
                    else:
                        failed_invitations += 1
                        print(f"❌ Failed to send invitation: {result}")
                else:
                    failed_invitations += 1
                    print(f"❌ Could not convert LinkedIn URL to Provider ID")
            else:
                failed_invitations += 1
                print(f"❌ No LinkedIn URL available for this recruiter")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 INVITATION SUMMARY")
        print("=" * 60)
        print(f"✅ Successful invitations: {successful_invitations}")
        print(f"❌ Failed invitations: {failed_invitations}")
        print(f"📈 Success rate: {(successful_invitations/len(recruiters)*100):.1f}%")
        print("=" * 60)
    
    def extract_email_from_linkedin(self, linkedin_url):
        """
        Extract email from LinkedIn URL using Apollo API.
        """
        if not self.apollo_api_key:
            return None, None
        
        try:
            apollo_url = "https://api.apollo.io/api/v1/people/match"
            apollo_headers = {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'x-api-key': self.apollo_api_key
            }
            
            params = {
                'linkedin_url': linkedin_url,
                'reveal_personal_emails': 'false',
                'reveal_phone_number': 'false'
            }
            
            response = requests.post(apollo_url, headers=apollo_headers, params=params)
            
            if response.status_code == 200:
                result = response.json()
                person = result.get('person', {})
                
                if person:
                    email = person.get('email', 'Not found')
                    return email, person
                else:
                    return None, None
            else:
                return None, None
                
        except Exception as e:
            return None, None
    
    def extract_emails_for_recruiters(self, recruiters):
        """
        Extract emails for a list of recruiters using Apollo API.
        """
        print(f"\n🔍 Extracting emails for {len(recruiters)} recruiters...")
        recruiters_with_emails = []
        
        for i, recruiter in enumerate(recruiters, 1):
            print(f"🔍 Processing {i}/{len(recruiters)}: {recruiter.get('name', 'Unknown')}")
            
            linkedin_url = recruiter.get('profile_url')
            if linkedin_url:
                email, person_data = self.extract_email_from_linkedin(linkedin_url)
                recruiter_copy = recruiter.copy()
                recruiter_copy['extracted_email'] = email if email and email != 'Not found' else 'Not found'
                recruiter_copy['apollo_data'] = person_data
                recruiters_with_emails.append(recruiter_copy)
                
                if email and email != 'Not found':
                    print(f"✅ Email found: {email}")
                else:
                    print(f"❌ No email found")
            else:
                recruiter_copy = recruiter.copy()
                recruiter_copy['extracted_email'] = 'No LinkedIn URL'
                recruiter_copy['apollo_data'] = None
                recruiters_with_emails.append(recruiter_copy)
                print("❌ No LinkedIn URL available")
        
        return recruiters_with_emails
    
    def generate_email_content(self, job_titles, job_type, recruiter, resume_content):
        """
        Generate professional email content for recruiter outreach.
        """
        recruiter_name = recruiter.get('name', 'Hiring Manager')
        company_name = 'your company'
        
        # Try to get company from recruiter data
        if recruiter.get('apollo_data') and recruiter['apollo_data'].get('organization'):
            company_name = recruiter['apollo_data']['organization'].get('name', 'your company')
        
        job_titles_str = ', '.join(job_titles)
        
        # Create email generation prompt
        email_prompt = f"""
        Generate a professional email for job application outreach following this structure:
        
        Subject: Interest in {job_titles_str} Opportunities at {company_name}
        
        Email Body:
        Dear {recruiter_name},
        
        [Opening paragraph expressing interest in {job_titles_str} roles]
        [Middle paragraph highlighting 2-3 most relevant qualifications from resume]
        [Closing paragraph with call to action]
        
        Best regards,
        [Your Name]
        
        Job Details:
        - Roles: {job_titles_str}
        - Type: {job_type}
        - Company: {company_name}
        - Recruiter: {recruiter_name}
        
        Resume Content:
        {resume_content[:1500] if resume_content else 'No resume content available'}
        
        Requirements:
        1. Professional and concise tone
        2. Specific mention of the roles and company
        3. Highlight most relevant experience/skills from resume
        4. Include clear call to action
        5. Keep email body under 200 words
        6. Use proper email formatting
        
        Return the email in this format:
        SUBJECT: [subject line]
        
        BODY:
        [email body]
        """
        
        try:
            if self.resume_generator:
                result = self.resume_generator.llm.invoke(email_prompt)
                if isinstance(result, dict):
                    email_content = result.get('text', str(result)).strip()
                else:
                    email_content = str(result).strip()
                
                # Parse subject and body
                if 'SUBJECT:' in email_content and 'BODY:' in email_content:
                    parts = email_content.split('BODY:', 1)
                    subject = parts[0].replace('SUBJECT:', '').strip()
                    body = parts[1].strip()
                else:
                    subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
                    body = email_content
                
                return subject, body
            else:
                subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
                body = f"Dear {recruiter_name},\n\nI am writing to express my interest in {job_titles_str} opportunities at {company_name}. I believe my background and experience make me a strong candidate for these roles.\n\nI would welcome the opportunity to discuss how my skills align with your team's needs.\n\nBest regards,\n[Your Name]"
                return subject, body
                
        except Exception as e:
            print(f"⚠️  Error generating email: {e}")
            subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
            body = f"Dear {recruiter_name},\n\nI am writing to express my interest in {job_titles_str} opportunities at {company_name}. I believe my background and experience make me a strong candidate for these roles.\n\nI would welcome the opportunity to discuss how my skills align with your team's needs.\n\nBest regards,\n[Your Name]"
            return subject, body
    
    def enhanced_dual_outreach(self, recruiters, job_titles, job_type):
        """
        Enhanced outreach with email extraction and dual channel messaging.
        """
        print(f"\n🚀 Starting enhanced dual outreach for {len(recruiters)} recruiters...")
        
        # Extract emails for all recruiters
        recruiters_with_emails = self.extract_emails_for_recruiters(recruiters)
        
        # Load resume content
        resume_content = None
        if self.resume_generator:
            try:
                resume_file = "Resume-Tulsi,Shreyas.pdf"
                if os.path.exists(resume_file):
                    resume_content = self.resume_generator.load_resume(resume_file)
            except Exception as e:
                print(f"⚠️  Could not load resume: {e}")
        
        # Generate LinkedIn message template
        if resume_content and self.resume_generator:
            job_context = f"opportunities in {', '.join(job_titles)} roles ({job_type})"
            try:
                linkedin_message = self.resume_generator.generate_message(resume_content, job_context)
            except:
                linkedin_message = f"Hi! I'm interested in {', '.join(job_titles)} opportunities at your company. I'd love to connect and discuss potential roles."
        else:
            linkedin_message = f"Hi! I'm interested in {', '.join(job_titles)} opportunities at your company. I'd love to connect and discuss potential roles."
        
        # Show preview of outreach campaign
        print(f"\n📨 DUAL OUTREACH CAMPAIGN PREVIEW")
        print("=" * 60)
        print(f"🎯 Target Roles: {', '.join(job_titles)} ({job_type})")
        print(f"👥 Total Recipients: {len(recruiters_with_emails)}")
        
        # Show contact methods breakdown
        email_count = sum(1 for r in recruiters_with_emails if r.get('extracted_email') and r['extracted_email'] != 'Not found')
        linkedin_count = sum(1 for r in recruiters_with_emails if r.get('profile_url'))
        
        print(f"📧 Recruiters with emails: {email_count}")
        print(f"🔗 Recruiters with LinkedIn: {linkedin_count}")
        
        # Show LinkedIn message template
        print(f"\n🔗 LINKEDIN MESSAGE TEMPLATE:")
        print("-" * 40)
        print(f"💬 {linkedin_message}")
        print(f"📊 Length: {len(linkedin_message)} characters")
        
        # Show email preview for first recruiter with email
        email_recruiter = next((r for r in recruiters_with_emails if r.get('extracted_email') and r['extracted_email'] != 'Not found'), None)
        if email_recruiter and resume_content:
            subject, body = self.generate_email_content(job_titles, job_type, email_recruiter, resume_content)
            print(f"\n📧 EMAIL TEMPLATE (Sample):")
            print("-" * 40)
            print(f"📝 Subject: {subject}")
            print(f"\n💬 Body Preview:")
            print(body[:200] + "..." if len(body) > 200 else body)
        
        # Show detailed recipient list
        print(f"\n👥 RECIPIENTS & CONTACT METHODS:")
        print("-" * 40)
        for i, recruiter in enumerate(recruiters_with_emails, 1):
            name = recruiter.get('name', 'Unknown')
            email = recruiter.get('extracted_email', 'Not found')
            linkedin_available = 'Yes' if recruiter.get('profile_url') else 'No'
            
            print(f"{i}. {name}")
            print(f"   📧 Email: {email}")
            print(f"   🔗 LinkedIn: {linkedin_available}")
            methods = []
            if email != 'Not found': methods.append('Email')
            if linkedin_available == 'Yes': methods.append('LinkedIn')
            print(f"   📝 Methods: {' + '.join(methods) if methods else 'No contact method'}")
        
        # Confirmation
        print("\n" + "=" * 60)
        print("❓ CONFIRMATION REQUIRED")
        print("=" * 60)
        confirm = input("Proceed with dual outreach campaign? (y/n): ").strip().lower()
        
        if confirm != 'y':
            print("❌ Campaign cancelled by user.")
            return
        
        # Execute campaign
        print(f"\n🚀 Executing dual outreach campaign...")
        print("=" * 60)
        
        successful_linkedin = 0
        failed_linkedin = 0
        successful_emails = 0
        failed_emails = 0
        
        for i, recruiter in enumerate(recruiters_with_emails, 1):
            print(f"\n📤 Processing recruiter {i}/{len(recruiters_with_emails)}")
            recruiter_name = recruiter.get('name', 'Unknown')
            print(f"👤 Recruiter: {recruiter_name}")
            
            # Send LinkedIn invitation
            linkedin_url = recruiter.get('profile_url')
            if linkedin_url:
                provider_id, user_info = self.get_provider_id_from_linkedin_url(linkedin_url)
                if provider_id:
                    success, result = self.send_invitation(provider_id, linkedin_message)
                    if success:
                        successful_linkedin += 1
                        print(f"✅ LinkedIn invitation sent successfully!")
                    else:
                        failed_linkedin += 1
                        print(f"❌ LinkedIn invitation failed: {result}")
                else:
                    failed_linkedin += 1
                    print(f"❌ Could not convert LinkedIn URL to Provider ID")
            else:
                failed_linkedin += 1
                print(f"❌ No LinkedIn URL available")
            
            # Generate and display email content (not actually sent)
            email = recruiter.get('extracted_email')
            if email and email != 'Not found' and resume_content:
                try:
                    subject, body = self.generate_email_content(job_titles, job_type, recruiter, resume_content)
                    
                    print(f"📧 EMAIL CONTENT (Would be sent to: {email}):")
                    print(f"   📝 Subject: {subject}")
                    print(f"   💬 Body: {body[:100]}...")
                    successful_emails += 1
                except Exception as e:
                    failed_emails += 1
                    print(f"❌ Email generation failed: {e}")
            else:
                failed_emails += 1
                if not email or email == 'Not found':
                    print(f"❌ No email address available")
                else:
                    print(f"❌ Resume not available for email generation")
        
        # Campaign summary
        print("\n" + "=" * 60)
        print("📊 DUAL OUTREACH CAMPAIGN SUMMARY")
        print("=" * 60)
        print(f"🎯 Target Roles: {', '.join(job_titles)} ({job_type})")
        print(f"🔗 LinkedIn Messages - Success: {successful_linkedin}, Failed: {failed_linkedin}")
        print(f"📧 Email Content Generated - Success: {successful_emails}, Failed: {failed_emails}")
        total_attempts = len(recruiters_with_emails) * 2
        total_success = successful_linkedin + successful_emails
        print(f"📈 Overall Success Rate: {(total_success/total_attempts*100):.1f}%")
        print("=" * 60)

    def main(self):
        """
        Main interactive function.
        """
        print("💬 Unified LinkedIn Messenger")
        print("=" * 40)
        print("📝 Options:")
        print("1. Enter a person's name (searches existing chats)")
        print("2. Enter a LinkedIn profile URL (creates new chat)")
        print("3. Send connection invitation")
        print("4. Search jobs and recruiters")
        print()
        
        # Get user choice
        choice = input("Enter your choice (1-4): ").strip()
        
        if choice == "4":
            self.job_search_workflow()
            return
        
        # Get user input for messaging options
        user_input = input("Enter name or LinkedIn URL: ").strip()
        
        if not user_input:
            print("❌ No input provided. Exiting.")
            return
        
        # Determine if it's a LinkedIn URL or name
        if self.is_linkedin_url(user_input):
            print(f"\n🔗 LinkedIn URL detected: {user_input}")
            
            # Convert URL to Provider ID
            provider_id, user_info = self.get_provider_id_from_linkedin_url(user_input)
            
            if not provider_id:
                print("❌ Could not convert LinkedIn URL to Provider ID.")
                return
            
            # Check network distance
            network_distance = user_info.get('network_distance', 'Unknown') if user_info else 'Unknown'
            
            if network_distance == 'FIRST_DEGREE':
                print("✅ This person is a first-degree connection.")
                action = input("\nChoose action:\n1. Send message\n2. Send invitation\nEnter choice (1/2): ").strip()
                
                if action == "1":
                    message = input("Enter your message: ").strip()
                    if message:
                        self.send_message_to_new_user(provider_id, message)
                elif action == "2":
                    message = input("Enter invitation message (or press Enter for default): ").strip()
                    if not message:
                        message = "I'd like to connect with you on LinkedIn."
                    self.send_invitation(provider_id, message)
                else:
                    print("❌ Invalid choice.")
            else:
                print(f"⚠️  This person is {network_distance.lower()} connection.")
                print("💡 Options:")
                print("1. Send InMail (requires Premium LinkedIn)")
                print("2. Send connection invitation")
                
                action = input("Enter choice (1/2): ").strip()
                
                if action == "1":
                    message = input("Enter your InMail message: ").strip()
                    if message:
                        self.send_message_to_new_user(provider_id, message, use_inmail=True)
                elif action == "2":
                    message = input("Enter invitation message (or press Enter for default): ").strip()
                    if not message:
                        message = "I'd like to connect with you on LinkedIn."
                    self.send_invitation(provider_id, message)
                else:
                    print("❌ Invalid choice.")
        
        else:
            print(f"\n👤 Name detected: {user_input}")
            
            # Search for existing chat
            chat_id, user_id = self.find_existing_chat_by_name(user_input)
            
            if chat_id:
                print(f"✅ Found existing chat!")
                message = input("Enter your message: ").strip()
                if message:
                    self.send_message_to_existing_chat(chat_id, message)
            else:
                print(f"❌ No existing chat found with '{user_input}'")
                print("💡 Try using their LinkedIn profile URL instead.")

def main():
    """Entry point for the script."""
    try:
        messenger = UnifiedMessenger()
        messenger.main()
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        print("💡 Make sure to set UNIPILE_API_KEY in your .env file")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    main()
