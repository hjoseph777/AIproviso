FROM python:3.12-slim

WORKDIR /app

# Install only what is needed for the stub (Phase I).
# Week 3-4: uncomment PaddleOCR + DocTR lines below.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .

# The worker is a long-running process — no web server
CMD ["python", "-u", "worker.py"]
