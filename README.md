# ArXiv Newsletter & AI Research Assistant

This is a full-stack web application that automatically fetches the latest research papers from ArXiv based on configurable categories, presents them in a beautiful, premium, glassmorphic UI, and allows you to chat with the papers using an OpenRouter-powered LLM.

## Features
- **Automated Fetching:** Runs a background cron job using APScheduler to pull the latest papers from ArXiv on a weekly schedule.
- **Full-Text Context:** Downloads the paper PDFs and extracts their full text using PyMuPDF to store in a local SQLite database.
- **AI Chat Integration:** A split-view interface allows you to read the PDF and ask questions to an OpenRouter AI model, seamlessly injecting the paper's text into the LLM context.
- **Research Overview:** Generate AI-powered research summaries across all fetched papers, with optional chat follow-up for deeper analysis.
- **Filtering & Search:** Filter papers by date range, category, author, and free-text search. All filters also apply to the AI overview generation.
- **Premium Design:** A heavily styled, modern React interface featuring responsive glassmorphism, the elegant Outfit font, and dynamic search/filtering.

## Directory Structure
- `/backend` — Python FastAPI application, database models, background scheduler, and text extraction logic.
- `/frontend` — Vite + React application with the user interface and chat components.
- `/deploy.sh` — Automated deployment script for Docker + ngrok on a Raspberry Pi (or any Linux server).
- `/docker-compose.yml` — Docker Compose orchestration for backend and frontend containers.

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

---

## Background Cron Job (APScheduler)

The backend uses **APScheduler** (`BackgroundScheduler`) to automatically fetch new papers from ArXiv. The scheduler is configured in `backend/main.py` inside the FastAPI `lifespan` context:

| Trigger | Schedule | Description |
|---|---|---|
| **Initial fetch** | 5 seconds after startup | Populates the database with the latest papers immediately after the server starts. |
| **Recurring fetch** | Every 7 days (weekly) | Continuously fetches new papers on a weekly interval for as long as the server is running. |

### How it works
1. On startup, the scheduler fires `fetch_job()` after a 5-second delay.
2. `fetch_job()` opens a database session and calls `fetch_and_store_latest_papers()`, which iterates through all configured ArXiv categories, downloads PDFs, extracts full text via PyMuPDF, and stores everything in SQLite.
3. The weekly interval job keeps the database up-to-date automatically — no external cron needed.

### Configurable categories
The ArXiv categories to monitor are defined in `backend/config.py`:
```python
arxiv_categories: List[str] = [
    "cs.*",     # All Computer Science subcategories
    "stat.*",   # All Statistics subcategories
    "q-bio.*",  # All Quantitative Biology subcategories
    "cs.AI",    # Artificial Intelligence (specific)
    "cs.LG"     # Machine Learning (specific)
]
max_papers_per_fetch: int = 50
```
You can modify these values directly in `config.py` or override them via environment variables.

---

## Raspberry Pi / Docker Deployment (Production)

The project includes Dockerfiles, an Nginx reverse proxy, and a `docker-compose.yml` file for easy deployment on edge devices like a Raspberry Pi.

### Prerequisites
- **Docker** and **Docker Compose** installed on your device.
- **ngrok** installed and authenticated (`ngrok config add-authtoken YOUR_TOKEN`) if you want a public URL.
- A `backend/.env` file with your `OPENROUTER_API_KEY`.

### Running the deployment
```bash
chmod +x deploy.sh
./deploy.sh
```

### What `deploy.sh` does
1. **Validates** that `OPENROUTER_API_KEY` is present in `backend/.env`.
2. **Builds and starts** the Docker containers in detached mode (`docker compose up -d --build`).
3. **Verifies** that all containers are healthy.
4. **Starts ngrok** in the background using `nohup`, so the script exits immediately and ngrok keeps running.
5. **Polls the ngrok local API** (`http://localhost:4040/api/tunnels`) to retrieve the public URL.
6. **Prints** both the local (`http://localhost:5174`) and public ngrok URL to the terminal.
7. **Logs** all ngrok output to `ngrok.log` in the project root.

After running the script, you'll see output like:
```
===================================================
 Deployment complete!
 Local:  http://localhost:5174
 Public: https://abcd-1234.ngrok-free.app
===================================================
-> Ngrok is running in the background (PID: 12345). Logs: ngrok.log
```

### Architecture
```
Internet
   │
   ▼
 ngrok (port 5174)
   │
   ▼
 Nginx (frontend container, port 80 → host 5174)
   ├── Static React build (/)
   └── Reverse proxy (/api/* → backend:8080)
         │
         ▼
   FastAPI backend (port 8080, internal only)
   ├── APScheduler cron job (weekly ArXiv fetch)
   └── SQLite database (./backend/data/)
```

### Managing the deployment
| Action | Command |
|---|---|
| View running containers | `docker compose ps` |
| View backend logs | `docker compose logs -f backend` |
| View frontend/nginx logs | `docker compose logs -f frontend` |
| Stop all containers | `docker compose down` |
| Restart containers | `docker compose restart` |
| Check ngrok URL | `curl -s http://localhost:4040/api/tunnels` |
| View ngrok log | `cat ngrok.log` |
| Stop ngrok | `pkill -f "ngrok http"` |

### Persistent data
The SQLite database is stored at `./backend/data/arxiv_newsletter.db` via a Docker volume mount, so your data survives container restarts and rebuilds.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | — | API key for OpenRouter LLM access (chat & overview) |
| `DATABASE_URL` | ❌ | `sqlite:///./arxiv_newsletter.db` | Database connection string |
