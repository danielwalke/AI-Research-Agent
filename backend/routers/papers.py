from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from database import get_db, SessionLocal
from models import Paper, Author, Category
from pydantic import BaseModel
from datetime import datetime, timedelta
from services.arxiv_service import fetch_papers_for_range
import asyncio
import json

router = APIRouter()

class AuthorResponse(BaseModel):
    name: str
    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    name: str
    class Config:
        from_attributes = True

class PaperResponse(BaseModel):
    id: str
    title: str
    abstract: str
    published_date: datetime
    pdf_url: Optional[str]
    entry_id: str
    authors: List[AuthorResponse]
    categories: List[CategoryResponse]
    class Config:
        from_attributes = True

class PaperDetailResponse(PaperResponse):
    full_text: Optional[str]

class FetchRangeRequest(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    category: Optional[str] = None

@router.get("/", response_model=List[PaperResponse])
def get_papers(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    author: Optional[str] = None,
    days: Optional[int] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = db.query(Paper)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Paper.title.ilike(search_term),
                Paper.abstract.ilike(search_term),
                Paper.full_text.ilike(search_term)
            )
        )
    
    if category:
        query = query.filter(Paper.categories.any(Category.name == category))
        
    if author:
        query = query.filter(Paper.authors.any(Author.name.ilike(f"%{author}%")))
        
    if days is not None:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Paper.published_date >= cutoff)
        
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.combine(target_date, datetime.min.time())
            end_dt = start_dt + timedelta(days=1)
            query = query.filter(Paper.published_date >= start_dt, Paper.published_date < end_dt)
        except ValueError:
            pass
            
    if start_date:
        try:
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Paper.published_date >= s_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            e_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Paper.published_date < e_dt)
        except ValueError:
            pass
        
    papers = query.order_by(Paper.published_date.desc()).offset(skip).limit(limit).all()
    return papers

@router.get("/{paper_id}", response_model=PaperDetailResponse)
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.post("/fetch-range")
async def fetch_range(request: FetchRangeRequest):
    """
    Fetch papers from ArXiv for a specific date range.
    Streams SSE heartbeats to keep the connection alive.
    """
    try:
        start_dt = datetime.strptime(request.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date format, use YYYY-MM-DD")

    try:
        end_dt = datetime.strptime(request.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid end_date format, use YYYY-MM-DD")

    async def event_generator():
        loop = asyncio.get_event_loop()

        # Run the sync fetch in a thread to avoid blocking
        db = SessionLocal()
        try:
            task = loop.run_in_executor(
                None,
                fetch_papers_for_range,
                db, start_dt, end_dt, request.category,
            )

            yield f"data: {json.dumps({'status': 'processing', 'message': 'Starting ArXiv fetch...'})}\n\n"

            while not task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(task), timeout=10.0)
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'status': 'processing', 'message': 'Still fetching papers from ArXiv...'})}\n\n"
                except Exception:
                    pass

            try:
                new_count = task.result()
                yield f"data: {json.dumps({'status': 'complete', 'new_papers': new_count})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'status': 'error', 'detail': str(e)})}\n\n"
        finally:
            db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
