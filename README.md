# ArXiv Newsletter & AI Research Assistant

This is a full-stack web application that automatically fetches the latest research papers from ArXiv based on configurable categories, presents them in a beautiful, premium, glassmorphic UI, and allows you to chat with the papers using an OpenRouter-powered LLM.

## Features
- **Automated Fetching:** Runs a background job (cron) using APScheduler to pull the latest papers from ArXiv.
- **Full-Text Context:** Downloads the paper PDFs and extracts their full text using PyMuPDF to store in a local SQLite database.
- **AI Chat Integration:** A split-view interface allows you to read the PDF and ask questions to an OpenRouter AI model, seamlessly injecting the paper's text into the LLM context.
- **Premium Design:** A heavily styled, modern React interface featuring responsive glassmorphism, the elegant Outfit font, and dynamic search/filtering by category and author.

## Directory Structure
- `/backend`: The Python FastAPI application, database tracking, background scheduler, and text extraction logic.
- `/frontend`: The Vite+React application with the user interface and chat components.
- `/deploy.sh`: A helper bash script to automatically build, start, and tunnel the application on a Raspberry Pi using Docker and ngrok.

## Local Development Setup

### Backend
1. Navigate to the `backend` directory.
2. Create and activate a virtual environment: 
   - Windows: `python -m venv venv` and `.\venv\Scripts\Activate.ps1`
   - Mac/Linux: `python3 -m venv venv` and `source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`.
4. Create a `.env` file in the `backend` directory and add your key: `OPENROUTER_API_KEY=your_key_here`.
5. Run the server: `uvicorn main:app --port 8080 --reload`.

### Frontend
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`.
3. Run the development server: `npm run dev`.

## Raspberry Pi / Docker Deployment (Production)
The project includes Dockerfiles, an Nginx reverse proxy, and a `docker-compose.yml` file for easy deployment on edge devices like a Raspberry Pi.

1. Ensure Docker and Docker Compose are installed on your device.
2. Ensure you have `ngrok` installed if you wish to expose your Raspberry Pi to the internet.
3. Make sure you have created `backend/.env` with your `OPENROUTER_API_KEY`.
4. Make the script executable and run it:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
This script will build the Docker containers in detached mode, serve the frontend and backend on port `5174`, and automatically start an ngrok tunnel, providing you with a public URL to access the application from anywhere.
