FROM python:3.9-slim

WORKDIR /github/workspace

COPY startrack/ startrack/
COPY startrack/app.py .
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

ENTRYPOINT ["python", "app.py"]