#!/usr/bin/env python3
"""
Unified LinkedIn Messenger - Clean solution for messaging through Unipile
Supports both existing chats and new connections via name or LinkedIn URL
"""

import os
import requests
import re
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from .resume_message_generator import ResumeMessageGenerator
from .job_filter import JobFilter

load_dotenv()

class UnifiedMessenger:
    def __init__(self):
        # Force reload environment variables
        load_dotenv(override=True)
        self.api_key = os.getenv('UNIPILE_API_KEY')
        self.apollo_api_key = os.getenv('APOLLO_API_KEY')
        self.base_url = os.getenv('BASE_URL')
        self.account_id = os.getenv('UNIPILE_ACCOUNT_ID')
        
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
        
        # Initialize SMTP for email sending
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')  # Gmail default
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))  # TLS port
        self.smtp_username = os.getenv('SMTP_USERNAME')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('FROM_EMAIL', 'raman.lavina@gmail.com')
        
        if self.smtp_username and self.smtp_password:
            print(f"✅ SMTP configured successfully")
            print(f"📧 From email: {self.from_email}")
            print(f"📮 SMTP server: {self.smtp_server}:{self.smtp_port}")
        else:
            print("⚠️  SMTP credentials not found in environment variables")
            print("⚠️  Email sending will be disabled")
            print("💡 Please set SMTP_USERNAME and SMTP_PASSWORD in .env file")
        
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
        
        # Initialize job filter
        try:
            self.job_filter = JobFilter()
            print("✅ Job filter initialized successfully")
        except Exception as e:
            print(f"⚠️  Job filter initialization failed: {e}")
            self.job_filter = None

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

    def send_invitation(self, provider_id, message="I'd like to connect with you on LinkedIn.", account_id=None):
        """
        Send a LinkedIn connection invitation.
        
        Args:
            provider_id: Provider ID of the recipient
            message: Invitation message
            account_id: Optional Unipile account_id to use (defaults to self.account_id)
        """
        # Use provided account_id or fall back to default
        unipile_account_id = account_id if account_id else self.account_id
        
        print(f"\n📨 Sending connection invitation...")
        print(f"🆔 Provider ID: {provider_id}")
        print(f"💬 Message: {message}")
        print(f"📧 Using Unipile account: {unipile_account_id}")
        print("-" * 50)
        
        data = {
            'account_id': unipile_account_id,
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

    def search_recruiters(self, company_ids, keywords="recruiter", company_id_to_name=None):
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
                    # Enrich with deterministic company metadata using the company_id being queried
                    company_name_from_map = None
                    if company_id_to_name and company_id in company_id_to_name:
                        company_name_from_map = company_id_to_name.get(company_id)
                    for rec in items:
                        rec.setdefault('company_id', company_id)
                        if company_name_from_map and not rec.get('company'):
                            rec['company'] = company_name_from_map
                    all_recruiters.extend(items)
                    print(f"✅ Found {len(items)} recruiters for company {company_id}")
                else:
                    print(f"❌ Failed to search recruiters for company {company_id}: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error searching recruiters for company {company_id}: {e}")
                continue
        
        print(f"✅ Total found {len(all_recruiters)} recruiters across all companies")
        return all_recruiters

    def _get_company_name_from_job(self, job):
        """
        Safely extract company name from a job object returned by LinkedIn search.
        """
        if not job:
            return None
        company = job.get('company') if isinstance(job, dict) else None
        if isinstance(company, dict):
            return company.get('name')
        if isinstance(company, str):
            return company
        return None

    def _recruiter_company_name(self, recruiter):
        """
        Try to resolve company name for recruiter from enriched fields or keywords_match.
        """
        if not recruiter:
            return None
        company = recruiter.get('company')
        if company:
            return company if isinstance(company, str) else company.get('name') if isinstance(company, dict) else None
        km = recruiter.get('keywords_match') or ''
        if 'Current:' in km and ' at ' in km:
            try:
                return km.split('Current:')[1].split(' at ')[-1].strip()
            except Exception:
                return None
        return None

    def _score_recruiter_for_job(self, job, recruiter):
        """
        Compute a heuristic score indicating how suitable this recruiter is for the given job.
        Uses recruiter's headline/title and company alignment with the job's company/title.
        """
        score = 0
        job_title = (job.get('title') or '').lower()
        job_company = (self._get_company_name_from_job(job) or '').lower()

        headline = (recruiter.get('headline') or '').lower()
        rec_company = (self._recruiter_company_name(recruiter) or '').lower()
        keywords_match = (recruiter.get('keywords_match') or '').lower()

        if any(k in headline for k in ['recruiter', 'talent', 'ta', 'sourcer', 'acquisition', 'people', 'hr']):
            score += 2

        if any(k in job_title for k in ['software', 'engineer', 'developer', 'data', 'ml', 'ai', 'product', 'design']):
            if any(k in headline for k in ['technical recruiter', 'engineering', 'tech', 'data', 'ml', 'ai', 'product', 'design']):
                score += 2

        if job_company:
            if rec_company and job_company == rec_company:
                score += 5
            elif job_company and job_company in keywords_match:
                score += 3

        for kw in ['software', 'engineer', 'data', 'science', 'ml', 'ai', 'backend', 'frontend', 'full stack', 'product', 'designer']:
            if kw in job_title and kw in headline:
                score += 1

        if any(k in job_title for k in ['senior', 'lead', 'staff', 'principal']):
            if any(k in headline for k in ['senior', 'lead', 'staff', 'principal']):
                score += 1

        return score

    def map_jobs_to_recruiters(self, jobs, recruiters, max_pairs=5):
        """
        Map up to max_pairs jobs to the best distinct recruiters (no repeats).
        Returns (selected_recruiters_list, mapping_list).
        """
        import logging
        import asyncio
        logger = logging.getLogger(__name__)
        
        # Thread-safe verbose logging helper
        def emit_verbose_log_sync(message: str, level: str = "info", emoji: str = ""):
            try:
                from app.services.verbose_logger import verbose_logger
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        asyncio.ensure_future(verbose_logger.log(message, level, emoji))
                    else:
                        loop.run_until_complete(verbose_logger.log(message, level, emoji))
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        loop.run_until_complete(verbose_logger.log(message, level, emoji))
                    finally:
                        loop.close()
            except Exception:
                pass
        
        logger.info(f"🔍 DEBUG: UnifiedMessenger.map_jobs_to_recruiters called")
        logger.info(f"🔍 DEBUG: Input jobs count: {len(jobs) if jobs else 0}")
        logger.info(f"🔍 DEBUG: Input recruiters count: {len(recruiters) if recruiters else 0}")
        logger.info(f"🔍 DEBUG: Max pairs: {max_pairs}")
        
        emit_verbose_log_sync(f"🔍 Processing {len(jobs) if jobs else 0} job(s) against {len(recruiters) if recruiters else 0} recruiter(s)...", "info", "🔍")
        
        if not jobs or not recruiters:
            logger.warning(f"⚠️ DEBUG: Empty input - jobs: {bool(jobs)}, recruiters: {bool(recruiters)}")
            return [], []

        jobs_considered = jobs[:max_pairs]
        logger.info(f"🔍 DEBUG: Considering {len(jobs_considered)} jobs for mapping")
        used_indices = set()
        selected = []
        mapping = []

        for job_idx, job in enumerate(jobs_considered):
            job_title = job.get('title', 'Unknown')
            job_company = self._get_company_name_from_job(job) or 'Unknown'
            logger.info(f"🔍 DEBUG: Processing job {job_idx + 1}/{len(jobs_considered)}: {job_title} at {job_company}")
            
            emit_verbose_log_sync(f"🎯 Analyzing job {job_idx + 1}/{len(jobs_considered)}: {job_title} @ {job_company}", "info", "🎯")
            
            scored = [(idx, self._score_recruiter_for_job(job, rec)) for idx, rec in enumerate(recruiters)]
            scored.sort(key=lambda x: (x[1], recruiters[x[0]].get('followers_count', 0) or 0), reverse=True)
            
            if scored:
                top_score = scored[0][1]
                logger.info(f"🔍 DEBUG: Top scorer for job has score: {top_score}")

            chosen_idx = None
            for idx, sc in scored:
                if idx in used_indices:
                    continue
                if sc <= 0:
                    continue
                chosen_idx = idx
                break

            if chosen_idx is None:
                logger.warning(f"⚠️ DEBUG: No suitable recruiter with score > 0 found, trying fallback")
                remaining = [(idx, recruiters[idx].get('followers_count', 0) or 0) for idx in range(len(recruiters)) if idx not in used_indices]
                if remaining:
                    remaining.sort(key=lambda x: x[1], reverse=True)
                    chosen_idx = remaining[0][0]
                    logger.info(f"🔍 DEBUG: Using fallback recruiter at index {chosen_idx}")

            if chosen_idx is None:
                logger.warning(f"⚠️ DEBUG: Could not find any recruiter for job {job_title} at {job_company}")
                continue

            used_indices.add(chosen_idx)
            chosen = recruiters[chosen_idx]
            recruiter_name = chosen.get('name', 'Unknown')
            recruiter_company = self._recruiter_company_name(chosen) or chosen.get('company', 'Unknown')
            logger.info(f"🔍 DEBUG: Mapped {job_title} -> {recruiter_name} ({recruiter_company})")
            
            emit_verbose_log_sync(f"🧩 Matched: {job_title} @ {job_company} → {recruiter_name} @ {recruiter_company}", "success", "🧩")
            
            selected.append(chosen)
            mapping.append({
                'job_title': job.get('title'),
                'job_company': self._get_company_name_from_job(job),
                'recruiter_name': chosen.get('name'),
                'recruiter_company': self._recruiter_company_name(chosen) or chosen.get('company'),
                'recruiter_profile_url': chosen.get('profile_url')
            })

            if len(selected) >= max_pairs:
                break

        logger.info(f"🔍 DEBUG: Mapping complete. Created {len(mapping)} mappings from {len(jobs_considered)} jobs")
        if len(mapping) == 0:
            emit_verbose_log_sync(f"⚠️ Warning: No mappings created", "warning", "⚠️")
            logger.warning(f"⚠️ DEBUG: No mappings created! Jobs: {len(jobs_considered)}, Recruiters: {len(recruiters)}")
        else:
            emit_verbose_log_sync(f"✅ Mapping complete: {len(mapping)} pair(s) created", "success", "✅")
        
        return selected, mapping

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
        
        # Search for company IDs (and names)
        company_ids = []
        company_id_to_name = {}
        for company_name in company_names:
            company_id, company_info = self.search_company(company_name)
            if company_id:
                company_ids.append(company_id)
                if company_info and isinstance(company_info, dict):
                    company_id_to_name[company_id] = company_info.get('name')
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
        
        # Ask user if they want intelligent filtering
        if jobs and self.job_filter:
            print(f"\n🤖 INTELLIGENT JOB FILTERING")
            print("="*50)
            print(f"Found {len(jobs)} jobs. Options:")
            print("1. Show all jobs (current behavior)")
            print("2. Use AI to filter and rank top 5 most relevant jobs")
            
            filter_choice = input("Choose option (1/2): ").strip()
            
            if filter_choice == "2":
                print("\n🎯 Starting intelligent job filtering...")
                ranking, top_urls = self.job_filter.filter_jobs(jobs)
                
                print(f"🔍 Debug - Ranking result: {ranking is not None}")
                print(f"🔍 Debug - Top URLs: {top_urls}")
                
                if ranking and top_urls:
                    print("\n" + "="*60)
                    print("🏆 TOP 5 MOST RELEVANT JOBS")
                    print("="*60)
                    print(ranking)
                    
                    # Filter jobs to show only top 5
                    top_jobs = [job for job in jobs if job.get('url') in top_urls]
                    if top_jobs:
                        print("\n📋 DETAILED VIEW OF TOP JOBS:")
                        print("="*50)
                        self.display_jobs(top_jobs)
                    
                    jobs = top_jobs  # Use filtered jobs for recruiter search
                else:
                    print("❌ Intelligent filtering failed, showing all jobs")
                    self.display_jobs(jobs)
            else:
                self.display_jobs(jobs)
        else:
            self.display_jobs(jobs)
        
        # Search for recruiters
        print("\n" + "="*50)
        recruiters = self.search_recruiters(company_ids, company_id_to_name=company_id_to_name)
        self.display_recruiters(recruiters)
        
        # Map filtered jobs to best recruiters (no repeats) and constrain outreach to them
        if recruiters and jobs:
            print("\n" + "="*50)
            print("🔗 MAPPING TOP JOBS TO BEST RECRUITERS (no repeats)")
            print("="*50)
            top_jobs = jobs[:5]
            best_recruiters, mapping = self.map_jobs_to_recruiters(top_jobs, recruiters, max_pairs=5)
            for i, m in enumerate(mapping, 1):
                jt = m.get('job_title') or 'Unknown'
                jc = m.get('job_company') or 'Unknown Company'
                rn = m.get('recruiter_name') or 'Unknown Recruiter'
                rc = m.get('recruiter_company') or 'Unknown Company'
                print(f"{i}. 🧩 '{jt}' at {jc} -> {rn} ({rc})")

            print("\n" + "="*80)
            print("👥 FILTERED RECRUITERS (used for all outreach from now on)")
            print("="*80)
            self.display_recruiters(best_recruiters)
            if best_recruiters:
                recruiters = best_recruiters
        
        # Enhanced outreach options with email extraction
        if recruiters:
            print("\n" + "="*50)
            print("🚀 ENHANCED OUTREACH OPTIONS")
            print("="*50)
            print("1. Basic LinkedIn invitations only")
            print("2. Enhanced dual outreach (LinkedIn + Email extraction)")
            print("3. Email-only outreach")
            print("4. Skip outreach")
            
            outreach_choice = input("Choose outreach method (1-4): ").strip()
            
            if outreach_choice == "1":
                self.send_connection_invitations_to_recruiters(recruiters, job_titles, job_type)
            elif outreach_choice == "2":
                self.enhanced_dual_outreach(recruiters, job_titles, job_type)
            elif outreach_choice == "3":
                self.email_only_outreach(recruiters, job_titles, job_type)
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
                    
                    # Use generic details for bulk messaging
                    recruiter_name = "Hiring Manager"
                    job_context = f"{', '.join(job_titles)} ({job_type})"
                    company_name = "your company"
                    
                    # Generate personalized message
                    personalized_message = self.resume_generator.generate_message(
                        resume_content, recruiter_name, job_context, company_name
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
        DEFAULT_EMAIL = "raman.lavina@gmail.com"  # Default email for testing when Apollo doesn't find one
        print(f"\n🔍 Extracting emails for {len(recruiters)} recruiters...")
        recruiters_with_emails = []
        
        for i, recruiter in enumerate(recruiters, 1):
            print(f"🔍 Processing {i}/{len(recruiters)}: {recruiter.get('name', 'Unknown')}")
            
            linkedin_url = recruiter.get('profile_url')
            if linkedin_url:
                email, person_data = self.extract_email_from_linkedin(linkedin_url)
                recruiter_copy = recruiter.copy()
                # Use default email if Apollo doesn't find one
                if email and email != 'Not found':
                    recruiter_copy['extracted_email'] = email
                else:
                    recruiter_copy['extracted_email'] = DEFAULT_EMAIL
                    print(f"⚠️  No email found from Apollo, using default: {DEFAULT_EMAIL}")
                recruiter_copy['apollo_data'] = person_data
                recruiters_with_emails.append(recruiter_copy)
                
                if email and email != 'Not found':
                    print(f"✅ Email found: {email}")
                else:
                    print(f"⚠️  Using default email: {DEFAULT_EMAIL}")
            else:
                recruiter_copy = recruiter.copy()
                # Use default email when no LinkedIn URL is available
                recruiter_copy['extracted_email'] = DEFAULT_EMAIL
                recruiter_copy['apollo_data'] = None
                recruiters_with_emails.append(recruiter_copy)
                print(f"⚠️  No LinkedIn URL available, using default email: {DEFAULT_EMAIL}")
        
        return recruiters_with_emails
    
    def generate_email_content(self, job_titles, job_type, recruiter, resume_content):
        """
        Generate professional email content for recruiter outreach.
        Uses resume_parser for efficient content extraction when available.
        """
        recruiter_name = recruiter.get('name', 'Hiring Manager')
        # Prefer enriched recruiter.company; fall back to Apollo org name; else default
        company_name = recruiter.get('company') or (
            recruiter.get('apollo_data', {}).get('organization', {}).get('name') if isinstance(recruiter.get('apollo_data'), dict) else None
        ) or 'your company'
        # Debug: show resolved company name
        print(f"🔎 Resolved company name: {company_name}")
        
        job_titles_str = ', '.join(job_titles)
        
        # Resume content from database is already parsed bullets, use directly
        # Only parse if this looks like raw resume content (very long, not bullet format)
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
                if self.resume_generator and self.resume_generator.resume_parser:
                    try:
                        print("📝 Parsing raw resume content (not from database)...")
                        resume_bullets = self.resume_generator.resume_parser.extract_key_bullets(resume_content)
                        resume_highlights = resume_bullets
                    except Exception as e:
                        print(f"⚠️  Resume parser failed, using truncated content: {e}")
                        resume_highlights = resume_content[:1200]
                else:
                    resume_highlights = resume_content[:1200]
            else:
                # Already parsed bullets from database, use directly
                resume_highlights = resume_content
        else:
            resume_highlights = 'No resume content available'
        
        # Create email generation prompt with strict structure and explicit output contract
        email_prompt = f"""
You are formatting an outreach email. Follow these RULES STRICTLY and return ONLY the content between <<<BEGIN>>> and <<<END>>>.

RULES:
- ASCII only. No smart quotes or fancy bullet characters.
- Use EXACTLY this structure and wording for the first and last lines.
- Use '-' hyphen bullets only, 2-3 bullets, each <= 12 words.

TEMPLATE (copy exactly, replacing bracketed guidance):
<<<BEGIN>>>
SUBJECT: Interest in {job_titles_str} Opportunities at {company_name}

BODY:
Dear {recruiter_name},

I hope you're doing well. I'm reaching out to express my interest in {job_titles_str} roles at {company_name}. [Add 1-2 sentences about why you're interested in the company and role]

- [Bullet 1: most relevant skills/experience]
- [Bullet 2: another relevant skills/experience]
- [Optional Bullet 3: if uniquely strong]

I'd love to chat about how I could bring my skills and passion for technology to {company_name}. Would you be open to a quick conversation?

Best regards,
Shreyas Tulsi
<<<END>>>

RESUME HIGHLIGHTS (use to craft concise bullets):
{resume_highlights}
"""
        
        try:
            if self.resume_generator:
                result = self.resume_generator.llm.invoke(email_prompt)
                # Handle ChatOpenAI response format properly
                if hasattr(result, 'content'):
                    email_content = result.content.strip()
                elif isinstance(result, dict):
                    email_content = result.get('text', result.get('content', str(result))).strip()
                else:
                    email_content = str(result).strip()
                
                # Extract between explicit markers if present
                if '<<<BEGIN>>>' in email_content and '<<<END>>>' in email_content:
                    email_content = email_content.split('<<<BEGIN>>>', 1)[1].split('<<<END>>>', 1)[0].strip()
                
                # Parse subject and body
                if 'SUBJECT:' in email_content and 'BODY:' in email_content:
                    parts = email_content.split('BODY:', 1)
                    subject = parts[0].replace('SUBJECT:', '').strip()
                    body = parts[1].strip()
                elif 'SUBJECT:' in email_content:
                    # If only SUBJECT is present, split on it
                    parts = email_content.split('SUBJECT:', 1)
                    if len(parts) == 2:
                        # Subject is the first line after SUBJECT:
                        remaining = parts[1].strip()
                        lines = remaining.split('\n', 1)
                        subject = lines[0].strip()
                        body = lines[1].strip() if len(lines) > 1 else ""
                    else:
                        subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
                        body = email_content
                else:
                    subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
                    body = email_content
                
                # Additional cleanup and normalization
                body_lines = body.split('\n')
                body_lines = [line for line in body_lines if not line.strip().startswith('SUBJECT:')]
                body = '\n'.join(body_lines)
                
                # Normalize bullets to '-' and enforce 2-3 bullets, short length
                lines = [ln.rstrip() for ln in body.split('\n')]
                normalized = []
                bullet_lines = []
                for ln in lines:
                    # replace common bullet chars with '-'
                    clean_ln = ln.replace('•', '-').replace('–', '-').replace('—', '-')
                    # collapse multiple spaces in bullet line
                    if clean_ln.strip().startswith('-'):
                        bullet_lines.append(clean_ln)
                    normalized.append(clean_ln)
                
                # Limit bullets to 3, keep at least 2 if available
                if bullet_lines:
                    # shorten each bullet to <= 12 words
                    def shorten_bullet(text):
                        words = text.split()
                        # ensure leading '-' remains
                        if words and words[0].startswith('-'):
                            head = words[0]
                            rest = words[1:13]
                            return ' '.join([head] + rest)
                        return ' '.join(words[:12])
                    bullet_lines = [shorten_bullet(b) for b in bullet_lines]
                    bullet_lines = bullet_lines[:3]
                    if len(bullet_lines) == 1:
                        # if only one bullet, keep it; template allows optional 3rd
                        pass
                
                # Rebuild body preserving greeting, paragraphs, and replacing bullet block
                # Find indices of first and last bullet in normalized
                first_idx = next((i for i, ln in enumerate(normalized) if ln.strip().startswith('-')), None)
                last_idx = None
                if first_idx is not None:
                    for i in range(len(normalized)-1, -1, -1):
                        if normalized[i].strip().startswith('-'):
                            last_idx = i
                            break
                if first_idx is not None and last_idx is not None:
                    rebuilt = normalized[:first_idx] + bullet_lines + normalized[last_idx+1:]
                else:
                    rebuilt = normalized
                
                # Trim body to <= 150 words (soft limit)
                def word_count(s):
                    return len([w for w in re.split(r"\s+", s.strip()) if w])
                body = '\n'.join(rebuilt).strip()
                if word_count(body) > 150:
                    # Keep header lines until bullets, bullets (max 3), closing lines
                    parts = body.split('\n')
                    # Preserve greeting block until first blank line after greeting
                    # Simple truncation to 150 words
                    tokens = []
                    for ln in parts:
                        for w in ln.split():
                            if len(tokens) >= 150:
                                break
                            tokens.append(w)
                        if len(tokens) >= 150:
                            break
                        tokens.append('\n')
                    body = ' '.join(tokens).replace(' \n ', '\n').replace(' \n', '\n').strip()
                
                # Validate email completeness - check for proper closing
                if not (('Best regards' in body or 'Sincerely' in body) and 'Shreyas' in body):
                    print(f"⚠️  Generated email incomplete, adding proper closing")
                    # Remove any trailing incomplete text
                    body = body.strip()
                    # Add proper closing if missing
                    if not body.endswith('Shreyas Tulsi'):
                        if not ('Best regards' in body or 'Sincerely' in body):
                            body += "\n\nBest regards,\nShreyas Tulsi"
                        else:
                            body += "\nShreyas Tulsi"
                
                return subject, body
            else:
                subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
                body = f"Dear {recruiter_name},\n\nI am writing to express my interest in {job_titles_str} opportunities at {company_name}. I believe my background and experience make me a strong candidate for these roles.\n\nI would welcome the opportunity to discuss how my skills align with your team's needs.\n\nBest regards,\nShreyas Tulsi"
                return subject, body
                
        except Exception as e:
            print(f"⚠️  Error generating email: {e}")
            subject = f"Interest in {job_titles_str} Opportunities at {company_name}"
            body = f"Dear {recruiter_name},\n\nI am writing to express my interest in {job_titles_str} opportunities at {company_name}. I believe my background and experience make me a strong candidate for these roles.\n\nI would welcome the opportunity to discuss how my skills align with your team's needs.\n\nBest regards,\nShreyas Tulsi"
            return subject, body
    
    def send_email(self, to_email, subject, body):
        """
        Send email using SMTP (smtplib) - fallback to env credentials.
        Returns (success: bool, result: dict or error message)
        """
        if not self.smtp_username or not self.smtp_password:
            return False, "SMTP not configured. Please set SMTP_USERNAME and SMTP_PASSWORD in .env file"
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body to email
            msg.attach(MIMEText(body, 'plain'))
            
            # Connect to SMTP server and send
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()  # Enable encryption
                server.login(self.smtp_username, self.smtp_password)
                text = msg.as_string()
                server.sendmail(self.from_email, to_email, text)
            
            return True, {"message": "Email sent successfully"}
            
        except smtplib.SMTPAuthenticationError as e:
            return False, f"SMTP authentication failed: {str(e)}. Please check your username and password (use App Password for Gmail)."
        except smtplib.SMTPException as e:
            return False, f"SMTP error: {str(e)}"
        except Exception as e:
            return False, f"Error sending email: {str(e)}"
    
    def refresh_access_token(self, email_account):
        """
        Refresh OAuth access token using refresh token.
        Returns (success: bool, new_access_token: str or None, new_expires_at: datetime or None, error: str or None, new_refresh_token: str or None)
        """
        from datetime import datetime, timedelta
        import httpx
        
        if not email_account.refresh_token:
            return False, None, None, "No refresh token available", None
        
        try:
            if email_account.provider == 'gmail':
                client_id = os.getenv('GOOGLE_CLIENT_ID')
                client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
                
                if not client_id or not client_secret:
                    return False, None, None, "Google OAuth not configured", None
                
                token_data = {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": email_account.refresh_token,
                    "grant_type": "refresh_token"
                }
                
                response = httpx.post(
                    "https://oauth2.googleapis.com/token",
                    data=token_data,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    tokens = response.json()
                    new_access_token = tokens.get('access_token')
                    expires_in = tokens.get('expires_in', 3600)
                    new_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    # Gmail doesn't return a new refresh token, use the existing one
                    return True, new_access_token, new_expires_at, None, None
                else:
                    return False, None, None, f"Token refresh failed: {response.status_code} - {response.text}", None
                    
            elif email_account.provider == 'outlook':
                client_id = os.getenv('MICROSOFT_CLIENT_ID')
                client_secret = os.getenv('MICROSOFT_CLIENT_SECRET')
                
                if not client_id or not client_secret:
                    return False, None, None, "Microsoft OAuth not configured", None
                
                token_data = {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": email_account.refresh_token,
                    "grant_type": "refresh_token",
                    "scope": "https://graph.microsoft.com/.default offline_access"
                }
                
                response = httpx.post(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                    data=token_data,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    tokens = response.json()
                    new_access_token = tokens.get('access_token')
                    expires_in = tokens.get('expires_in', 3600)
                    new_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    # Outlook may return a new refresh token
                    new_refresh_token = tokens.get('refresh_token')
                    return True, new_access_token, new_expires_at, None, new_refresh_token
                else:
                    return False, None, None, f"Token refresh failed: {response.status_code} - {response.text}", None
            else:
                return False, None, None, f"Unsupported provider: {email_account.provider}", None
                
        except Exception as e:
            return False, None, None, f"Token refresh error: {str(e)}", None
    
    def send_email_with_account(self, to_email, subject, body, email_account):
        """
        Send email using linked email account (OAuth or SMTP).
        Returns (success: bool, result: dict or error message)
        Note: This method does NOT refresh tokens automatically - caller should handle refresh
        """
        from datetime import datetime
        import httpx
        
        try:
            # Check if account is OAuth-based (Gmail/Outlook)
            if email_account.provider in ['gmail', 'outlook'] and email_account.access_token:
                # Use Gmail API for Gmail accounts
                if email_account.provider == 'gmail':
                    return self._send_email_via_gmail_api(
                        email_account,
                        to_email,
                        subject,
                        body
                    )
                # Use Outlook/Microsoft Graph API for Outlook accounts
                elif email_account.provider == 'outlook':
                    return self._send_email_via_outlook_api(
                        email_account,
                        to_email,
                        subject,
                        body
                    )
            
            # Fall back to SMTP (for custom SMTP or OAuth accounts with SMTP credentials)
            if email_account.smtp_server and email_account.smtp_username and email_account.smtp_password:
                return self._send_email_via_smtp(
                    email_account.email,
                    to_email,
                    subject,
                    body,
                    email_account.smtp_server,
                    int(email_account.smtp_port) if email_account.smtp_port else 587,
                    email_account.smtp_username,
                    email_account.smtp_password
                )
            
            return False, "Email account not properly configured. Please check your account settings."
            
        except Exception as e:
            return False, f"Error sending email: {str(e)}"
    
    def _send_email_via_gmail_api(self, email_account, to_email, subject, body):
        """Send email via Gmail API using OAuth access token."""
        import base64
        from email.mime.text import MIMEText
        import httpx
        
        try:
            # Create email message
            message = MIMEText(body)
            message['To'] = to_email
            message['From'] = email_account.email
            message['Subject'] = subject
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            # Send via Gmail API
            response = httpx.post(
                'https://www.googleapis.com/gmail/v1/users/me/messages/send',
                headers={
                    'Authorization': f'Bearer {email_account.access_token}',
                    'Content-Type': 'application/json'
                },
                json={'raw': raw_message},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return True, {"message": "Email sent successfully via Gmail API"}
            else:
                return False, f"Gmail API error: {response.status_code} - {response.text}"
                
        except Exception as e:
            return False, f"Gmail API error: {str(e)}"
    
    def _send_email_via_outlook_api(self, email_account, to_email, subject, body):
        """Send email via Microsoft Graph API using OAuth access token."""
        import httpx
        
        try:
            # Send via Microsoft Graph API
            response = httpx.post(
                'https://graph.microsoft.com/v1.0/me/sendMail',
                headers={
                    'Authorization': f'Bearer {email_account.access_token}',
                    'Content-Type': 'application/json'
                },
                json={
                    'message': {
                        'subject': subject,
                        'body': {
                            'contentType': 'Text',
                            'content': body
                        },
                        'toRecipients': [
                            {
                                'emailAddress': {
                                    'address': to_email
                                }
                            }
                        ]
                    }
                },
                timeout=30.0
            )
            
            if response.status_code in [200, 202]:
                return True, {"message": "Email sent successfully via Outlook API"}
            else:
                return False, f"Outlook API error: {response.status_code} - {response.text}"
                
        except Exception as e:
            return False, f"Outlook API error: {str(e)}"
    
    def _send_email_via_smtp(self, from_email, to_email, subject, body, smtp_server, smtp_port, smtp_username, smtp_password):
        """Send email via SMTP."""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body to email
            msg.attach(MIMEText(body, 'plain'))
            
            # Connect to SMTP server and send
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()  # Enable encryption
                server.login(smtp_username, smtp_password)
                text = msg.as_string()
                server.sendmail(from_email, to_email, text)
            
            return True, {"message": "Email sent successfully via SMTP"}
            
        except smtplib.SMTPAuthenticationError as e:
            return False, f"SMTP authentication failed: {str(e)}"
        except smtplib.SMTPException as e:
            return False, f"SMTP error: {str(e)}"
        except Exception as e:
            return False, f"Error sending email: {str(e)}"
    
    def email_only_outreach(self, recruiters, job_titles, job_type):
        """
        Email-only outreach with email extraction and personalized email generation.
        """
        DEFAULT_EMAIL = "raman.lavina@gmail.com"  # Default email for testing
        print(f"\n📧 Starting email-only outreach for {len(recruiters)} recruiters...")
        
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
        
        # Show preview of email campaign
        print(f"\n📧 EMAIL OUTREACH CAMPAIGN PREVIEW")
        print("=" * 60)
        print(f"🎯 Target Roles: {', '.join(job_titles)} ({job_type})")
        print(f"👥 Total Recipients: {len(recruiters_with_emails)}")
        
        # Show contact methods breakdown
        email_count = sum(1 for r in recruiters_with_emails if r.get('extracted_email'))
        real_email_count = sum(1 for r in recruiters_with_emails if r.get('extracted_email') and r['extracted_email'] != DEFAULT_EMAIL)
        
        print(f"📧 Recruiters with emails: {email_count} ({real_email_count} real, {email_count - real_email_count} default)")
        
        if email_count == 0:
            print("❌ No email addresses found for any recruiters. Cannot proceed with email-only outreach.")
            return
        
        # Show email preview for first recruiter with email
        email_recruiter = next((r for r in recruiters_with_emails if r.get('extracted_email')), None)
        if email_recruiter and resume_content:
            subject, body = self.generate_email_content(job_titles, job_type, email_recruiter, resume_content)
            print(f"\n📧 EMAIL TEMPLATE (Sample):")
            print("-" * 40)
            print(f"📝 Subject: {subject}")
            print(f"\n💬 Body Preview:")
            # print(body[:200] + "..." if len(body) > 200 else body)
            print(body)
        
        # Show detailed recipient list
        print(f"\n👥 RECIPIENTS & EMAIL STATUS:")
        print("-" * 40)
        for i, recruiter in enumerate(recruiters_with_emails, 1):
            name = recruiter.get('name', 'Unknown')
            email = recruiter.get('extracted_email', DEFAULT_EMAIL)
            
            print(f"{i}. {name}")
            print(f"   📧 Email: {email}")
            if email == DEFAULT_EMAIL:
                print(f"   ⚠️  Status: Using default email (for testing)")
            else:
                print(f"   ✅ Status: Email from Apollo")
        
        # Confirmation
        print("\n" + "=" * 60)
        print("❓ CONFIRMATION REQUIRED")
        print("=" * 60)
        confirm = input("Proceed with email-only outreach campaign? (y/n): ").strip().lower()
        
        if confirm != 'y':
            print("❌ Campaign cancelled by user.")
            return
        
        # Execute campaign
        print(f"\n🚀 Executing email-only outreach campaign...")
        print("=" * 60)
        
        successful_emails = 0
        failed_emails = 0
        
        for i, recruiter in enumerate(recruiters_with_emails, 1):
            print(f"\n📤 Processing recruiter {i}/{len(recruiters_with_emails)}")
            recruiter_name = recruiter.get('name', 'Unknown')
            print(f"👤 Recruiter: {recruiter_name}")
            
            # Generate and send email
            email = recruiter.get('extracted_email')
            if email and resume_content:
                try:
                    subject, body = self.generate_email_content(job_titles, job_type, recruiter, resume_content)
                    
                    email_type = "⚠️  (DEFAULT)" if email == DEFAULT_EMAIL else "✅"
                    print(f"📧 Sending email {email_type} to: {email}")
                    print(f"   📝 Subject: {subject}")
                    
                    # Actually send the email
                    success, result = self.send_email(email, subject, body)
                    
                    if success:
                        print(f"   ✅ Email sent successfully!")
                        successful_emails += 1
                    else:
                        print(f"   ❌ Failed to send email: {result}")
                        failed_emails += 1
                        # Still show the email content for reference
                        print(f"   💬 Email content (not sent):")
                        print(f"   {body[:200]}..." if len(body) > 200 else f"   {body}")
                    print("-" * 60)
                except Exception as e:
                    failed_emails += 1
                    print(f"❌ Email generation/sending failed: {e}")
            else:
                failed_emails += 1
                if not email:
                    print(f"❌ No email address available")
                else:
                    print(f"❌ Resume not available for email generation")
        
        # Campaign summary
        print("\n" + "=" * 60)
        print("📊 EMAIL OUTREACH CAMPAIGN SUMMARY")
        print("=" * 60)
        print(f"🎯 Target Roles: {', '.join(job_titles)} ({job_type})")
        print(f"📧 Emails Sent - Success: {successful_emails}, Failed: {failed_emails}")
        if len(recruiters_with_emails) > 0:
            print(f"📈 Success Rate: {(successful_emails/len(recruiters_with_emails)*100):.1f}%")
        print("=" * 60)

    def enhanced_dual_outreach(self, recruiters, job_titles, job_type):
        """
        Enhanced outreach with email extraction and dual channel messaging.
        """
        DEFAULT_EMAIL = "raman.lavina@gmail.com"  # Default email for testing
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
            try:
                recruiter_name = "Hiring Manager"
                job_context = f"{', '.join(job_titles)} ({job_type})"
                company_name = "your company"
                linkedin_message = self.resume_generator.generate_message(
                    resume_content, recruiter_name, job_context, company_name
                )
            except:
                linkedin_message = f"Dear Hiring Manager, I'm interested in {', '.join(job_titles)} opportunities at your company. I'd love to connect and discuss potential roles."
        else:
            linkedin_message = f"Dear Hiring Manager, I'm interested in {', '.join(job_titles)} opportunities at your company. I'd love to connect and discuss potential roles."
        
        # Show preview of outreach campaign
        print(f"\n📨 DUAL OUTREACH CAMPAIGN PREVIEW")
        print("=" * 60)
        print(f"🎯 Target Roles: {', '.join(job_titles)} ({job_type})")
        print(f"👥 Total Recipients: {len(recruiters_with_emails)}")
        
        # Show contact methods breakdown
        email_count = sum(1 for r in recruiters_with_emails if r.get('extracted_email'))
        real_email_count = sum(1 for r in recruiters_with_emails if r.get('extracted_email') and r['extracted_email'] != DEFAULT_EMAIL)
        linkedin_count = sum(1 for r in recruiters_with_emails if r.get('profile_url'))
        
        print(f"📧 Recruiters with emails: {email_count} ({real_email_count} real, {email_count - real_email_count} default)")
        print(f"🔗 Recruiters with LinkedIn: {linkedin_count}")
        
        # Show LinkedIn message template
        print(f"\n🔗 LINKEDIN MESSAGE TEMPLATE:")
        print("-" * 40)
        print(f"💬 {linkedin_message}")
        print(f"📊 Length: {len(linkedin_message)} characters")
        
        # Show email preview for first recruiter with email
        email_recruiter = next((r for r in recruiters_with_emails if r.get('extracted_email')), None)
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
            email = recruiter.get('extracted_email', DEFAULT_EMAIL)
            linkedin_available = 'Yes' if recruiter.get('profile_url') else 'No'
            
            print(f"{i}. {name}")
            email_status = f"{email} ⚠️  (DEFAULT)" if email == DEFAULT_EMAIL else f"{email} ✅"
            print(f"   📧 Email: {email_status}")
            print(f"   🔗 LinkedIn: {linkedin_available}")
            methods = []
            if email: methods.append('Email')
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
            
            # Generate and send email
            email = recruiter.get('extracted_email')
            if email and resume_content:
                try:
                    subject, body = self.generate_email_content(job_titles, job_type, recruiter, resume_content)
                    
                    email_type = "⚠️  (DEFAULT)" if email == DEFAULT_EMAIL else "✅"
                    print(f"📧 Sending email {email_type} to: {email}")
                    print(f"   📝 Subject: {subject}")
                    
                    # Actually send the email
                    success, result = self.send_email(email, subject, body)
                    
                    if success:
                        print(f"   ✅ Email sent successfully!")
                        successful_emails += 1
                    else:
                        print(f"   ❌ Failed to send email: {result}")
                        failed_emails += 1
                except Exception as e:
                    failed_emails += 1
                    print(f"❌ Email generation/sending failed: {e}")
            else:
                failed_emails += 1
                if not email:
                    print(f"❌ No email address available")
                else:
                    print(f"❌ Resume not available for email generation")
        
        # Campaign summary
        print("\n" + "=" * 60)
        print("📊 DUAL OUTREACH CAMPAIGN SUMMARY")
        print("=" * 60)
        print(f"🎯 Target Roles: {', '.join(job_titles)} ({job_type})")
        print(f"🔗 LinkedIn Messages - Success: {successful_linkedin}, Failed: {failed_linkedin}")
        print(f"📧 Emails Sent - Success: {successful_emails}, Failed: {failed_emails}")
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
        print("4. Search jobs and recruiters (with AI filtering + Email outreach)")
        print("   🤖 NEW: AI-powered job relevance ranking!")
        print("   📧 NEW: Email extraction & sending capabilities!")
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
