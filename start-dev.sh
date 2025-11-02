#!/bin/bash
# Development startup script for Cold Email Platform

set -e

echo "🚀 Starting Cold Email Platform Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found. Creating from example...${NC}"
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✓ Created backend/.env${NC}"
        echo -e "${RED}⚠️  IMPORTANT: Edit backend/.env and add your API keys!${NC}"
    else
        echo -e "${RED}✗ backend/.env.example not found!${NC}"
        exit 1
    fi
fi

if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}⚠️  frontend/.env not found. Creating from example...${NC}"
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env
        echo -e "${GREEN}✓ Created frontend/.env${NC}"
        echo -e "${RED}⚠️  IMPORTANT: Edit frontend/.env and add your Supabase keys!${NC}"
    else
        echo -e "${RED}✗ frontend/.env.example not found!${NC}"
        exit 1
    fi
fi

echo ""
echo "📦 Step 1: Starting Database..."
cd infra
docker-compose up -d db
echo -e "${GREEN}✓ Database started${NC}"

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

echo ""
echo "📊 Step 2: Running Database Migrations..."
cd ../backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate 2>/dev/null || . venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1 || true

alembic upgrade head
echo -e "${GREEN}✓ Migrations completed${NC}"

echo ""
echo "🌱 Step 3: Seeding Database (optional)..."
python -m app.db.seed 2>/dev/null || echo "Seed skipped (may already exist)"

echo ""
echo "🔧 Step 4: Starting Backend..."
cd ../infra
docker-compose up -d backend
echo -e "${GREEN}✓ Backend started${NC}"

echo ""
echo "⏳ Waiting for backend to be ready..."
sleep 5

# Test backend health
if curl -s http://localhost:8000/healthz > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Backend may still be starting...${NC}"
fi

echo ""
echo "🎨 Step 5: Starting Frontend..."
echo "   (If not using Docker, run manually: cd frontend && npm run dev)"

echo ""
echo -e "${GREEN}✅ Development environment started!${NC}"
echo ""
echo "📍 Access your application:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   Database:  localhost:5432"
echo ""
echo "📋 Useful commands:"
echo "   View logs:      cd infra && docker-compose logs -f"
echo "   Stop services:  cd infra && docker-compose down"
echo "   Frontend:       cd frontend && npm run dev"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "   1. Edit backend/.env with your API keys"
echo "   2. Edit frontend/.env with your Supabase keys"
echo "   3. Start frontend manually if not using Docker"
