#!/bin/bash

# Simple Start Script for Raspberry Pi

echo "==================================================="
echo " Starting ArXiv Newsletter App..."
echo "==================================================="

# Ensure we are in the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure data directory exists
mkdir -p backend/data

# Stop existing containers if running
docker compose down

# Build and start the docker containers in detached mode
echo "-> Building and starting Docker containers..."
docker compose up -d --build

echo "==================================================="
echo " Application is running!"
echo " Frontend available at: http://localhost:5174"
echo " Backend API available at: http://localhost:5174/api"
echo "==================================================="
