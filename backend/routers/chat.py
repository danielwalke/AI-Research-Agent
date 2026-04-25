from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models import Paper
from config import settings
from services.llm_service import stream_llm
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    paper_id: str
    messages: List[Message]
    model: str = "openrouter/auto" # Default auto routing

@router.post("/")
async def chat_with_paper(request: ChatRequest, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == request.paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
        
    if not settings.openrouter_api_key and not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="No API key configured for LLM provider")

    # Construct messages with system prompt containing paper text
    system_prompt = f"You are a helpful AI assistant analyzing a research paper.\n\nTitle: {paper.title}\nAbstract: {paper.abstract}\n\nFull Text Snippet:\n{paper.full_text[:15000] if paper.full_text else 'No full text available'}"
    
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        api_messages.append({"role": msg.role, "content": msg.content})

    async def generate_chat_stream():
        try:
            stream = await stream_llm(
                messages=api_messages,
                timeout=120,
                fallback_model=request.model,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield f"data: {json.dumps({'text': chunk.choices[0].delta.content})}\n\n"
        except Exception as e:
            logger.error(f"Chat stream failed: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate_chat_stream(), media_type="text/event-stream")
