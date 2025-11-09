#!/usr/bin/env python3
"""
Job Context Tracker - Stores condensed job info for LinkedIn message generation
"""

from __future__ import annotations

from typing import Dict, List, Optional
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.job_context_service import (
    upsert_job_context,
    get_job_context_by_url,
)
from app.services.unified_messenger.resume_message_generator import ResumeMessageGenerator


class JobContextTracker:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def store_job_context(self, job_url: str, condensed_job: Dict) -> None:
        condensed_desc = condensed_job.get('condensed_description', '')

        sections = self.parse_sections(condensed_desc)

        print(f"🗂️ Storing context for {job_url}")
        print(f"   • Title: {condensed_job.get('title')}")
        print(f"   • Company: {(condensed_job.get('company') or {}).get('name') if isinstance(condensed_job.get('company'), dict) else condensed_job.get('company')}")
        print(f"   • Responsibilities extracted: {len(sections.get('responsibilities', []))} -> {sections.get('responsibilities', [])}")
        print(f"   • Requirements extracted: {len(sections.get('requirements', []))} -> {sections.get('requirements', [])}")
        print(f"   • Technologies extracted: {len(sections.get('technologies', []))} -> {sections.get('technologies', [])}")

        await upsert_job_context(
            self.db,
            job_url=job_url,
            title=condensed_job.get('title'),
            company=(condensed_job.get('company') or {}).get('name') if isinstance(condensed_job.get('company'), dict) else condensed_job.get('company'),
            employment_type=self.get_employment_type(condensed_job),
            condensed_description=condensed_desc,
            requirements=sections.get('requirements', []),
            technologies=sections.get('technologies', []),
            responsibilities=sections.get('responsibilities', []),
            raw_payload=condensed_job,
        )
        
        # Ensure changes are committed
        await self.db.commit()
        print(f"✅ Context committed to database for {job_url}")

    async def store_all_job_contexts(self, condensed_jobs: List[Dict]) -> None:
        for job in condensed_jobs:
            job_url = job.get('url') or job.get('job_url')
            if job_url:
                await self.store_job_context(job_url, job)

    async def fetch_job_context(self, job_url: str) -> Optional[Dict]:
        record = await get_job_context_by_url(self.db, job_url)
        if not record:
            print(f"⚠️ No record found in database for URL: {job_url}")
            return None
        
        print(f"✅ Found record for {job_url}")
        print(f"   • Title: {record.title}")
        print(f"   • Company: {record.company}")
        
        # Extract and normalize the data
        requirements = record.requirements or []
        technologies = record.technologies or []
        responsibilities = record.responsibilities or []
        
        # Debug: Check types
        print(f"   • Requirements type: {type(requirements)}, value: {requirements}")
        print(f"   • Technologies type: {type(technologies)}, value: {technologies}")
        print(f"   • Responsibilities type: {type(responsibilities)}, value: {responsibilities}")
        
        # Ensure they are lists
        if not isinstance(requirements, list):
            print(f"⚠️ Requirements is not a list (type: {type(requirements)}), converting...")
            requirements = list(requirements) if requirements else []
        
        if not isinstance(technologies, list):
            print(f"⚠️ Technologies is not a list (type: {type(technologies)}), converting...")
            technologies = list(technologies) if technologies else []
        
        if not isinstance(responsibilities, list):
            print(f"⚠️ Responsibilities is not a list (type: {type(responsibilities)}), converting...")
            responsibilities = list(responsibilities) if responsibilities else []

        if record.condensed_description and (not requirements or not technologies or not responsibilities):
            print(f"⚠️ Some fields are empty, re-parsing condensed description...")
            reparsed = self.parse_sections(record.condensed_description)
            updated = False
            if not requirements and reparsed.get('requirements'):
                requirements = reparsed['requirements']
                updated = True
                print(f"   • Re-parsed {len(requirements)} requirements")
            if not technologies and reparsed.get('technologies'):
                technologies = reparsed['technologies']
                updated = True
                print(f"   • Re-parsed {len(technologies)} technologies")
            if not responsibilities and reparsed.get('responsibilities'):
                responsibilities = reparsed['responsibilities']
                updated = True
                print(f"   • Re-parsed {len(responsibilities)} responsibilities")
            if updated:
                print(f"   • Updating database with re-parsed data...")
                await upsert_job_context(
                    self.db,
                    job_url=record.job_url,
                    title=record.title,
                    company=record.company,
                    employment_type=record.employment_type,
                    condensed_description=record.condensed_description,
                    requirements=requirements,
                    technologies=technologies,
                    responsibilities=responsibilities,
                    raw_payload=record.raw_payload,
                )
                await self.db.flush()
                print(f"   • Database updated successfully")
        
        print(f"✅ Returning context with:")
        print(f"   • Requirements: {len(requirements)} items")
        print(f"   • Technologies: {len(technologies)} items")
        print(f"   • Responsibilities: {len(responsibilities)} items")

        return {
            'title': record.title,
            'company': record.company,
            'employment_type': record.employment_type,
            'requirements': requirements,
            'technologies': technologies,
            'responsibilities': responsibilities,
            'condensed_description': record.condensed_description,
        }

    async def generate_job_specific_message(
        self,
        job_url: str,
        recruiter_name: str,
        resume_generator: ResumeMessageGenerator,
        resume_content: str,
    ) -> Optional[str]:
        context = await self.fetch_job_context(job_url)
        if not context:
            print(f"❌ No context found for job URL: {job_url}")
            print(f"   ↳ Checking raw payload snapshot for debugging:")
            record = await get_job_context_by_url(self.db, job_url)
            if record and record.raw_payload:
                preview = str(record.raw_payload)[:400]
                print(f"   • Raw payload preview: {preview}")
            return None

        job_specific_prompt = f"""
        Create a personalized LinkedIn connection message using specific job context.

        RESUME: {resume_content[:800]}...
        RECRUITER: {recruiter_name}
        JOB TITLE: {context.get('title', 'Unknown')}
        COMPANY: {context.get('company', 'the company')}

        JOB CONTEXT:
        Key Requirements: {', '.join((context.get('requirements') or [])[:2])}
        Key Technologies: {', '.join((context.get('technologies') or [])[:2])}
        Type: {context.get('employment_type') or 'Full-time'}

        STRUCTURE:
        1. "Dear {recruiter_name}, I'm interested in the {context.get('title', 'role')} position at {context.get('company', 'the company')}"
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
            if hasattr(result, 'content'):
                message = result.content.strip()
            elif isinstance(result, str):
                message = result.strip()
            else:
                message = str(result).strip()

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
            return message

        except Exception as exc:
            print(f"❌ Error generating job-specific message: {exc}")
            return None

    def parse_sections(self, text: str) -> Dict[str, List[str]]:
        if not text:
            return {}

        normalized_text = text.replace('\r\n', '\n')
        pattern = re.compile(
            r"^[\s\*`_~:-]*?(responsibilities|requirements|key\s+technologies)\s*:?[\s\*`_~:-]*",
            re.IGNORECASE | re.MULTILINE,
        )

        matches = list(pattern.finditer(normalized_text))
        if not matches:
            return {}

        sections: Dict[str, List[str]] = {
            'responsibilities': [],
            'requirements': [],
            'technologies': [],
        }

        for index, match in enumerate(matches):
            header = match.group(1).lower().replace('key ', '')  # map 'key technologies' -> 'technologies'
            start = match.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized_text)
            section_text = normalized_text[start:end]

            bullets: List[str] = []
            for line in section_text.split('\n'):
                stripped = line.strip()
                if not stripped:
                    continue
                while stripped and stripped[0] in {'•', '-', '*', '–', '—', '·', '`'}:
                    stripped = stripped[1:].strip()
                bullet = stripped.rstrip('*` ').strip()
                if bullet and not bullet.lower().startswith(tuple(['responsibilities', 'requirements', 'key technologies'])):
                    bullets.append(bullet)

            if header in sections:
                sections[header] = bullets[:3]

        return sections

    def get_employment_type(self, job: Dict) -> Optional[str]:
        criteria = job.get('criteria')
        if not isinstance(criteria, list):
            return None
        for criterion in criteria:
            name = criterion.get('name', '').lower()
            if 'employment' in name:
                return criterion.get('value')
        return None