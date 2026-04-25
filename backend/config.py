from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openai_api_key: str = Field(default="", alias="API_KEY")
    openai_base_url: str = Field(default="", alias="BASE_URL")
    openai_model: str = "qwen3.5-397b-a17b"
    database_url: str = "sqlite:///./arxiv_newsletter.db"
    arxiv_categories: List[str] = [
        "cs.*",     # Computer Science
        "stat.*",   # Statistics
        "q-bio.*",  # Quantitative Biology
        "cs.AI",
        "cs.LG"
    ]
    max_papers_per_fetch: int = 50
    overview_model: str = "google/gemini-2.0-flash-001"
    overview_context_window: int = 1000000  # fallback if API fetch fails
    overview_budget_ratio: float = 0.80

    class Config:
        env_file = ".env"
        extra = "ignore"
        populate_by_name = True

settings = Settings()

