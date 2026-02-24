#!/bin/bash

# ArXiv Newsletter & AI Assistant - Raspberry Pi Deployment Script
# This script builds the docker containers and exposes the frontend via ngrok.

set -e

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

# 4. Start ngrok tunnel
echo "-> Starting Ngrok tunnel..."
if command -v ngrok &> /dev/null; then
    echo "Local address: http://localhost:5174"
    echo "Starting ngrok on port 5174..."
    # Start ngrok and keep it in the foreground so the user sees the output URL
    ngrok http 5174
else
    echo "WARNING: ngrok is not installed or not in PATH."
    echo "The application is running locally at http://localhost:5174"
    echo "To expose it, please install ngrok and run: ngrok http 5174"
fi
