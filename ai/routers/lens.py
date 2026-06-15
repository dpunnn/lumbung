"""Router /lens — narasi analitik adaptif kondisi koperasi via Claude.

Menerima ringkasan agregat dari simpanpinjam-svc dan menghasilkan narasi
3-4 kalimat untuk pengurus koperasi desa. Degradasi anggun bila Claude gagal.
"""

import asyncio
import os

from fastapi import APIRouter
from pydantic import BaseModel
import anthropic

router = APIRouter()


class LensRequest(BaseModel):
    ringkasan: dict  # dari simpanpinjam-svc: total_simpanan, total_pinjaman, dll
    nama_koperasi: str
    komoditas: str = "ternak"


_client = None


def get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


@router.post("/narasi")
async def buat_narasi(req: LensRequest):
    """Buat narasi analitik adaptif tentang kondisi koperasi via Claude Opus."""
    try:
        prompt = f"""Kamu adalah konsultan keuangan koperasi berpengalaman di Indonesia.
Berdasarkan data berikut dari {req.nama_koperasi} (komoditas: {req.komoditas}):

{req.ringkasan}

Tulis narasi analitik singkat (3-4 kalimat) yang:
1. Menggambarkan kondisi keuangan koperasi saat ini
2. Mengidentifikasi satu risiko utama atau peluang
3. Memberikan satu rekomendasi konkret

Tulis dalam Bahasa Indonesia yang mudah dipahami pengurus koperasi desa."""

        loop = asyncio.get_event_loop()

        def call_claude():
            return get_client().messages.create(
                model="claude-opus-4-8",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )

        response = await loop.run_in_executor(None, call_claude)
        return {"narasi": response.content[0].text}
    except Exception:
        return {"narasi": "Analisis sedang tidak tersedia. Silakan cek data secara manual."}
