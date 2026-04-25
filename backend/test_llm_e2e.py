"""
End-to-end test for the LLM service.
Tests AcademicCloud primary API with 3 retries and OpenRouter fallback.
Run:  python test_llm_e2e.py
"""
import asyncio
import sys
import os

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Ensure we can import from the backend directory
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(".env")


async def test_primary_api():
    """Test AcademicCloud API directly."""
    from openai import AsyncOpenAI
    from config import settings

    print("=" * 60)
    print("TEST 1: Direct AcademicCloud API call")
    print(f"  Base URL : {settings.openai_base_url}")
    print(f"  API Key  : {settings.openai_api_key[:8]}...")
    print(f"  Model    : {settings.openai_model}")
    print("=" * 60)

    client = AsyncOpenAI(
        base_url=settings.openai_base_url.rstrip("/"),
        api_key=settings.openai_api_key,
    )

    try:
        # List models
        print("\n--- Listing available models ---")
        models = await client.models.list()
        for m in models.data:
            print(f"  {m.id} ({getattr(m, 'name', 'N/A')})")

        # Test completion
        print(f"\n--- Testing chat completion with {settings.openai_model} ---")
        completion = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Summarize in 2 sentences what machine learning is."},
            ],
            timeout=60,
        )
        response = completion.choices[0].message.content
        print(f"  Response: {response[:300]}")
        print("\n  ✅ AcademicCloud API works!")
        return True
    except Exception as e:
        print(f"\n  ❌ AcademicCloud API failed: {e}")
        return False


async def test_centralized_llm_service():
    """Test the centralized llm_service with retry + fallback."""
    from services.llm_service import call_llm

    print("\n" + "=" * 60)
    print("TEST 2: Centralized LLM service (3 retries + fallback)")
    print("=" * 60)

    try:
        result = await call_llm(
            messages=[
                {"role": "system", "content": "You are a research paper expert."},
                {"role": "user", "content": "What are the key contributions of the Transformer architecture paper 'Attention is All You Need'? Answer in 3 bullet points."},
            ],
            timeout=120,
        )
        print(f"  Response: {result[:500]}")
        print("\n  ✅ Centralized LLM service works!")
        return True
    except Exception as e:
        print(f"\n  ❌ Centralized LLM service failed: {e}")
        return False


async def test_streaming():
    """Test streaming via the centralized service."""
    from services.llm_service import stream_llm

    print("\n" + "=" * 60)
    print("TEST 3: Streaming LLM response")
    print("=" * 60)

    try:
        stream = await stream_llm(
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say hello in exactly 10 words."},
            ],
            timeout=60,
        )
        print("  Streamed: ", end="")
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content, end="", flush=True)
        print("\n\n  OK - Streaming works!")
        return True
    except Exception as e:
        print(f"\n  FAIL - Streaming failed: {e}")
        return False


async def main():
    print("\n[TEST] ArXiv Newsletter - LLM Service End-to-End Test\n")

    r1 = await test_primary_api()
    r2 = await test_centralized_llm_service()
    r3 = await test_streaming()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Direct API        : {'✅' if r1 else '❌'}")
    print(f"  Centralized call  : {'✅' if r2 else '❌'}")
    print(f"  Streaming         : {'✅' if r3 else '❌'}")

    if all([r1, r2, r3]):
        print("\n[OK] All tests passed!")
        return 0
    else:
        print("\n[WARN] Some tests failed. Check output above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
