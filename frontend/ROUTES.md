# Frontend Routes

This document describes all routes in the frontend application.

## Route Table

| Path | Title | Purpose | Data In/Out |
|------|-------|---------|-------------|
| `/` | Dashboard | Outreach summary with metrics, roles reached, and latest attempts | **In**: Stats from localStorage (`outreach_stats`)<br/>**Out**: Reset stats action<br/>**State**: `stats` (LinkedIn invites, emails sent, roles reached, latest attempts), reset confirmation |
| `/search` | Search | Guided flow to find companies, jobs, and recruiters, then map and outreach | **In**: Companies list, jobs list, recruiters list, mapping results<br/>**Out**: React Query keys: `['companies']`, `['jobs']`, `['recruiters']`, `['mapping']`<br/>**State**: `selectedCompanies`, `selectedJobs`, `currentStep`, drawer open/close state |
| `/messages` | Messages | Review and edit AI-generated LinkedIn messages and emails before sending | **In**: Messages data from search/mapping flow<br/>**Out**: Message sending status, updates dashboard stats<br/>**State**: Edited messages, sending status per message |
| `/campaigns/:id` | Campaign Detail | View campaign recipients, status, and perform send/pause/resume actions | **In**: Campaign data, recipients table, activity feed<br/>**Out**: React Query keys: `['campaign', id]`, `['campaignRecipients', id]`, `['campaignActivity', id]`<br/>**State**: Campaign status, selected recipient IDs |
| `/settings` | Settings | Configure integrations and email sending defaults | **In**: Integration configs, email domain settings<br/>**Out**: React Query keys: `['settings']`<br/>**State**: Form inputs for API keys (masked), SMTP config, domain settings |

## Notes

- All routes are client-side only (no backend endpoint listing)
- All data fetching uses React Query for caching and state management
- Form inputs and selections use local component state
- Drawer/modal open/close state is managed locally per component

