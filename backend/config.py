import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    database_url: str = "sqlite:///./arxiv_newsletter.db"
    arxiv_categories: List[str] = [
        "cs.*", # Computer Science
        "stat.*", # Statistics
        "q-bio.*", # Quantitative Biology
        "cs.AI",
        "cs.LG"
    ]
    max_papers_per_fetch: int = 50

    class Config:
        env_file = ".env"

settings = Settings()
