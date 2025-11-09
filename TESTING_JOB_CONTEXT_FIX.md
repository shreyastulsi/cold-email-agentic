# Testing the Job Context Fix

## Quick Test Commands

### 1. Restart Backend Server
```bash
cd /Users/shreyastulsi/Cold-Email/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

### 2. Check Database Connection

Open a Python shell and verify the job contexts table:
```python
import asyncio
from sqlalchemy import select
from app.db.base import AsyncSessionLocal
from app.db.models.job_context import JobContext

async def check_contexts():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JobContext))
        contexts = result.scalars().all()
        print(f"Found {len(contexts)} job contexts in database")
        
        if contexts:
            sample = contexts[0]
            print(f"\nSample context:")
            print(f"  URL: {sample.job_url}")
            print(f"  Title: {sample.title}")
            print(f"  Requirements type: {type(sample.requirements)}")
            print(f"  Requirements: {sample.requirements}")
            print(f"  Technologies type: {type(sample.technologies)}")
            print(f"  Technologies: {sample.technologies}")
            print(f"  Responsibilities type: {type(sample.responsibilities)}")
            print(f"  Responsibilities: {sample.responsibilities}")

asyncio.run(check_contexts())
```

### 3. Test Storing New Job Context

```python
import asyncio
from app.db.base import AsyncSessionLocal
from app.services.unified_messenger.job_context_tracker import JobContextTracker

async def test_store():
    test_job = {
        'url': 'https://linkedin.com/jobs/test-123',
        'title': 'Senior Software Engineer',
        'company': {'name': 'Test Company'},
        'condensed_description': '''
        **Requirements:**
        - 5+ years Python experience
        - Strong problem-solving skills
        - BS in Computer Science
        
        **Key Technologies:**
        - Python
        - PostgreSQL
        - Docker
        
        **Responsibilities:**
        - Design scalable systems
        - Mentor junior developers
        - Lead technical discussions
        ''',
        'criteria': [
            {'name': 'Employment Type', 'value': 'Full-time'}
        ]
    }
    
    async with AsyncSessionLocal() as session:
        tracker = JobContextTracker(session)
        await tracker.store_job_context(test_job['url'], test_job)
        print("✅ Test job context stored!")
        
        # Now fetch it back
        context = await tracker.fetch_job_context(test_job['url'])
        print(f"\n✅ Fetched context:")
        print(f"  Requirements: {context['requirements']}")
        print(f"  Technologies: {context['technologies']}")
        print(f"  Responsibilities: {context['responsibilities']}")

asyncio.run(test_store())
```

### 4. Test Email Generation with Job Context

```python
import asyncio
from app.services.unified_messenger.unified_messenger import UnifiedMessenger

async def test_email_generation():
    messenger = UnifiedMessenger()
    
    # Simulate a recruiter with job_url attached (this is what the fix does)
    recruiter = {
        'name': 'Jane Smith',
        'company': 'Test Company',
        'job_url': 'https://linkedin.com/jobs/test-123',  # This is now attached!
        'profile_url': 'https://linkedin.com/in/janesmith'
    }
    
    # Load resume
    resume_content = messenger.resume_generator.load_resume('Resume-Tulsi,Shreyas.pdf')
    
    # Generate email - should now successfully fetch job context
    subject, body = messenger.generate_email_content(
        job_titles=['Software Engineer'],
        job_type='full_time',
        recruiter=recruiter,
        resume_content=resume_content
    )
    
    print(f"\n📧 Generated Email:")
    print(f"Subject: {subject}")
    print(f"\nBody:\n{body}")

