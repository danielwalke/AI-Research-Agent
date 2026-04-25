"""
Overview Router — /api/overview
Generates a coherent markdown narrative summarizing filtered papers,
and provides a chat interface to discuss the overview.
Also generates podcast audio from the overview.
"""
import asyncio
import json
from pathlib import Path
from fastapi.responses import StreamingResponse, FileResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

from database import get_db
from config import settings
from services.overview_service import generate_overview
from services.podcast_service import generate_podcast, PODCAST_DIR
from services.llm_service import call_llm

router = APIRouter()


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


class PodcastRequest(BaseModel):
    overview_markdown: str


@router.post("/generate")
async def generate_research_overview(
    request: OverviewRequest,
    db: Session = Depends(get_db),
):
    if not settings.openrouter_api_key and not settings.openai_api_key:
        raise HTTPException(
            status_code=500, detail="No API key configured for LLM provider"
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
    if not settings.openrouter_api_key and not settings.openai_api_key:
        raise HTTPException(
            status_code=500, detail="No API key configured for LLM provider"
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
        reply = await call_llm(
            messages=api_messages,
            timeout=60,
            fallback_model=request.model,
        )
        return OverviewChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/podcast")
async def generate_podcast_audio(request: PodcastRequest):
    """Generate a podcast MP3 from the overview markdown using edge-tts.
    Streams SSE events with heartbeat to prevent timeouts."""
    if not settings.openrouter_api_key and not settings.openai_api_key:
        raise HTTPException(
            status_code=500, detail="No API key configured for LLM provider"
        )

    if not request.overview_markdown or len(request.overview_markdown.strip()) < 50:
        raise HTTPException(
            status_code=400, detail="Overview markdown is too short to generate a podcast"
        )

    async def event_generator():
        task = asyncio.create_task(
            generate_podcast(request.overview_markdown)
        )
        yield f"data: {json.dumps({'status': 'generating_script'})}\n\n"

        while not task.done():
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=10.0)
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'status': 'processing'})}\n\n"
            except Exception:
                pass

        try:
            result = task.result()
            yield f"data: {json.dumps({'status': 'complete', 'result': result})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/podcast/{filename}")
async def serve_podcast(filename: str):
    """Serve a generated podcast MP3 file."""
    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    filepath = PODCAST_DIR / safe_filename

    if not filepath.exists() or not filepath.suffix == ".mp3":
        raise HTTPException(status_code=404, detail="Podcast not found")

    return FileResponse(
        path=str(filepath),
        media_type="audio/mpeg",
        filename=safe_filename,
    )
