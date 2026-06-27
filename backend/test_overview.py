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
        print("\n--- Testing digest mode ---")
        res_digest = await generate_overview(db, start_dt, end_dt, category="cs.AI", mode="digest")
        print("Success! Number of clusters:", res_digest["cluster_count"])
        print("Number of papers:", len(res_digest.get("papers", [])))
        if len(res_digest.get("papers", [])) > 0:
            print("First paper sample:", res_digest["papers"][0])

        print("\n--- Testing trends mode ---")
        res_trends = await generate_overview(db, start_dt, end_dt, category="cs.AI", mode="trends")
        print("Success! Number of clusters:", res_trends["cluster_count"])
        print("Number of papers:", len(res_trends.get("papers", [])))
        if len(res_trends.get("papers", [])) > 0:
            print("First paper sample:", res_trends["papers"][0])
    except Exception as e:
        print("Crash:", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_overview())
