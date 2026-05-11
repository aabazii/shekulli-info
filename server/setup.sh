#!/bin/bash
# Shekulli.info — one-time setup script
# Run from the server/ directory: bash setup.sh

set -e

echo "🗞  Shekulli.info server setup"
echo "================================"

# 1. Install PostgreSQL if missing
if ! command -v psql &>/dev/null; then
  echo "📦  Installing PostgreSQL via Homebrew..."
  if ! command -v brew &>/dev/null; then
    echo "❌  Homebrew not found. Install it first: https://brew.sh"
    exit 1
  fi
  brew install postgresql@16
  brew services start postgresql@16
  # Add to PATH for this session
  export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
  echo "✅  PostgreSQL installed and started"
else
  echo "✅  PostgreSQL already installed"
fi

# 2. Create database
echo "🗄   Creating database 'shekulli'..."
createdb shekulli 2>/dev/null || echo "   (database may already exist — continuing)"

# 3. Run schema
echo "📋  Applying schema..."
psql shekulli -f schema.sql
echo "✅  Schema applied"

# 4. Create .env from example if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚙️   Created server/.env — edit it to add your FB_ACCESS_TOKEN"
else
  echo "⚙️   server/.env already exists"
fi

echo ""
echo "✅  Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit server/.env — add your Facebook Page Access Token"
echo "     (see .env.example for instructions)"
echo ""
echo "  2. Start the server:"
echo "     cd server && npm start"
echo ""
echo "  3. Trigger a manual sync:"
echo "     curl -X POST http://localhost:4000/api/sync"
echo ""
