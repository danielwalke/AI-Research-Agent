"""
Overview Router — /api/overview
Generates a coherent markdown narrative summarizing papers in a date range.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from database import get_db
from config import settings
from services.overview_service import generate_overview

router = APIRouter()


class OverviewRequest(BaseModel):
    start_date: str  # ISO format: YYYY-MM-DD
    end_date: Optional[str] = None  # defaults to today


class OverviewResponse(BaseModel):
    markdown: str
    paper_count: int
    cluster_count: int


@router.post("/generate", response_model=OverviewResponse)
async def generate_research_overview(
    request: OverviewRequest,
    db: Session = Depends(get_db),
):
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=500, detail="OpenRouter API key not configured"
        )

    try:
        start_dt = datetime.strptime(request.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid start_date format, use YYYY-MM-DD"
        )

    if request.end_date:
        try:
            end_dt = datetime.strptime(request.end_date, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid end_date format, use YYYY-MM-DD"
            )
    else:
        end_dt = datetime.utcnow() + timedelta(days=1)

    try:
        result = await generate_overview(db, start_dt, end_dt)
        return OverviewResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Overview generation failed: {e}")
