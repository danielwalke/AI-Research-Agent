FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for pymupdf/fitz if necessary
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Create a requirements.txt on the fly or copy it
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run uvicorn on port 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
