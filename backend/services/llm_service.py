"""
Centralized LLM Service

Primary:  OpenAI-compatible API (AcademicCloud) – 3 retries
Fallback: OpenRouter (free tier)

Every module should call `call_llm()` or `stream_llm()` instead of
constructing its own clients.
"""
import asyncio
import logging
from typing import List, Dict, Optional, AsyncIterator

from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client singletons (created lazily on first use)
# ---------------------------------------------------------------------------
_primary_client: Optional[AsyncOpenAI] = None
_fallback_client: Optional[AsyncOpenAI] = None

PRIMARY_MAX_RETRIES = 3
PRIMARY_RETRY_DELAY = 2  # seconds between retries


def _get_primary_client() -> Optional[AsyncOpenAI]:
    """Return the primary (AcademicCloud) client, or None if not configured."""
    global _primary_client
    if _primary_client is not None:
        return _primary_client
    if settings.openai_api_key and settings.openai_base_url:
        _primary_client = AsyncOpenAI(
            base_url=settings.openai_base_url.rstrip("/"),
            api_key=settings.openai_api_key,
        )
        logger.info(f"Primary LLM client configured: {settings.openai_base_url}")
        return _primary_client
    return None


def _get_fallback_client() -> AsyncOpenAI:
    """Return the OpenRouter fallback client."""
    global _fallback_client
    if _fallback_client is None:
        _fallback_client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
        logger.info("Fallback LLM client configured: OpenRouter")
    return _fallback_client


# ---------------------------------------------------------------------------
# Non-streaming call  (overview, podcast, overview-chat, paper-summarize)
# ---------------------------------------------------------------------------

async def call_llm(
    messages: List[Dict[str, str]],
    timeout: int = 120,
    fallback_model: Optional[str] = None,
) -> str:
    """
    Call the LLM with automatic retry + fallback.

    1. Try the primary API up to PRIMARY_MAX_RETRIES times.
    2. If all retries fail (or primary not configured), fall back to OpenRouter.

    Args:
        messages:       Standard OpenAI chat messages list.
        timeout:        Per-request timeout in seconds.
        fallback_model: Model ID to use on OpenRouter fallback.
                        Defaults to settings.overview_model.

    Returns:
        The assistant's response text.
    """
    fb_model = fallback_model or settings.overview_model
    primary = _get_primary_client()

    # ---- Primary with retries ----
    if primary:
        last_err = None
        for attempt in range(1, PRIMARY_MAX_RETRIES + 1):
            try:
                logger.info(
                    f"[LLM] Primary attempt {attempt}/{PRIMARY_MAX_RETRIES} "
                    f"model={settings.openai_model}"
                )
                completion = await primary.chat.completions.create(
                    model=settings.openai_model,
                    messages=messages,
                    timeout=timeout,
                )
                logger.info("[LLM] Primary succeeded")
                return completion.choices[0].message.content
            except Exception as e:
                last_err = e
                logger.warning(
                    f"[LLM] Primary attempt {attempt} failed: {e}"
                )
                if attempt < PRIMARY_MAX_RETRIES:
                    await asyncio.sleep(PRIMARY_RETRY_DELAY)
        logger.error(
            f"[LLM] All {PRIMARY_MAX_RETRIES} primary attempts failed. "
            f"Last error: {last_err}. Falling back to OpenRouter..."
        )

    # ---- Fallback ----
    fallback = _get_fallback_client()
    logger.info(f"[LLM] Fallback call: model={fb_model}")
    completion = await fallback.chat.completions.create(
        model=fb_model,
        messages=messages,
        timeout=timeout,
    )
    logger.info("[LLM] Fallback succeeded")
    return completion.choices[0].message.content


# ---------------------------------------------------------------------------
# Streaming call  (chat with paper)
# ---------------------------------------------------------------------------

async def stream_llm(
    messages: List[Dict[str, str]],
    timeout: int = 120,
    fallback_model: str = "openrouter/auto",
) -> AsyncIterator:
    """
    Stream the LLM response with retry + fallback.

    Returns an async iterator of chat completion chunks.
    """
    primary = _get_primary_client()

    # ---- Primary with retries ----
    if primary:
        last_err = None
        for attempt in range(1, PRIMARY_MAX_RETRIES + 1):
            try:
                logger.info(
                    f"[LLM-stream] Primary attempt {attempt}/{PRIMARY_MAX_RETRIES} "
                    f"model={settings.openai_model}"
                )
                stream = await primary.chat.completions.create(
                    model=settings.openai_model,
                    messages=messages,
                    stream=True,
                    timeout=timeout,
                )
                # Yield the first chunk to verify it works, then yield rest
                return stream
            except Exception as e:
                last_err = e
                logger.warning(
                    f"[LLM-stream] Primary attempt {attempt} failed: {e}"
                )
                if attempt < PRIMARY_MAX_RETRIES:
                    await asyncio.sleep(PRIMARY_RETRY_DELAY)
        logger.error(
            f"[LLM-stream] All {PRIMARY_MAX_RETRIES} primary attempts failed. "
            f"Last error: {last_err}. Falling back to OpenRouter..."
        )

    # ---- Fallback ----
    fallback = _get_fallback_client()
    logger.info(f"[LLM-stream] Fallback call: model={fallback_model}")
    stream = await fallback.chat.completions.create(
        model=fallback_model,
        messages=messages,
        stream=True,
        timeout=timeout,
    )
    return stream
