FROM python:3.12-slim-bookworm

# LibreOffice converts the presentations, poppler renders the slides.
# Carlito/Caladea/Liberation stand in for Calibri/Cambria/Arial/Times so layouts stay intact.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-impress poppler-utils \
        fonts-liberation2 fonts-dejavu fonts-crosextra-carlito fonts-crosextra-caladea \
        fonts-noto-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ .

RUN useradd --uid 1000 --create-home app && mkdir /data && chown app:app /data
USER app
ENV DATA_DIR=/data HOME=/home/app PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000

# A single worker process: the conversion queue lives in it.
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "8", "--timeout", "600", "app:app"]
