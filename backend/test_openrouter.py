import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")

if not API_KEY:
    print("FAILED: No API key found in .env")
    exit(1)

response = requests.get(
    url="https://openrouter.ai/api/v1/models",
    headers={
        "Authorization": f"Bearer {API_KEY}",
    },
)

if response.status_code == 200:
    print("SUCCESS: API key is valid.")
    data = response.json()
    models = data.get("data", [])
    
    # Let's find free models with large context windows
    free_models = [m for m in models if "free" in m.get("id", "").lower()]
    
    # Also find gemini pro models which typically have huge context
    gemini_models = [m for m in models if "gemini" in m.get("id", "").lower()]
    
    print("\n--- Top High Context Models ---")
    
    # Sort models by context length
    sorted_models = sorted(models, key=lambda x: x.get("context_length", 0), reverse=True)
    
    for m in sorted_models[:5]:
        print(f"Model: {m['id']} | Context Length: {m.get('context_length')}")
        
    print("\n--- Top FREE Models by Context Length ---")
    sorted_free_models = sorted(free_models, key=lambda x: x.get("context_length", 0), reverse=True)
    for m in sorted_free_models[:5]:
        print(f"Model: {m['id']} | Context Length: {m.get('context_length')}")
        
else:
    print(f"FAILED: API request failed with status code {response.status_code}")
    print(response.text)
