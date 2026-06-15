FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY ai/requirements.txt .
# Install torch CPU-only dulu (jauh lebih kecil dari CUDA build ~230MB vs ~2GB)
RUN pip install --no-cache-dir --timeout=300 \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.4.1+cpu torchvision==0.19.1+cpu
# Install sisanya dari mirror Tsinghua
RUN pip install --no-cache-dir --timeout=300 \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn \
    fastapi==0.115.0 "uvicorn[standard]==0.30.6" \
    ultralytics==8.3.0 anthropic==0.34.0 \
    python-multipart==0.0.12 boto3==1.35.0 \
    Pillow==10.4.0 python-dotenv==1.0.1 httpx==0.27.2
COPY ai/ .
ENV YOLO_MODEL_PATH=yolov8n.pt
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
