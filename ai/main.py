"""ai-svc — layanan AI hero "Saksi AI" LUMBUNG.

Tiga kapabilitas:
  - /detect        : deteksi & hitung ternak via YOLOv8 (COCO).
  - /analyze-mutu  : penilaian mutu/BCS komoditas via Claude Vision.
  - /lens          : narasi analitik adaptif kondisi koperasi via Claude.

Model YOLO dimuat sekali saat startup (lifespan) dan disimpan di model_ref
agar router dapat memakainya tanpa memuat ulang per-request.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from ultralytics import YOLO
import os

# Registry global model — diisi saat startup, dibaca oleh router detect.
model_ref = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load YOLO model sekali saat startup.
    model_path = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    model_ref["yolo"] = YOLO(model_path)
    yield
    model_ref.clear()


app = FastAPI(title="LUMBUNG ai-svc", lifespan=lifespan)

from routers import detect, mutu, lens

app.include_router(detect.router, prefix="/detect", tags=["detect"])
app.include_router(mutu.router, prefix="/analyze-mutu", tags=["mutu"])
app.include_router(lens.router, prefix="/lens", tags=["lens"])


@app.get("/health/live")
def health_live():
    return {"status": "live"}
