import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export function loadModel() {
  if (!modelPromise) modelPromise = cocoSsd.load({ base: "lite_mobilenet_v2" });
  return modelPromise;
}

const KELAS_TERNAK = ["cow", "sheep", "horse"];

export interface HasilDeteksi {
  jumlah: number;
  rincian: Record<string, number>;
  deteksi: cocoSsd.DetectedObject[];
}

export async function hitungTernak(
  sumber: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<HasilDeteksi> {
  const model = await loadModel();
  const deteksi = await model.detect(sumber);
  const rincian: Record<string, number> = {};
  let jumlah = 0;
  for (const d of deteksi) {
    if (KELAS_TERNAK.includes(d.class) && d.score >= 0.5) {
      rincian[d.class] = (rincian[d.class] ?? 0) + 1;
      jumlah++;
    }
  }
  return { jumlah, rincian, deteksi };
}

// Rasio verifikasi → dipakai asset.ts. Mencegah "ghost cattle".
export function rasioVerifikasi(jumlahTerverifikasi: number, jumlahKlaim: number): number {
  if (jumlahKlaim <= 0) return 0;
  return Math.min(1, jumlahTerverifikasi / jumlahKlaim);
}
