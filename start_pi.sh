#!/bin/bash

# ============================================================
# ArXiv Newsletter & AI Assistant — Raspberry Pi Deploy Script
# ============================================================
# This script:
#   1. Validates .env configuration (AcademicCloud + OpenRouter keys)
#   2. Builds and starts Docker containers
#   3. Optionally starts an Ngrok tunnel for public access
#
# Usage:
#   chmod +x start_pi.sh
#   ./start_pi.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/ngrok.log"

echo "==================================================="
echo " ArXiv Newsletter — Raspberry Pi Deployment"
echo "==================================================="

# ---------------------------------------------------------
# 1. Check environment configuration
# ---------------------------------------------------------
ENV_FILE="backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found."
    echo "Create it with:"
    echo "  OPENROUTER_API_KEY=sk-or-v1-..."
    echo "  BASE_URL=https://chat-ai.academiccloud.de/v1"
    echo "  API_KEY=your-academic-cloud-key"
    exit 1
fi

# Check for at least one LLM API key
HAS_PRIMARY=$(grep -q "API_KEY" "$ENV_FILE" && grep -q "BASE_URL" "$ENV_FILE" && echo "yes" || echo "no")
HAS_FALLBACK=$(grep -q "OPENROUTER_API_KEY" "$ENV_FILE" && echo "yes" || echo "no")

if [ "$HAS_PRIMARY" = "no" ] && [ "$HAS_FALLBACK" = "no" ]; then
    echo "ERROR: No LLM API keys found in $ENV_FILE."
    echo "Please add at least one of:"
    echo "  - BASE_URL + API_KEY (AcademicCloud primary)"
    echo "  - OPENROUTER_API_KEY (fallback)"
    exit 1
fi

echo "-> Environment check passed."
if [ "$HAS_PRIMARY" = "yes" ]; then
    echo "   Primary LLM : AcademicCloud ($(grep BASE_URL "$ENV_FILE" | cut -d= -f2))"
    echo "   Model        : qwen3.5-122b-a10b (Qwen 3.5 122B)"
fi
if [ "$HAS_FALLBACK" = "yes" ]; then
    echo "   Fallback LLM : OpenRouter"
fi
echo "   Retry policy : 3 attempts on primary, then fallback"

# ---------------------------------------------------------
# 2. Build and start Docker containers
# ---------------------------------------------------------
echo ""
echo "-> Ensuring data directory exists..."
mkdir -p backend/data

echo "-> Stopping existing containers..."
docker compose down 2>/dev/null || true

echo "-> Building and starting Docker containers..."
docker compose up -d --build

# Wait for containers to initialize
echo "-> Waiting for services to start..."
sleep 5

# Verify containers are running
if ! docker compose ps | grep -q "Up\|running"; then
    echo "ERROR: Docker containers failed to start."
    echo "Showing logs:"
    docker compose logs --tail=50
    exit 1
fi

echo "-> Docker containers are running."

# ---------------------------------------------------------
# 3. Start Ngrok tunnel (optional)
# ---------------------------------------------------------
if command -v ngrok &> /dev/null; then
    echo ""
    echo "-> Starting Ngrok tunnel in background..."

    # Kill any existing ngrok process
    pkill -f "ngrok http" 2>/dev/null || true
    sleep 1

    # Start ngrok in the background
    nohup ngrok http 5174 --log=stdout > "$LOG_FILE" 2>&1 &
    NGROK_PID=$!
    echo "-> Ngrok started with PID $NGROK_PID"

    # Wait for ngrok to initialize and fetch the public URL
    sleep 3

    NGROK_URL=""
    for i in $(seq 1 10); do
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
            | grep -o '"public_url":"[^"]*"' \
            | head -1 \
            | sed 's/"public_url":"//;s/"//')
        if [ -n "$NGROK_URL" ]; then
            break
        fi
        sleep 1
    done

    if [ -n "$NGROK_URL" ]; then
        echo ""
        echo "==================================================="
        echo " Deployment complete!"
        echo ""
        echo "   Local:  http://localhost:5174"
        echo "   Public: $NGROK_URL"
        echo ""
        echo "   LLM:    qwen3.5-122b-a10b (AcademicCloud)"
        echo "           3 retries -> OpenRouter fallback"
        echo "==================================================="
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Ngrok URL: $NGROK_URL" >> "$LOG_FILE"
    else
        echo ""
        echo "WARNING: Could not retrieve ngrok public URL."
        echo "Check ngrok status at http://localhost:4040 or inspect $LOG_FILE"
    fi

    echo "-> Ngrok running in background (PID: $NGROK_PID). Logs: $LOG_FILE"
else
    echo ""
    echo "==================================================="
    echo " Deployment complete!"
    echo ""
    echo "   Local:  http://localhost:5174"
    echo ""
    echo "   LLM:    qwen3.5-122b-a10b (AcademicCloud)"
    echo "           3 retries -> OpenRouter fallback"
    echo ""
    echo "   NOTE: ngrok not installed. Install it for public access:"
    echo "         curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc \\"
    echo "           | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null"
    echo "         echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' \\"
    echo "           | sudo tee /etc/apt/sources.list.d/ngrok.list"
    echo "         sudo apt update && sudo apt install ngrok"
    echo "==================================================="
fi
