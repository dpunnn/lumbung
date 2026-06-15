"""Router /analyze-mutu — penilaian mutu/BCS komoditas via Claude Vision.

Mengembalikan JSON terstruktur {skor, kondisi, keterangan, rekomendasi}.
Bila Claude gagal/timeout/API key kosong, mengembalikan fallback netral
agar alur intake "Saksi AI" tetap berjalan (degradasi anggun).
"""

import asyncio
import base64
import json
import os

from fastapi import APIRouter, UploadFile, File, Form
import anthropic

router = APIRouter()

_client = None


def get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def _strip_fences(text: str) -> str:
    """Buang pembungkus ```json ... ``` bila Claude menambahkannya."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1] if "\n" in t else t[3:]
        if t.endswith("```"):
            t = t[: -3]
    return t.strip()


@router.post("")
async def analyze_mutu(
    file: UploadFile = File(...),
    komoditas: str = Form(default="ternak"),
):
    """Analisis mutu/BCS komoditas via Claude Vision (claude-sonnet-4-6)."""
    try:
        contents = await file.read()
        b64 = base64.standard_b64encode(contents).decode()
        media_type = file.content_type or "image/jpeg"

        prompt = f"""Kamu adalah ahli penilaian mutu komoditas pertanian koperasi Indonesia.
Analisis gambar {komoditas} ini dan berikan penilaian mutu.

Respons HARUS dalam format JSON persis ini (tanpa markdown):
{{
  "skor": <angka 0-100, dimana 100=sempurna>,
  "kondisi": "<A|B|C>",
  "keterangan": "<deskripsi singkat kondisi 1-2 kalimat>",
  "rekomendasi": "<saran penanganan singkat>"
}}

Grade: A=skor 80-100 (prima), B=skor 50-79 (layak), C=skor 0-49 (kurang)."""

        loop = asyncio.get_event_loop()

        def call_claude():
            return get_client().messages.create(
                model="claude-sonnet-4-6",
                max_tokens=256,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )

        response = await loop.run_in_executor(None, call_claude)
        result = json.loads(_strip_fences(response.content[0].text))
        return result
    except Exception:
        # Fallback jika Claude gagal — intake tetap dapat dilanjutkan.
        return {
            "skor": 50,
            "kondisi": "B",
            "keterangan": "Analisis tidak tersedia",
            "rekomendasi": "Periksa manual",
        }
