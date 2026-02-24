from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from database import get_db
from models import Paper, Author, Category
from pydantic import BaseModel
from datetime import datetime

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

@router.get("/", response_model=List[PaperResponse])
def get_papers(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    author: Optional[str] = None
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
        
    papers = query.order_by(Paper.published_date.desc()).offset(skip).limit(limit).all()
    return papers

@router.get("/{paper_id}", response_model=PaperDetailResponse)
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper
