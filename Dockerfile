FROM python:3.9-slim

COPY startrack/ /startrack/
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
RUN rm -rf /root/.cache/pip

WORKDIR /startrack
ENTRYPOINT ["python", "/startrack/app.py"]