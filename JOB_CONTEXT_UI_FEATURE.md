# Job Context Display in Search, Messages & Draft Review

## Overview
Added a new expandable UI section in the **Search** (dashboard/search), **Messages**, and **Drafts** pages that displays the extracted job requirements, technologies, and responsibilities used for email generation. This helps you see exactly what context the AI used when crafting personalized messages across all stages of your outreach workflow.

## What's New

### Backend Changes

1. **New API Endpoint** (`/api/v1/job-context`)
   - Fetches job context for a given job URL
   - Returns requirements, technologies, responsibilities, and other job details
   - Located in: `/backend/app/api/v1/drafts.py`

   **Usage:**
   ```
   GET /api/v1/job-context?job_url=<encoded_url>
   ```

   **Response:**
   ```json
   {
     "success": true,
     "context": {
       "title": "Software Engineer",
       "company": "Company Name",
       "employment_type": "Full-time",
       "requirements": ["Requirement 1", "Requirement 2"],
       "technologies": ["Python", "React", "AWS"],
       "responsibilities": ["Responsibility 1", "Responsibility 2"],
       "condensed_description": "Brief description"
     }
   }
   ```

### Frontend Changes

1. **Job Context Section in Search Page (dashboard/search)**
   - Located below the LinkedIn and Email message sections in each generated message
   - Only shows if a job URL is associated with the message
   - Uses a collapsible component (click to expand/collapse)
   - Allows you to review job context immediately after generation, before deciding to send

2. **Job Context Section in Messages Page**
   - Located below the LinkedIn and Email message sections in each message card
   - Only shows if a job URL is associated with the message
   - Uses a collapsible component (click to expand/collapse)
   - Allows you to review job context while editing and sending messages

3. **Job Context Section in Drafts Page**
   - Located below the email/LinkedIn message sections
   - Only shows if a job URL is associated with the draft
   - Uses a collapsible component (click to expand/collapse)
   - Allows you to verify context used when reviewing saved drafts

4. **Features (All Pages):**
   - **Lazy Loading:** Job context is fetched only when you expand the section
   - **Caching:** Once fetched, the context is cached in state (no repeated API calls)
   - **Loading State:** Shows "Loading job context..." while fetching
   - **Organized Display:**
     - ✅ Requirements
     - 💻 Technologies
     - 🎯 Responsibilities
   - **Empty State:** Shows appropriate message if no context is available

## User Experience

### How to Use

#### Option 1: In Search Page (Immediate Review After Generation)

1. **Complete Job Search and Message Generation**
   - Search for jobs in the dashboard/search page
   - Map jobs to recruiters
   - Generate messages

2. **View Job Context Right Away**
   - After messages are generated, scroll down on any message card
   - You'll see a "📋 Job Context" section at the bottom
   - Click on it to expand and view:
     - All extracted requirements
     - All identified technologies
     - All listed responsibilities

3. **Verify Before Deciding**
   - Check if the context matches what you expected
   - Verify email content aligns with extracted context
   - Decide whether to send or save as draft

#### Option 2: In Messages Page (Review Before Sending)

1. **Navigate to Messages Page**
   - Complete a job search and proceed to the "Review & Send Messages" page
   - You'll see all generated messages for each recruiter

2. **View Job Context While Reviewing**
   - Scroll down past the LinkedIn and Email sections on any message card
   - You'll see a "📋 Job Context" section at the bottom
   - Click on it to expand and view:
     - All extracted requirements
     - All identified technologies
     - All listed responsibilities

3. **Verify Before Sending**
   - Check if the context matches the job posting
   - Ensure the email references align with the extracted requirements
   - Edit the message if needed based on the context

#### Option 2: In Drafts Page (Review Saved Drafts)

1. **Navigate to Drafts Page**
   - Click on "📝 Drafts" in the sidebar

2. **Expand a Draft**
   - Click on any draft to expand its details
   - You'll see the email and/or LinkedIn message sections

3. **View Job Context**
   - Scroll down past the messages to the "📋 Job Context" section
   - Click on it to expand and view:
     - All extracted requirements
     - All identified technologies
     - All listed responsibilities

4. **Understanding the Context**
   - This is the exact information the AI used to personalize your email
   - It shows what requirements/technologies were mapped to your skills
   - Helps you understand why the email mentions specific experiences

### Visual Layout

#### Messages Page Layout

