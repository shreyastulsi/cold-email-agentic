#!/bin/bash
# Setup script for Cold Email Platform

set -e

echo "🚀 Setting up Cold Email Platform..."
echo ""

# Create environment files
echo "📝 Creating environment files..."

if [ -f "backend/.env.example" ]; then
  if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
  else
    echo "⚠️  backend/.env already exists, skipping..."
  fi
else
  echo "✗ backend/.env.example not found!"
fi

if [ -f "frontend/.env.example" ]; then
  if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    echo "✓ Created frontend/.env"
  else
    echo "⚠️  frontend/.env already exists, skipping..."
  fi
else
  echo "✗ frontend/.env.example not found!"
fi

if [ -f "infra/.env.postgres.example" ]; then
  if [ ! -f "infra/.env.postgres" ]; then
    cp infra/.env.postgres.example infra/.env.postgres
    echo "✓ Created infra/.env.postgres"
  else
    echo "⚠️  infra/.env.postgres already exists, skipping..."
  fi
else
  echo "✗ infra/.env.postgres.example not found!"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "⚠️  IMPORTANT: Edit the following files and add your API keys:"
echo "   - backend/.env"
echo "   - frontend/.env"
echo ""
echo "📖 See QUICK_START.md for detailed instructions"
echo ""
echo "To start the application:"
echo "   make dev"
echo "   OR"
echo "   cd infra && docker-compose up -d"

