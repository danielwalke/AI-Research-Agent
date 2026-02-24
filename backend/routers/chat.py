from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI
from database import get_db
from models import Paper
from config import settings

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    paper_id: str
    messages: List[Message]
    model: str = "openrouter/auto" # Default auto routing

class ChatResponse(BaseModel):
    reply: str

# Initialize OpenAI client for OpenRouter
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)

@router.post("/", response_model=ChatResponse)
async def chat_with_paper(request: ChatRequest, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == request.paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
        
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

    # Construct messages with system prompt containing paper text
    system_prompt = f"You are a helpful AI assistant analyzing a research paper.\n\nTitle: {paper.title}\nAbstract: {paper.abstract}\n\nFull Text Snippet:\n{paper.full_text[:30000] if paper.full_text else 'No full text available'}"
    
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        api_messages.append({"role": msg.role, "content": msg.content})
        
    try:
        completion = await client.chat.completions.create(
            model=request.model,
            messages=api_messages,
            timeout=60
        )
        reply = completion.choices[0].message.content
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
