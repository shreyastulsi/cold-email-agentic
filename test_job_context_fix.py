#!/usr/bin/env python3
"""
Quick test script to verify job context storage and retrieval works.
Run this after restarting the backend server.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.db.base import AsyncSessionLocal
from app.services.unified_messenger.job_context_tracker import JobContextTracker


async def test_storage_and_retrieval():
    """Test storing and retrieving a job context."""
    
    print("\n" + "="*60)
    print("🧪 TESTING JOB CONTEXT STORAGE AND RETRIEVAL")
    print("="*60)
    
    # Test job with condensed description
    test_job = {
        'url': 'https://www.linkedin.com/jobs/view/test-12345',
        'title': 'Test Software Engineer',
        'company': {'name': 'Test Company'},
        'condensed_description': '''
**Requirements:**
- Bachelor's degree in Computer Science
- 5+ years of Python experience
- Strong problem-solving skills

**Key Technologies:**
- Python
- PostgreSQL
- Docker
- Kubernetes

**Responsibilities:**
- Design and implement scalable systems
- Mentor junior developers
- Lead technical discussions
        ''',
        'criteria': [
            {'name': 'Employment Type', 'value': 'Full-time'}
        ]
    }
    
    async with AsyncSessionLocal() as session:
        tracker = JobContextTracker(session)
        
        # Test 1: Store context
        print("\n📝 Test 1: Storing job context...")
        try:
            await tracker.store_job_context(test_job['url'], test_job)
            print("✅ Storage test PASSED")
        except Exception as e:
            print(f"❌ Storage test FAILED: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        # Test 2: Fetch context
        print("\n🔍 Test 2: Fetching job context...")
        try:
            context = await tracker.fetch_job_context(test_job['url'])
            
            if not context:
                print("❌ Fetch test FAILED: No context returned")
                return False
            
            print(f"✅ Fetch test PASSED")
            print(f"\n📊 Retrieved Context:")
            print(f"   Title: {context.get('title')}")
            print(f"   Company: {context.get('company')}")
            print(f"   Requirements: {len(context.get('requirements', []))} items")
            print(f"      {context.get('requirements', [])}")
            print(f"   Technologies: {len(context.get('technologies', []))} items")
            print(f"      {context.get('technologies', [])}")
            print(f"   Responsibilities: {len(context.get('responsibilities', []))} items")
            print(f"      {context.get('responsibilities', [])}")
            
            # Verify data integrity
            if not context.get('requirements'):
                print("⚠️ WARNING: Requirements list is empty")
            if not context.get('technologies'):
                print("⚠️ WARNING: Technologies list is empty")
            if not context.get('responsibilities'):
                print("⚠️ WARNING: Responsibilities list is empty")
            
            # Check types
            if not isinstance(context.get('requirements'), list):
                print(f"❌ Type check FAILED: requirements is {type(context.get('requirements'))}, expected list")
                return False
            if not isinstance(context.get('technologies'), list):
                print(f"❌ Type check FAILED: technologies is {type(context.get('technologies'))}, expected list")
                return False
            if not isinstance(context.get('responsibilities'), list):
                print(f"❌ Type check FAILED: responsibilities is {type(context.get('responsibilities'))}, expected list")
                return False
            
            print("✅ Type check PASSED: All fields are lists")
            
        except Exception as e:
            print(f"❌ Fetch test FAILED: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    print("\n" + "="*60)
    print("✅ ALL TESTS PASSED!")
    print("="*60)
    return True


async def test_event_loop_handling():
    """Test that fetching works in different async contexts."""
    
    print("\n" + "="*60)
    print("🧪 TESTING EVENT LOOP HANDLING")
    print("="*60)
    
    from app.services.unified_messenger.unified_messenger import UnifiedMessenger
    
    messenger = UnifiedMessenger()
    
    # Create a test job context first
    test_url = 'https://www.linkedin.com/jobs/view/test-event-loop'
    test_job = {
        'url': test_url,
        'title': 'Event Loop Test Job',
        'company': 'Test Company',
        'condensed_description': '''
**Requirements:**
- Test requirement 1
- Test requirement 2

**Key Technologies:**
- Test tech 1
- Test tech 2

**Responsibilities:**
- Test responsibility 1
- Test responsibility 2
        '''
    }
    
    # Store it first
    async with AsyncSessionLocal() as session:
        tracker = JobContextTracker(session)
        await tracker.store_job_context(test_url, test_job)
        print("✅ Test context stored")
    
    # Test fetching from sync method (simulates email generation)
    print("\n🔍 Testing _fetch_job_context (sync method calling async)...")
    try:
        # This simulates what happens during email generation
        context = messenger._fetch_job_context(test_url)
        
        if context:
            print("✅ Event loop handling test PASSED")
            print(f"   Retrieved: {context.get('title')}")
            print(f"   Requirements: {len(context.get('requirements', []))} items")
        else:
            print("❌ Event loop handling test FAILED: No context returned")
            return False
            
    except RuntimeError as e:
        if "event loop" in str(e).lower():
            print(f"❌ Event loop handling test FAILED: {e}")
            return False
        raise
    except Exception as e:
        print(f"❌ Event loop handling test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "="*60)
    print("✅ EVENT LOOP TEST PASSED!")
    print("="*60)
    return True


async def main():
    """Run all tests."""
    
    print("\n🚀 Starting Job Context Fix Tests...")
    print("="*60)
    
    # Test 1: Basic storage and retrieval
    test1_passed = await test_storage_and_retrieval()
    
    # Test 2: Event loop handling
    test2_passed = await test_event_loop_handling()
    
    print("\n" + "="*60)
    print("📊 FINAL RESULTS")
    print("="*60)
    print(f"Basic Storage/Retrieval: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"Event Loop Handling:     {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed:
        print("\n🎉 ALL TESTS PASSED! Job context fix is working correctly!")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED. Check errors above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