```
┌─────────────────────────────────────────┐
│ Recruiter Info (Name, Company, Job)     │
│ [Save Draft Button]                     │
├─────────────────────────────────────────┤
│ 💼 LinkedIn Message  |  📧 Email        │
│ [Editable Text]      |  [Subject/Body]  │
│ [Send Button]        |  [Send Button]   │
├─────────────────────────────────────────┤
│ 📋 Job Context ▼ (Click to Expand)     │
│                                          │
│ ✅ Requirements                          │
│   • Bachelor's degree in CS             │
│   • 3+ years of experience              │
│                                          │
│ 💻 Technologies                          │
│   • Python                               │
│   • React                                │
│   • AWS                                  │
│                                          │
│ 🎯 Responsibilities                      │
│   • Build scalable backend systems      │
│   • Collaborate with cross-functional   │
│     teams                                │
└─────────────────────────────────────────┘
```

#### Drafts Page Layout

```
┌─────────────────────────────────────────┐
│ Draft Header (Recruiter Name, Company)  │
│ ▼ Expand                                 │
├─────────────────────────────────────────┤
│ 📧 Email Section                        │
│ [Subject, Body, Send Button]            │
├─────────────────────────────────────────┤
│ 💼 LinkedIn Section                     │
│ [Message, Send Button]                  │
├─────────────────────────────────────────┤
│ 📋 Job Context ▼ (Click to Expand)     │
│                                          │
│ ✅ Requirements                          │
│   • Bachelor's degree in CS             │
│   • 3+ years of experience              │
│                                          │
│ 💻 Technologies                          │
│   • Python                               │
│   • React                                │
│   • AWS                                  │
│                                          │
│ 🎯 Responsibilities                      │
│   • Build scalable backend systems      │
│   • Collaborate with cross-functional   │
│     teams                                │
└─────────────────────────────────────────┘
```

## Technical Details

### State Management

All three pages maintain similar state structures:

**Search Page (dashboard/search):**
- `jobContexts`: Object mapping message indices to their job context data
- `loadingJobContexts`: Set of message indices currently loading context
- `expandedJobContexts`: Set of message indices with expanded job context sections

**Messages Page:**
- `jobContexts`: Object mapping message indices to their job context data
- `loadingJobContexts`: Set of message indices currently loading context
- `expandedJobContexts`: Set of message indices with expanded job context sections

**Drafts Page:**
- `jobContexts`: Object mapping draft IDs to their job context data
- `loadingJobContexts`: Set of draft IDs currently loading context
- Job context sections expand/collapse using the existing `Collapsible` component

### API Integration

- Uses the existing `apiRequest` utility for authenticated requests
- Automatically includes authentication token
- Handles errors gracefully (logs to console, doesn't crash UI)

### Performance Optimizations

1. **Lazy Loading:** Only fetches when needed (draft expanded)
2. **Caching:** Stores fetched contexts to avoid duplicate requests
3. **Loading Guards:** Prevents multiple simultaneous requests for same context

## Benefits

1. **Transparency:** See exactly what information the AI used for email generation
2. **Quality Control:** Verify that the correct requirements were extracted before sending
3. **Learning:** Understand how your experience maps to job requirements
4. **Debugging:** Identify if a message needs editing due to incorrect context extraction
5. **Immediate Feedback:** Check context in the Search page right after generation (instant validation)
6. **Real-Time Review:** Check context in the Messages page before sending (proactive)
7. **Historical Review:** Review context in the Drafts page to understand past messages (retrospective)

## Example Scenarios

### Scenario 1: Immediate Validation (Search Page)

**Situation:** You just generated messages in the dashboard/search page and want to verify quality before deciding what to do.

**Action:**
1. After messages generate, click on the "📋 Job Context" section on a message card
2. Review the extracted requirements and technologies
3. Compare them with the email content inline
4. Notice that the requirements accurately captured the job needs
5. Decide to send the message immediately or save it as a draft

**Result:** You validate the quality right away and can confidently send messages or flag issues for later review.

### Scenario 2: Pre-Send Review (Messages Page)

**Situation:** You're reviewing generated messages and want to ensure they're personalized correctly.

**Action:** 
1. Click on the "📋 Job Context" section in the message card
2. Review the extracted requirements and technologies
3. Compare them with the email content
4. Notice that the email mentions "Python experience" but the technologies list shows "Java"
5. Edit the email to correct the mismatch before sending

**Result:** You catch and fix the error before sending, improving your outreach quality.

### Scenario 3: Draft Review (Drafts Page)

**Situation:** You saved a draft last week and want to review it before sending.

**Action:**
1. Expand the draft in the Drafts page
2. Click on the "📋 Job Context" section
3. See the requirements, technologies, and responsibilities
4. Verify that the email content aligns with the job requirements
5. Confirm the message is still relevant and personalized

**Result:** You have full context before sending a saved draft, ensuring quality control.

## Future Enhancements

Potential improvements:
- Ability to edit/update job context directly from the UI
- Visual indicators showing which requirements were matched to your experience
- Highlighting specific technologies mentioned in the email
- Export job context for record-keeping

