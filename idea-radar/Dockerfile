FROM python:3.10-slim

WORKDIR /app

COPY idea-radar-system/idea-radar/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY idea-radar-system/idea-radar ./

ENV FLASK_APP=src.api
ENV FLASK_ENV=production

EXPOSE 8000

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8000"]


