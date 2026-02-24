import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
import datetime

from database import engine, Base, SessionLocal
from services.arxiv_service import fetch_and_store_latest_papers
from routers import papers, chat, overview

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

def fetch_job():
    logger.info("Starting background arxiv fetch job...")
    db = SessionLocal()
    try:
        fetch_and_store_latest_papers(db)
    finally:
        db.close()
    logger.info("Finished background arxiv fetch job.")

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run fetch job somewhat soon after startup to populate initially
    from datetime import datetime, timedelta
    scheduler.add_job(fetch_job, trigger='date', run_date=datetime.now() + timedelta(seconds=5))
    
    # And run it weekly
    scheduler.add_job(fetch_job, trigger='interval', weeks=1)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="ArXiv Newsletter API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(overview.router, prefix="/api/overview", tags=["overview"])

@app.get("/")
def root():
    return {"message": "ArXiv Newsletter API is running"}
