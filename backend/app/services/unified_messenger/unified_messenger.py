#!/usr/bin/env python3
"""
Unified LinkedIn Messenger - Clean solution for messaging through Unipile
Supports both existing chats and new connections via name or LinkedIn URL
"""

import os
import requests
import re
import json
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from .resume_message_generator import ResumeMessageGenerator
from .job_filter import JobFilter
from .job_context_tracker import JobContextTracker
from app.db.base import AsyncSessionLocal
from typing import Optional, Dict, Any

load_dotenv()

try:
    from app.services.verbose_logger import verbose_logger
    VERBOSE_LOGGING = True
except ImportError:
    VERBOSE_LOGGING = False
    verbose_logger = None


def emit_verbose_log_sync(message: str, level: str = "info", emoji: str = ""):
    """Thread-safe helper to emit verbose logs from sync context."""
    if not VERBOSE_LOGGING or not verbose_logger:
        return

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        loop.create_task(verbose_logger.log(message, level, emoji))
    else:
        asyncio.run(verbose_logger.log(message, level, emoji))


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

    def get_provider_id_from_linkedin_url(self, linkedin_url, account_id=None):
        """
        Convert LinkedIn profile URL to Provider ID using Unipile's users endpoint.
        
        Args:
            linkedin_url: LinkedIn profile URL
            account_id: Optional Unipile account ID to use (defaults to self.account_id)
        """
        identifier = self.extract_linkedin_identifier(linkedin_url)
        
        # Use provided account_id or fall back to default
        unipile_account_id = account_id if account_id else self.account_id
        
        print(f"🔍 Converting LinkedIn URL to Provider ID...")
        print(f"📝 URL: {linkedin_url}")
        print(f"🆔 Identifier: {identifier}")
        print(f"📧 Using Unipile account: {unipile_account_id}")
        print("-" * 50)
        
        if not unipile_account_id:
            print(f"❌ No Unipile account ID available")
            return None, None
        
        try:
            # Use the users endpoint with the identifier
            response = requests.get(
                f"{self.base_url}/users/{identifier}",
                headers=self.headers,
                params={'account_id': unipile_account_id}
            )
            
            print(f"📊 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                provider_id = result.get('provider_id')
                name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
                network_distance = result.get('network_distance', 'Unknown')
                
                if provider_id:
                    print(f"✅ Successfully converted!")
                    print(f"👤 Name: {name}")
                    print(f"🆔 Provider ID: {provider_id}")
                    print(f"🔗 Network Distance: {network_distance}")
                    return provider_id, result
                else:
                    print(f"❌ Provider ID not found in response")
                    print(f"📄 Response: {response.text}")
                    return None, None
            else:
                print(f"❌ Failed to convert URL (Status {response.status_code})")
                print(f"📄 Response: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ Error converting URL: {e}")
            import traceback
            traceback.print_exc()
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

    def search_jobs(
        self,
        company_ids,
        job_titles,
        job_types=None,
        location_id="102571732",
        locations=None,
        location=None,
        experience_levels=None,
        salary_min=None,
        salary_max=None
    ):
        """
        Search for jobs using LinkedIn API - sends separate request for each company.
        """
        print("🔍 Searching for jobs...")
        print(f"🏢 Companies: {company_ids}")
        print(f"💼 Job titles: {job_titles}")
        if job_types:
            print(f"🧾 Job type filter: {job_types}")
        location_filters = []
        if locations:
            location_filters.extend(locations)
        if location:
            location_filters.append(location)
        if location_filters:
            print(f"📍 Location filter(s): {location_filters}")
        if experience_levels:
            print(f"📈 Experience level filter(s): {experience_levels}")
        if salary_min is not None or salary_max is not None:
            print(f"💰 Salary filter: min={salary_min}, max={salary_max}")
        
        emit_verbose_log_sync(
            (
                "🔍 Starting job search\n"
                f"• Companies: {company_ids}\n"
                f"• Titles: {job_titles}\n"
                f"• Job types: {job_types or ['full_time (default)']}\n"
                f"• Location(s): {location_filters or ['Any']} (location_id={location_id})\n"
                f"• Experience level(s): {experience_levels or ['Any']}\n"
                f"• Salary range: {salary_min if salary_min is not None else 'Any'} - "
                f"{salary_max if salary_max is not None else 'Any'}"
            ),
            "info",
            "🔍"
        )
        
        all_jobs = []
        
        for company_id in company_ids:
            try:
                print(f"🔍 Searching jobs at company ID: {company_id}")
                
                data = {
                    "api": "classic",
                    "category": "jobs",
                    "company": [company_id],  # Single company per request
                    "keywords": " ".join(job_titles),
                    "sort_by": "date"
                }
                
                locations_payload = []
                if location_id:
                    locations_payload.append(location_id)
                if location_filters:
                    for loc_filter in location_filters:
                        if loc_filter and isinstance(loc_filter, str) and loc_filter.strip():
                            locations_payload.append(loc_filter.strip())
                if locations_payload:
                    data["locations"] = locations_payload
                
                if job_types:
                    data["job_type"] = job_types
                
                if experience_levels:
                    if len(experience_levels) == 1:
                        data["experience_level"] = experience_levels[0]
                    else:
                        data["experience_level"] = list(set(experience_levels))
                
                if salary_min is not None or salary_max is not None:
                    salary_filter = {}
                    if salary_min is not None:
                        salary_filter["min"] = salary_min
                    if salary_max is not None:
                        salary_filter["max"] = salary_max
                    data["salary"] = salary_filter
                
                response = requests.post(
                    f"{self.base_url}/linkedin/search",
                    headers={**self.headers, 'content-type': 'application/json'},
                    params={'account_id': self.account_id},
                    json=data
                )
                
                try:
                    print(f"📤 Request payload for company {company_id}: {json.dumps(data, indent=2)[:500]}")
                    emit_verbose_log_sync(
                        f"📤 Sent job search payload for company {company_id}:\n{json.dumps(data, indent=2)[:600]}",
                        "info",
                        "📤"
                    )
                except Exception:
                    pass
                
                if response.status_code == 200:
                    result = response.json()
                    items = result.get('items', []) or result.get('data', []) or result.get('jobs', [])
                    filtered_items = []
                    print(f"📥 Received {len(items)} raw job(s) for company {company_id}")
                    emit_verbose_log_sync(
                        f"📥 Received {len(items)} raw job(s) for company {company_id}",
                        "info",
                        "📥"
                    )
                    for job in items:
                        filter_reasons = []
                        if not self._matches_location_filter(job, location_filters):
                            filter_reasons.append("location")
                        if not self._matches_experience_filter(job, experience_levels):
                            filter_reasons.append("experience")
                        if not self._matches_salary_filter(job, salary_min, salary_max):
                            filter_reasons.append("salary")

                        if filter_reasons:
                            title = job.get('title') or job.get('jobTitle') or 'Untitled'
                            company_name = job.get('company', {}).get('name') if isinstance(job.get('company'), dict) else job.get('company') or job.get('companyName') or 'Unknown'
                            print(f"🚫 Filtered out job '{title}' at {company_name} due to: {', '.join(filter_reasons)}")
                            emit_verbose_log_sync(
                                f"🚫 Filtered out job '{title}' at {company_name} (company ID {company_id}) due to: {', '.join(filter_reasons)}",
                                "warning",
                                "🚫"
                            )
                            continue
                        # Try to ensure a job URL field exists
                        if not job.get('job_url'):
                            url_candidates = [
                                job.get('url'),
                                job.get('jobUrl'),
                                job.get('link'),
                                job.get('canonical_url'),
                                job.get('company', {}).get('url') if isinstance(job.get('company'), dict) else None
                            ]
                            for candidate in url_candidates:
                                if candidate:
                                    job['job_url'] = candidate
                                    break
                        filtered_items.append(job)
                    all_jobs.extend(filtered_items)
                    print(f"✅ Found {len(filtered_items)} matching jobs for company {company_id}")
                    emit_verbose_log_sync(
                        f"✅ {len(filtered_items)} matching job(s) for company {company_id}",
                        "success",
                        "✅"
                    )
                else:
                    print(f"❌ Failed to search jobs for company {company_id}: {response.text}")
                    
            except Exception as e:
                print(f"❌ Error searching jobs for company {company_id}: {e}")
                emit_verbose_log_sync(
                    f"❌ Error searching jobs for company {company_id}: {e}",
                    "error",
                    "❌"
                )
                continue
        
        print(f"✅ Total found {len(all_jobs)} job listings across all companies")
        emit_verbose_log_sync(
            f"📊 Job search complete. Returning {len(all_jobs)} job(s) after filtering.",
            "info",
            "📊"
        )
        return all_jobs

    # Helper methods for job filtering
    def _matches_location_filter(self, job, location_filters):
        if not location_filters:
            return True
        
        if isinstance(location_filters, str):
            location_filters = [location_filters]
        location_filters = [loc.lower() for loc in location_filters if isinstance(loc, str) and loc.strip()]
        if not location_filters:
            return True
        
        possible_locations = []
        
        location_value = job.get('location') or job.get('job_location')
        if location_value:
            if isinstance(location_value, dict):
                possible_locations.extend(
                    str(v) for v in location_value.values() if isinstance(v, str)
                )
            elif isinstance(location_value, list):
                possible_locations.extend(str(item) for item in location_value if item)
            else:
                possible_locations.append(str(location_value))
        
        for key in ['locations', 'locationNames']:
            if key in job and isinstance(job[key], list):
                for loc in job[key]:
                    if isinstance(loc, dict):
                        possible_locations.extend(str(v) for v in loc.values() if isinstance(v, str))
                    else:
                        possible_locations.append(str(loc))
        
        if 'workplaceType' in job and job['workplaceType']:
            possible_locations.append(str(job['workplaceType']))
        
        if not possible_locations:
            return True  # no location info, keep
        
        lower_locations = [loc.lower() for loc in possible_locations if isinstance(loc, str)]
        return any(any(filter_value in loc for loc in lower_locations) for filter_value in location_filters)
    
    def _matches_experience_filter(self, job, experience_filter):
        if not experience_filter:
            return True
        
        if isinstance(experience_filter, str):
            experience_filters = [experience_filter]
        else:
            experience_filters = [f for f in experience_filter if isinstance(f, str)]
        experience_filters = [f.lower() for f in experience_filters if f.strip()]
        if not experience_filters:
            return True
        
        fields_to_check = [
            job.get('experience_level'),
            job.get('experienceLevel'),
            job.get('experience'),
            job.get('job_level'),
            job.get('jobLevel'),
            job.get('seniority'),
            job.get('seniority_level'),
            job.get('seniorityLevel')
        ]
        
        found_any_field = False
        for field in fields_to_check:
            if not field:
                continue
            found_any_field = True
            field_values = []
            if isinstance(field, str):
                field_values.append(field.lower())
            elif isinstance(field, list):
                field_values.extend(str(item).lower() for item in field if item)
            elif isinstance(field, dict):
                field_values.extend(str(v).lower() for v in field.values() if v)

            if any(
                any(filter_value in value for filter_value in experience_filters)
                for value in field_values
            ):
                return True
        
        return not found_any_field  # keep if no data to compare
    
    def _extract_salary_value(self, value, prefer_max=False):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, dict):
            keys_preference = (
                ['max', 'maximum', 'max_amount', 'maxAmount', 'high', 'upperBound']
                if prefer_max else
                ['min', 'minimum', 'min_amount', 'minAmount', 'low', 'lowerBound']
            )
            for key in keys_preference:
                if key in value and value[key] is not None:
                    return self._extract_salary_value(value[key], prefer_max=prefer_max)
            for dict_value in value.values():
                parsed = self._extract_salary_value(dict_value, prefer_max=prefer_max)
                if parsed is not None:
                    return parsed
        if isinstance(value, list):
            parsed_values = [
                self._extract_salary_value(item, prefer_max=prefer_max)
                for item in value
            ]
            parsed_values = [v for v in parsed_values if v is not None]
            if parsed_values:
                return max(parsed_values) if prefer_max else min(parsed_values)
        if isinstance(value, str):
            numbers = re.findall(r'\d[\d,]*', value)
            if numbers:
                numbers = [int(n.replace(',', '')) for n in numbers]
                return max(numbers) if prefer_max else min(numbers)
        return None
    
    def _matches_salary_filter(self, job, salary_min, salary_max):
        if salary_min is None and salary_max is None:
            return True
        
        salary_info = (
            job.get('salary') or
            job.get('salary_range') or
            job.get('salaryRange') or
            job.get('compensation') or
            job.get('pay')
        )
        
        if not salary_info:
            return True  # keep when salary info missing
        
        job_min = self._extract_salary_value(salary_info, prefer_max=False)
        job_max = self._extract_salary_value(salary_info, prefer_max=True)
        
        if salary_min is not None and job_max is not None and job_max < salary_min:
            return False
        if salary_max is not None and job_min is not None and job_min > salary_max:
            return False
        
        return True

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
    
    def _get_company_id_from_job(self, job):
        """
        Safely extract company ID from a job object returned by LinkedIn search.
        """
        if not job:
            return None
        company = job.get('company') if isinstance(job, dict) else None
        if isinstance(company, dict):
            return company.get('id') or company.get('company_id')
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
    
    def _recruiter_matches_company(self, recruiter, job_company, job=None):
        """
        Check if a recruiter is from the same company as the job.
        Uses company_id for exact matching if available, otherwise falls back to name matching.
        Uses case-insensitive comparison and handles various company name formats.
        """
        if not job_company:
            return False
        
        # First, try to match by company_id if available (most accurate)
        if job:
            job_company_id = self._get_company_id_from_job(job)
            recruiter_company_id = recruiter.get('company_id')
            
            if job_company_id and recruiter_company_id:
                # Convert both to strings for comparison (IDs might be strings or numbers)
                if str(job_company_id) == str(recruiter_company_id):
                    return True
        
        # Fallback to name matching
        recruiter_company = self._recruiter_company_name(recruiter)
        if not recruiter_company:
            return False
        
        # Normalize company names for comparison (lowercase, strip whitespace)
        job_company_normalized = str(job_company).lower().strip()
        recruiter_company_normalized = str(recruiter_company).lower().strip()
        
        # Direct match
        if job_company_normalized == recruiter_company_normalized:
            return True
        
        # Check if job company is contained in recruiter company or vice versa
        # (handles cases like "NVIDIA Corporation" vs "NVIDIA")
        if job_company_normalized in recruiter_company_normalized or recruiter_company_normalized in job_company_normalized:
            return True
        
        return False

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
            
            # CRITICAL FIX: Filter recruiters to only those from the same company as the job
            # This ensures that when a user selects a position from NVIDIA, only NVIDIA recruiters are considered
            matching_recruiters = []
            matching_indices = []
            for idx, recruiter in enumerate(recruiters):
                if self._recruiter_matches_company(recruiter, job_company, job):
                    matching_recruiters.append(recruiter)
                    matching_indices.append(idx)
            
            if not matching_recruiters:
                logger.warning(f"⚠️ DEBUG: No recruiters found for company {job_company}, trying all recruiters as fallback")
                emit_verbose_log_sync(f"⚠️ No recruiters found for {job_company}, using all recruiters as fallback", "warning", "⚠️")
                # Fallback: use all recruiters if no company match found
                matching_recruiters = recruiters
                matching_indices = list(range(len(recruiters)))
            else:
                logger.info(f"✅ DEBUG: Found {len(matching_recruiters)} recruiter(s) matching company {job_company}")
                emit_verbose_log_sync(f"   Filtered to {len(matching_recruiters)} recruiter(s) from {job_company}", "info", "🔍")
            
            # Score only the matching recruiters
            scored = [(matching_indices[idx], self._score_recruiter_for_job(job, rec)) for idx, rec in enumerate(matching_recruiters)]
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
            chosen = recruiters[chosen_idx].copy()  # Make a copy to avoid modifying the original
            
            # Extract job_url from the job - try multiple possible keys
            job_url = job.get('job_url') or job.get('url') or job.get('link') or job.get('canonical_url')
            
            # CRITICAL: Attach the job_url to the recruiter so it's available during email generation
            chosen['job_url'] = job_url
            chosen['job_title'] = job_title
            chosen['job_company'] = job_company
            
            recruiter_name = chosen.get('name', 'Unknown')
            recruiter_company = self._recruiter_company_name(chosen) or chosen.get('company', 'Unknown')
            logger.info(f"🔍 DEBUG: Mapped {job_title} -> {recruiter_name} ({recruiter_company})")
            logger.info(f"🔗 DEBUG: Job URL attached to recruiter: {job_url}")
            
            emit_verbose_log_sync(f"🧩 Matched: {job_title} @ {job_company} → {recruiter_name} @ {recruiter_company}", "success", "🧩")
            
            selected.append(chosen)
            mapping.append({
                'job_title': job.get('title'),
                'job_company': self._get_company_name_from_job(job),
                'job_url': job_url,  # Include job_url in mapping for reference
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
        jobs = self.search_jobs(company_ids, job_titles, [job_type] if job_type else None)
        
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
    
    async def generate_email_content(self, job_titles, job_type, recruiter, resume_content, job_url=None):
        """Generate a longer, context-rich outreach email. Now fully async!"""

        recruiter_name = recruiter.get('name', 'Hiring Manager')
        
        # If job_url is not provided as argument, try to get it from recruiter data
        if not job_url:
            job_url = recruiter.get('job_url')
            print(f"🔗 No job_url provided as argument, extracted from recruiter: {job_url}")
        else:
            print(f"🔗 Using job_url from argument: {job_url}")

        job_context = await self._fetch_job_context(job_url)

        company_name = (
            recruiter.get('company')
            or recruiter.get('company_name')
            or (
                recruiter.get('apollo_data', {}).get('organization', {}).get('name')
                if isinstance(recruiter.get('apollo_data'), dict)
                else None
            )
            or (job_context.get('company') if job_context else None)
            or 'your company'
        )
        print(f"🔎 Resolved company name: {company_name}")

        job_titles_str = ', '.join(job_titles)
        job_type_label = {
            'full_time': 'full-time',
            'internship': 'internship',
        }.get(job_type, job_type)

        # Safely extract and convert job context fields to strings
        def safe_extract_list(context, key, default_empty=''):
            if not context:
                return default_empty
            value = context.get(key, [])
            if not value:
                return default_empty
            if not isinstance(value, list):
                print(f"⚠️ Warning: {key} is not a list (type: {type(value)}), converting...")
                try:
                    value = list(value) if value else []
                except (TypeError, ValueError):
                    print(f"❌ Could not convert {key} to list, using empty list")
                    return default_empty
            return ', '.join(str(item) for item in value[:3]) if value else default_empty
        
        requirements = safe_extract_list(job_context, 'requirements')
        technologies = safe_extract_list(job_context, 'technologies')
        responsibilities = safe_extract_list(job_context, 'responsibilities')

        resume_details = self._extract_resume_details(resume_content)
        education_text = resume_details.get('education') or 'Not specified'
        graduation_text = resume_details.get('graduation') or 'Not specified'
        experience_highlights = resume_details.get('experience', [])
        experience_text = '; '.join(experience_highlights[:4]) if experience_highlights else 'Not specified'
        
        # Extract key technologies from resume - CRITICAL for preventing fabrication
        resume_technologies = []
        if resume_content and self.resume_generator and self.resume_generator.resume_parser:
            try:
                structured_data = self.resume_generator.resume_parser.extract_structured_data(resume_content)
                resume_technologies = structured_data.get('key_technologies', [])
            except Exception as e:
                print(f"⚠️  Could not extract technologies from resume: {e}")
                # Fallback: try to extract from bullet format
                if 'Key Technologies:' in resume_content or 'key_technologies' in resume_content.lower():
                    lines = resume_content.splitlines()
                    for line in lines:
                        if 'Key Technologies:' in line or 'key technologies:' in line.lower():
                            tech_part = line.split(':', 1)[1] if ':' in line else line
                            resume_technologies = [t.strip() for t in tech_part.split(',') if t.strip()]
                            break
        
        # If still no technologies found, try parsing from raw resume content
        if not resume_technologies and resume_content:
            # Look for common technology patterns in the resume
            tech_keywords = ['python', 'java', 'javascript', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes', 
                           'cassandra', 'mongodb', 'postgresql', 'redis', 'kafka', 'spark', 'tensorflow', 'pytorch',
                           'machine learning', 'deep learning', 'data science', 'backend', 'frontend', 'full stack']
            found_techs = []
            resume_lower = resume_content.lower()
            for tech in tech_keywords:
                if tech in resume_lower:
                    found_techs.append(tech)
            if found_techs:
                resume_technologies = found_techs[:10]  # Limit to 10
        
        technologies_list_text = ', '.join(resume_technologies) if resume_technologies else 'None explicitly listed'
        
        # Extract the person's name from the resume
        person_name = self._extract_resume_name(resume_content)

        email_prompt = f"""
You are writing a professional outreach email. Follow these instructions carefully and return ONLY the content between <<<BEGIN>>> and <<<END>>>.

CONTEXT:
- Recruiter: {recruiter_name}
- Company: {company_name}
- Roles of Interest: {job_titles_str} ({job_type_label})
- Job Requirements: {requirements or 'Not specified'}
- Job Technologies: {technologies or 'Not specified'}
- Job Responsibilities: {responsibilities or 'Not specified'}
- Education Summary: {education_text}
- Graduation Detail: {graduation_text}
- Resume Experience Highlights: {experience_text}
- Resume Technologies (ONLY use these): {technologies_list_text}

STRUCTURE:
1. Open with a greeting that includes a courteous introduction (e.g., "I hope you're doing well") and clearly state the role at {company_name} you are pursuing.
2. Provide a short paragraph introducing yourself, focusing on education and explicitly mentioning university and graduation date when available.
3. Write a paragraph with 3-4 sentences that creates DIRECT, SPECIFIC mappings between the job requirements/technologies and your experience. For EACH requirement or technology listed, create a connection following this template: "My experience at [SPECIFIC COMPANY] helped me master fundamentals in [SPECIFIC TECHNOLOGY/SKILL], which is directly applicable to this position because [SPECIFIC REASON from requirements]." DO NOT use general statements. MUST reference specific companies from experience highlights and specific technologies/requirements from the job posting.
4. Conclude with a warm, professional closing inviting a conversation. End with "Best regards," and "{person_name}" exactly.

CRITICAL REQUIREMENTS FOR PARAGRAPH 3:
- ONLY mention technologies, skills, or tools that are EXPLICITLY listed in "Resume Technologies" above
- If a job requirement or technology is NOT in the "Resume Technologies" list, DO NOT mention it in the email - skip it entirely
- Pick 2-3 specific requirements or technologies from the job posting that ACTUALLY EXIST in your resume
- For EACH one you mention, it MUST be in the "Resume Technologies" list - verify this before writing
- For EACH one, mention a specific company/role from experience highlights where you used that skill
- Explain the direct connection: "My [experience at X] → developed [specific skill Y] → useful for [specific requirement Z]"
- Be concrete: mention actual technologies, actual companies, actual outcomes
- Avoid vague phrases like "strong background" or "extensive experience" - use specific examples only
- DO NOT fabricate, infer, or assume any technologies or skills not explicitly in the resume
- DO NOT mention technologies just because they appear in the job posting - they must be in your resume

EXAMPLE OF GOOD PARAGRAPH 3 (if job requires Python and ML, AND both are in resume):
"My internship at Amazon provided hands-on experience with Python for building data processing pipelines, which directly aligns with your requirement for Python proficiency. Additionally, my research at UCLA Data Mining Lab helped me master machine learning fundamentals through implementing classification models, skills that would be valuable for developing the ML features mentioned in the role. At Anvi Cybernetics, I applied these technologies to real-world problems, strengthening my ability to translate technical requirements into production solutions."

EXAMPLE OF BAD PARAGRAPH 3 (too vague):
"I have strong experience in software development and have worked with various technologies. My background includes internships at leading companies where I gained valuable skills. I'm confident these experiences would be beneficial for this role."

EXAMPLE OF BAD PARAGRAPH 3 (fabricating skills not in resume):
"My experience at Amazon helped me master Cassandra database systems..." [WRONG if Cassandra is NOT in resume technologies]

EXAMPLE OF GOOD PARAGRAPH 3 (when job requires Cassandra but resume doesn't have it):
"My internship at Amazon provided hands-on experience with Python for building data processing pipelines, which directly aligns with your requirement for scalable backend systems. Additionally, my research at UCLA Data Mining Lab helped me master machine learning fundamentals through implementing classification models, skills that would be valuable for developing the ML features mentioned in the role." [CORRECT - only mentions technologies actually in resume]

RULES:
- Use ASCII characters only.
- Write in full sentences; do not use bullet points.
- Keep the email between 180 and 240 words.
- Mention {company_name} at least twice.
- Maintain a polished yet friendly tone.
- Paragraph 3 must contain specific mappings, not general claims.

OUTPUT TEMPLATE:
<<<BEGIN>>>
SUBJECT: Exploring {job_titles_str} opportunities at {company_name}

BODY:
[Write the body following the structure above with paragraphs separated by blank lines.]
<<<END>>>
"""

        print("📬 Email generation prompt:\n" + email_prompt)
        print(f"📬 Prompt context summary for {job_url}:")
        print(f"   • Requirements: {job_context.get('requirements') if job_context else []}")
        print(f"   • Technologies: {job_context.get('technologies') if job_context else []}")
        print(f"   • Responsibilities: {job_context.get('responsibilities') if job_context else []}")

        try:
            if self.resume_generator:
                result = self.resume_generator.llm.invoke(email_prompt)
                email_content = (
                    result.content.strip()
                    if hasattr(result, 'content')
                    else (result.get('text', result.get('content', str(result))).strip()
                          if isinstance(result, dict)
                          else str(result).strip())
                )

                if '<<<BEGIN>>>' in email_content and '<<<END>>>' in email_content:
                    email_content = email_content.split('<<<BEGIN>>>', 1)[1].split('<<<END>>>', 1)[0].strip()

                if 'SUBJECT:' in email_content and 'BODY:' in email_content:
                    parts = email_content.split('BODY:', 1)
                    subject = parts[0].replace('SUBJECT:', '').strip()
                    body = parts[1].strip()
                else:
                    subject = f"Exploring {job_titles_str} opportunities at {company_name}"
                    body = email_content

                if not subject:
                    subject = f"Exploring {job_titles_str} opportunities at {company_name}"

                # Extract name from resume for signature
                person_name = self._extract_resume_name(resume_content)
                if 'Best regards' not in body:
                    body = body.rstrip() + f"\n\nBest regards,\n{person_name}"

                return subject, body

            subject = f"Exploring {job_titles_str} opportunities at {company_name}"
            body = self._fallback_email_body(recruiter_name, company_name, job_titles_str, resume_content)
            return subject, body

        except Exception as exc:
            print(f"⚠️  Error generating email: {exc}")
            subject = f"Exploring {job_titles_str} opportunities at {company_name}"
            body = self._fallback_email_body(recruiter_name, company_name, job_titles_str, resume_content)
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
            subject, body = self.generate_email_content(
                job_titles,
                job_type,
                email_recruiter,
                resume_content,
                email_recruiter.get('job_url') if isinstance(email_recruiter, dict) else None,
            )
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
                    subject, body = self.generate_email_content(
                        job_titles,
                        job_type,
                        recruiter,
                        resume_content,
                        recruiter.get('job_url') if isinstance(recruiter, dict) else None,
                    )
                    
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
            subject, body = self.generate_email_content(
                job_titles,
                job_type,
                email_recruiter,
                resume_content,
                email_recruiter.get('job_url') if isinstance(email_recruiter, dict) else None,
            )
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
                    subject, body = self.generate_email_content(
                        job_titles,
                        job_type,
                        recruiter,
                        resume_content,
                        recruiter.get('job_url') if isinstance(recruiter, dict) else None,
                    )
                    
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

    def _fallback_email_body(self, recruiter_name: str, company_name: str, job_titles_str: str, resume_content: Optional[str] = None) -> str:
        # Extract name from resume if available
        person_name = self._extract_resume_name(resume_content) if resume_content else "Shreyas Tulsi"
        return (
            f"Dear {recruiter_name},\n\n"
            f"I hope you're doing well. I'm reaching out to express my interest in {job_titles_str} opportunities at {company_name}. "
            "My background combines rigorous academic training with hands-on project experience that aligns well with this team.\n\n"
            f"I'd appreciate the chance to discuss how I can contribute to {company_name}'s goals and would welcome a quick conversation at your convenience.\n\n"
            "Best regards,\n"
            f"{person_name}"
        )

    def _extract_resume_name(self, resume_content: Optional[str]) -> str:
        """
        Extract the person's name from resume content.
        Tries multiple methods: bullet format, raw text, or structured parsing.
        Returns default name if extraction fails.
        """
        if not resume_content:
            return "Shreyas Tulsi"  # Fallback default
        
        # Method 1: Try to extract from bullet format (e.g., "• Name: Raman Arora")
        lines = [line.strip() for line in resume_content.splitlines() if line.strip()]
        for line in lines:
            normalized = line.lstrip('•').strip()
            if normalized.lower().startswith('name:'):
                name = normalized.split(':', 1)[1].strip()
                if name and name != "Not Available":
                    print(f"✅ Extracted name from resume bullets: {name}")
                    return name
        
        # Method 2: Try using resume parser to extract structured data
        if self.resume_generator and self.resume_generator.resume_parser:
            try:
                structured_data = self.resume_generator.resume_parser.extract_structured_data(resume_content)
                name = structured_data.get('name', '')
                if name and name != "Not Available":
                    print(f"✅ Extracted name from structured resume data: {name}")
                    return name
            except Exception as e:
                print(f"⚠️  Could not extract name using resume parser: {e}")
        
        # Method 3: Try to find name in raw text (look for common patterns)
        # This is a simple heuristic - look for lines that might be names
        # (typically at the beginning, capitalized, 2-4 words)
        for i, line in enumerate(lines[:5]):  # Check first 5 lines
            words = line.split()
            if 2 <= len(words) <= 4:
                # Check if all words start with capital letters (likely a name)
                if all(word and word[0].isupper() for word in words):
                    # Exclude common headers
                    if not any(word.lower() in ['email', 'phone', 'address', 'linkedin', 'github', 'resume', 'cv'] for word in words):
                        print(f"✅ Extracted name from raw text: {line}")
                        return line
        
        # Fallback to default
        print("⚠️  Could not extract name from resume, using default")
        return "Shreyas Tulsi"
    
    def _extract_resume_details(self, resume_content: Optional[str]) -> Dict[str, Any]:
        details: Dict[str, Any] = {
            'education': None,
            'graduation': None,
            'experience': [],
        }

        if not resume_content:
            return details

        lines = [line.strip() for line in resume_content.splitlines() if line.strip()]
        for line in lines:
            normalized = line.lstrip('•').strip()
            if normalized.lower().startswith('education') and not details['education']:
                details['education'] = normalized
            if 'graduation' in normalized.lower() and not details['graduation']:
                details['graduation'] = normalized
            if normalized.startswith('-'):
                details['experience'].append(normalized.lstrip('-').strip())
            elif normalized.startswith('•'):
                # Already handled, but keep for safety
                continue
            elif line.startswith('-') or line.startswith('•'):
                details['experience'].append(line.lstrip('-•').strip())

        return details

    async def _fetch_job_context(self, job_url: Optional[str]) -> Optional[Dict[str, Any]]:
        """Fetch job context from database. Now fully async!"""
        if not job_url:
            print("⚠️ No job_url provided to _fetch_job_context")
            return None

        async with AsyncSessionLocal() as session:
            try:
                tracker = JobContextTracker(session)
                context = await tracker.fetch_job_context(job_url)
                # Commit any updates that might have happened during fetch (like re-parsing)
                await session.commit()
                
                if context:
                    print(f"✅ Successfully fetched job context for {job_url}")
                else:
                    print(f"⚠️ No job context found for {job_url}")
                
                return context
            except Exception as e:
                print(f"❌ Error fetching job context: {e}")
                import traceback
                traceback.print_exc()
                await session.rollback()
                return None

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
