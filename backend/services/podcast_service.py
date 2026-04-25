"""
Podcast Service — converts overview markdown into an audio podcast.

Two-step pipeline:
1. LLM converts markdown narrative → conversational podcast script
2. edge-tts synthesizes the script → MP3 audio
"""
import logging
import os
import uuid
from pathlib import Path

import edge_tts

from services.llm_service import call_llm

logger = logging.getLogger(__name__)

# Directory for generated podcast files
PODCAST_DIR = Path(__file__).parent.parent / "podcasts"
PODCAST_DIR.mkdir(exist_ok=True)

# Default voice — natural English male narrator
DEFAULT_VOICE = "en-US-GuyNeural"

SCRIPT_SYSTEM_PROMPT = """You are a professional podcast host who narrates research digests.
Convert the following research overview into a natural, engaging podcast script.

Guidelines:
- Write as a single narrator monologue suitable for text-to-speech.
- Use a warm, conversational tone — imagine you're explaining to a curious colleague.
- Start with a brief intro ("Welcome to today's research digest...").
- Cover the key themes and highlight the most impactful papers.
- Use natural transitions between topics ("Now, shifting gears to...", "Interestingly...").
- End with a brief wrap-up.
- Do NOT include any markdown formatting, bullet points, or special characters.
- Do NOT include stage directions or speaker labels.
- Keep it concise — aim for a 3-5 minute podcast (roughly 500-800 words).
- Write plain text only — this will be read aloud by a text-to-speech engine.
"""


async def generate_podcast_script(markdown: str) -> str:
    """Use the LLM to convert an overview markdown into a podcast script."""
    messages = [
        {"role": "system", "content": SCRIPT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Here is the research overview to convert into a podcast script:\n\n"
                f"{markdown}"
            ),
        },
    ]

    script = await call_llm(messages=messages, timeout=120)
    logger.info(f"Generated podcast script: {len(script)} chars")
    return script


async def generate_podcast_audio(
    script: str,
    voice: str = DEFAULT_VOICE,
) -> str:
    """
    Synthesize a podcast script into an MP3 file using edge-tts.
    Returns the filename of the generated audio.
    """
    filename = f"podcast_{uuid.uuid4().hex[:12]}.mp3"
    filepath = PODCAST_DIR / filename

    try:
        communicate = edge_tts.Communicate(script, voice)
        await communicate.save(str(filepath))
        file_size = os.path.getsize(filepath)
        logger.info(f"Generated podcast audio: {filename} ({file_size} bytes)")
        return filename
    except Exception as e:
        logger.error(f"Failed to generate podcast audio: {e}")
        # Clean up partial file if it exists
        if filepath.exists():
            filepath.unlink()
        raise


async def generate_podcast(markdown: str, voice: str = DEFAULT_VOICE) -> dict:
    """
    Full podcast pipeline: markdown → script → audio.
    Returns dict with filename and script.
    """
    script = await generate_podcast_script(markdown)
    filename = await generate_podcast_audio(script, voice)
    return {
        "filename": filename,
        "script": script,
        "audio_url": f"/api/overview/podcast/{filename}",
    }
