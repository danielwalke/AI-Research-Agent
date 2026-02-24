#!/bin/bash

# ArXiv Newsletter & AI Assistant - Raspberry Pi Deployment Script
# This script builds the docker containers and exposes the frontend via ngrok.
# Ngrok runs entirely in the background and logs the public URL to ngrok.log.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/ngrok.log"

echo "==================================================="
echo " Deploying ArXiv Newsletter on Raspberry Pi..."
echo "==================================================="

# 1. Check for OPENROUTER_API_KEY in backend/.env
if ! grep -q "OPENROUTER_API_KEY" backend/.env; then
    echo "ERROR: OPENROUTER_API_KEY not found in backend/.env"
    echo "Please add your API key before deploying."
    exit 1
fi

# 2. Build and start the docker containers in detached mode
echo "-> Building and starting Docker containers..."
mkdir -p backend/data
docker compose up -d --build

# Wait a few seconds for containers to initialize
sleep 5

# 3. Check if containers are running
if ! docker compose ps | grep -q "Up"; then
    echo "ERROR: Docker containers failed to start."
    docker compose logs
    exit 1
fi
echo "-> Docker containers are running locally on port 5174."

# 4. Start ngrok tunnel in the background
echo "-> Starting Ngrok tunnel in background..."
if command -v ngrok &> /dev/null; then
    # Kill any existing ngrok process
    pkill -f "ngrok http" 2>/dev/null || true
    sleep 1

    # Start ngrok in the background, suppress output
    nohup ngrok http 5174 --log=stdout > "$LOG_FILE" 2>&1 &
    NGROK_PID=$!

    echo "-> Ngrok started with PID $NGROK_PID"

    # Wait for ngrok to initialize and fetch the public URL from its local API
    sleep 3

    NGROK_URL=""
    for i in $(seq 1 10); do
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | sed 's/"public_url":"//;s/"//')
        if [ -n "$NGROK_URL" ]; then
            break
        fi
        sleep 1
    done

    if [ -n "$NGROK_URL" ]; then
        echo "==================================================="
        echo " Deployment complete!"
        echo " Local:  http://localhost:5174"
        echo " Public: $NGROK_URL"
        echo "==================================================="
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Ngrok URL: $NGROK_URL" >> "$LOG_FILE"
    else
        echo "WARNING: Could not retrieve ngrok public URL."
        echo "Check ngrok status at http://localhost:4040 or inspect $LOG_FILE"
    fi

    echo "-> Ngrok is running in the background (PID: $NGROK_PID). Logs: $LOG_FILE"
else
    echo "WARNING: ngrok is not installed or not in PATH."
    echo "The application is running locally at http://localhost:5174"
    echo "To expose it, please install ngrok and run: ngrok http 5174"
fi
