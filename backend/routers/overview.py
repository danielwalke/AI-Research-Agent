"""
Overview Router — /api/overview
Generates a coherent markdown narrative summarizing filtered papers,
and provides a chat interface to discuss the overview.
"""
import asyncio
import json
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from openai import AsyncOpenAI

from database import get_db
from config import settings
from services.overview_service import generate_overview

router = APIRouter()

# Shared OpenRouter client
client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)


class OverviewRequest(BaseModel):
    start_date: str  # ISO format: YYYY-MM-DD
    end_date: Optional[str] = None  # defaults to today
    search: Optional[str] = None
    category: Optional[str] = None


class OverviewResponse(BaseModel):
    markdown: str
    paper_count: int
    cluster_count: int


class Message(BaseModel):
    role: str
    content: str


class OverviewChatRequest(BaseModel):
    overview_markdown: str
    messages: List[Message]
    model: str = "google/gemini-2.0-flash-001"


class OverviewChatResponse(BaseModel):
    reply: str


@router.post("/generate")
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

    async def event_generator():
        task = asyncio.create_task(
            generate_overview(
                db, start_dt, end_dt,
                search=request.search,
                category=request.category,
            )
        )
        # Yield initial status immediately
        yield f"data: {json.dumps({'status': 'processing'})}\n\n"
        
        while not task.done():
            try:
                # wait_for throws TimeoutError if timeout expires
                await asyncio.wait_for(asyncio.shield(task), timeout=10.0)
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'status': 'processing'})}\n\n"
            except Exception:
                # If inner task fails, task.done() becomes True, loop exits
                pass
        
        try:
            result = task.result()
            yield f"data: {json.dumps({'status': 'complete', 'result': result})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/chat", response_model=OverviewChatResponse)
async def chat_with_overview(request: OverviewChatRequest):
    """Chat with the generated overview narrative. The overview markdown
    is passed as context so the LLM can answer questions about it."""
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=500, detail="OpenRouter API key not configured"
        )

    system_prompt = (
        "You are a helpful AI research assistant. The user has generated a research "
        "overview narrative and wants to discuss it with you.\n\n"
        "Here is the full research overview:\n\n"
        f"{request.overview_markdown}\n\n"
        "Answer questions based on this overview. You can:\n"
        "- Explain specific papers or themes in more detail\n"
        "- Compare different approaches mentioned in the overview\n"
        "- Suggest research directions based on the trends\n"
        "- Provide additional context or connections\n"
        "- Summarize specific sections\n"
        "Be concise but thorough. Use markdown formatting."
    )

    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        api_messages.append({"role": msg.role, "content": msg.content})

    try:
        completion = await client.chat.completions.create(
            model=request.model,
            messages=api_messages,
            timeout=60,
        )
        reply = completion.choices[0].message.content
        return OverviewChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
