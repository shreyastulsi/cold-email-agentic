# Keryx - Intelligent Outreach Platform

Keryx (κῆρυξ) is Greek for "herald" - a full-stack intelligent outreach platform with React frontend, FastAPI backend, and PostgreSQL database.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + React Router + TanStack Query
- **Backend**: FastAPI (Python, async) + Pydantic v2 + BackgroundTasks
- **Database**: PostgreSQL (SQLAlchemy 2.0 async + Alembic, asyncpg)
- **Auth**: Supabase Auth (JWT verified server-side)

## Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Quick Start

1. **Clone and setup environment files:**

```bash
# Copy environment examples
cp infra/.env.postgres.example infra/.env.postgres
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. **Fill in your environment variables:**

Edit `backend/.env` and add your API keys:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `BASE_URL` (Unipile base URL)
- `UNIPILE_API_KEY`
- `UNIPILE_ACCOUNT_ID`
- `APOLLO_API_KEY`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `FROM_EMAIL`
- `OPENAI_API_KEY`

Edit `frontend/.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. **Start the application:**

```bash
make dev
```

This will:
- Start PostgreSQL, backend, and frontend services
- Run database migrations
- Make services available at:
  - Frontend: http://localhost:5173
  - Backend: http://localhost:8000
  - Database: localhost:5432

### Manual Setup

If you prefer to run services locally without Docker:

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
.
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   └── package.json
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/      # FastAPI endpoints
│   │   ├── core/     # Config, security, logging
│   │   ├── db/       # Database models and session
│   │   ├── services/ # Business logic (UnifiedMessenger)
│   │   └── main.py
│   └── alembic/       # Database migrations
├── infra/            # Docker compose and infrastructure
│   └── docker-compose.yml
└── Makefile          # Common commands

```

## API Endpoints

### Authentication
- `GET /api/v1/auth/me` - Get current user

### LinkedIn/Unipile
- `POST /api/v1/linkedin/provider-id` - Convert LinkedIn URL to Provider ID
- `POST /api/v1/linkedin/chats/search` - Search for existing chat
- `POST /api/v1/linkedin/chats/{chat_id}/messages` - Send message to existing chat
- `POST /api/v1/linkedin/messages/new` - Send message to new user
- `POST /api/v1/linkedin/invitations` - Send LinkedIn invitation

### Search
- `POST /api/v1/search/company` - Search for company
- `POST /api/v1/search/jobs` - Search for jobs
- `POST /api/v1/search/recruiters` - Search for recruiters
- `POST /api/v1/search/map` - Map jobs to recruiters

### Outreach
- `POST /api/v1/outreach/emails/extract` - Extract emails for recruiters
- `POST /api/v1/outreach/email/generate` - Generate email content
- `POST /api/v1/outreach/email/send` - Send email
- `POST /api/v1/outreach/campaign/email-only` - Email-only campaign
- `POST /api/v1/outreach/campaign/dual` - Dual outreach campaign

### Templates
- `GET /api/v1/email/templates` - List templates
- `POST /api/v1/email/templates` - Create template

## Database Migrations

```bash
# Create new migration
make migration name="description"

# Apply migrations
make migrate
```

## Development

### Backend

The backend uses the existing `UnifiedMessenger` class from `ananya/unified_messenger.py`. The business logic is preserved and wrapped in async adapters in `backend/app/services/unified_messenger/adapter.py`.

### Frontend

Frontend pages are organized as:
- `/` - Dashboard (KPIs and latest attempts)
- `/search` - Search flow (Companies → Jobs → Recruiters → Map → Outreach)
- `/email` - Email template editor with live preview
- `/campaigns/:id` - Campaign detail view
- `/pipeline` - Pipeline/Kanban board
- `/settings` - Settings and integrations

## Notes

- All endpoints require Bearer token authentication (except `/healthz`)
- Supabase JWT tokens are verified server-side
- User records are auto-created on first request
- Default email fallback is enabled for development (TODO: disable in production)

## License

MIT