asyncio.run(test_email_generation())
```

## What to Look For

### Success Indicators ✅

1. **When storing:**
   ```
   🗂️ Storing context for <URL>
      • Title: <Job Title>
      • Company: <Company Name>
      • Responsibilities extracted: 3 -> [...]
      • Requirements extracted: 3 -> [...]
      • Technologies extracted: 3 -> [...]
   ✅ Context committed to database for <URL>
   ```

2. **When fetching:**
   ```
   ✅ Found record for <URL>
      • Title: <Job Title>
      • Company: <Company Name>
      • Requirements type: <class 'list'>, value: [...]
      • Technologies type: <class 'list'>, value: [...]
      • Responsibilities type: <class 'list'>, value: [...]
   ✅ Returning context with:
      • Requirements: 3 items
      • Technologies: 3 items
      • Responsibilities: 3 items
   ```

3. **During job-recruiter mapping:**
   ```
   🔍 DEBUG: Mapped <Job Title> -> <Recruiter Name> (<Company>)
   🔗 DEBUG: Job URL attached to recruiter: <URL>
   ```

4. **During email generation:**
   ```
   🔗 No job_url provided as argument, extracted from recruiter: <URL>
   ✅ Found record for <URL>
   ✅ Successfully fetched job context for <URL>
   📬 Prompt context summary for <URL>:
      • Requirements: [...]
      • Technologies: [...]
      • Responsibilities: [...]
   ```

### Failure Indicators ❌

1. **Missing job_url:**
   ```
   ⚠️ No job_url provided to _fetch_job_context
   ⚠️ No job context found for None
   ```
   → Check if job_url is being attached during mapping

2. **Type mismatch:**
   ```
   ⚠️ Requirements is not a list (type: <class 'dict'>), converting...
   ```
   → Should auto-convert, but indicates data was stored incorrectly

3. **Missing data:**
   ```
   ⚠️ No record found in database for URL: <URL>
   ```
   → Job context was never stored, or URL doesn't match

4. **Empty fields:**
   ```
   ⚠️ Some fields are empty, re-parsing condensed description...
      • Re-parsed 3 requirements
      • Re-parsed 3 technologies
      • Re-parsed 2 responsibilities
   ```
   → This is OK - it auto-recovers by re-parsing

## Integration Test

Run a complete end-to-end workflow:

```python
import asyncio
from app.services.unified_messenger.unified_messenger import UnifiedMessenger

async def full_workflow_test():
    messenger = UnifiedMessenger()
    
    # 1. Search for jobs (with condensed summaries)
    company_ids = ['1441']  # Microsoft example
    job_titles = ['Software Engineer']
    jobs = messenger.search_jobs(company_ids, job_titles, ['full_time'])
    
    print(f"✅ Found {len(jobs)} jobs")
    
    # 2. Store job contexts
    from app.db.base import AsyncSessionLocal
    from app.services.unified_messenger.job_context_tracker import JobContextTracker
    
    async with AsyncSessionLocal() as session:
        tracker = JobContextTracker(session)
        # Assuming jobs have condensed_description
        for job in jobs[:3]:  # Test with first 3
            await tracker.store_job_context(
                job.get('url') or job.get('job_url'),
                job
            )
    
    print(f"✅ Stored contexts for {min(3, len(jobs))} jobs")
    
    # 3. Search for recruiters
    recruiters = messenger.search_recruiters(company_ids)
    print(f"✅ Found {len(recruiters)} recruiters")
    
    # 4. Map jobs to recruiters (this should attach job_url)
    selected_recruiters, mapping = messenger.map_jobs_to_recruiters(
        jobs[:3],
        recruiters,
        max_pairs=3
    )
    
    print(f"✅ Mapped {len(mapping)} job-recruiter pairs")
    
    # 5. Verify job_url is attached
    for idx, recruiter in enumerate(selected_recruiters):
        job_url = recruiter.get('job_url')
        print(f"\nRecruiter {idx + 1}: {recruiter.get('name')}")
        print(f"  Job URL attached: {job_url is not None}")
        print(f"  Job URL: {job_url}")
    
    # 6. Generate email for first recruiter
    if selected_recruiters:
        resume_content = messenger.resume_generator.load_resume('Resume-Tulsi,Shreyas.pdf')
        
        subject, body = messenger.generate_email_content(
            job_titles,
            'full_time',
            selected_recruiters[0],
            resume_content
        )
        
        print(f"\n✅ Email generated successfully!")
        print(f"Subject: {subject}")
        print(f"\nBody preview: {body[:200]}...")

asyncio.run(full_workflow_test())
```

## Troubleshooting

### Issue: Job context not found during email generation

**Check:**
1. Is job_url attached to recruiter? Add print: `print(recruiter.get('job_url'))`
2. Was context stored? Check database with query in step 2
3. Do URLs match exactly? They're case-sensitive

**Fix:**
- Ensure you're using the fixed `map_jobs_to_recruiters()` function
- Verify job objects have a 'url' or 'job_url' field

### Issue: Requirements/Technologies are not lists

**Check:**
- Run the database check script (step 2)
- Look for type warnings in logs

**Fix:**
- The new code should auto-convert, but you may need to re-store contexts
- Use the re-parsing feature by ensuring condensed_description is present

### Issue: Email doesn't mention job requirements

**Check:**
- Look for "Prompt context summary" in logs
- Verify requirements/technologies/responsibilities are populated

**Fix:**
- Ensure condensed_description has proper format with section headers
- Check that parse_sections() is extracting data correctly

## Success Criteria

✅ Job contexts store successfully with commit confirmation  
✅ Fetch returns data as lists  
✅ Job URL is attached to recruiters during mapping  
✅ Email generation successfully queries job context  
✅ Generated emails include job-specific requirements/technologies  
✅ No type errors or conversion warnings in logs  

If all criteria are met, the fix is working correctly! 🎉

