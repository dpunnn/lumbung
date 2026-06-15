"""Router /detect — deteksi & hitung ternak via YOLOv8.

Inferensi dijalankan di thread executor agar tidak memblok event loop FastAPI
(ultralytics predict bersifat CPU/GPU-bound dan sinkron).
"""

import asyncio
import io

from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image

from main import model_ref

router = APIRouter()

# Kelas COCO yang relevan sebagai "ternak" / hewan ternak desa.
TERNAK_CLASSES = {"cow", "sheep", "goat", "horse", "bird", "cat", "dog"}


@router.post("")
async def detect_ternak(file: UploadFile = File(...)):
    """Terima foto ternak, jalankan YOLOv8, kembalikan count + bounding boxes."""
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")

        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: model_ref["yolo"].predict(img, conf=0.4, verbose=False),
        )

        detections = []
        for r in results:
            for box in r.boxes:
                label = r.names[int(box.cls)]
                if label in TERNAK_CLASSES:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    detections.append({
                        "label": label,
                        "confidence": float(box.conf),
                        "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                    })

        return {"count": len(detections), "detections": detections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
