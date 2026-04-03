import asyncio
import logging
from datetime import datetime, timedelta
from database import SessionLocal
from services.overview_service import generate_overview

logging.basicConfig(level=logging.INFO)

async def test_overview():
    print("Testing generate_overview()...")
    db = SessionLocal()
    start_dt = datetime.utcnow() - timedelta(days=7)
    end_dt = datetime.utcnow() + timedelta(days=1)
    try:
        res = await generate_overview(db, start_dt, end_dt, category="cs.AI")
        print("Success! Number of clusters:", res["cluster_count"])
    except Exception as e:
        print("Crash:", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_overview())
