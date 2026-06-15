# LUMBUNG — Platform Digitalisasi Koperasi Desa

Platform koperasi desa multi-tenant dengan fitur hero **Saksi AI** (AI Intake Witness).

## Arsitektur

```
Frontend (Next.js 15) → API Gateway (:8080) → 10 Microservice Go + 1 Python
                                             ↕ RabbitMQ (event bus)
                                          PostgreSQL (DB-per-service) + MinIO + Redis
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.23+ (untuk development)
- Node.js 18+ (untuk frontend)
- ANTHROPIC_API_KEY (untuk Claude Vision + Guard AI)

### 1. Environment

```bash
# Copy env example
cp .env.local.example .env.local  # atau edit .env.local langsung

# Set API key Claude di .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Jalankan semua service (Docker)

```bash
make up
# atau
docker compose -f deploy/docker-compose.yml up -d --build
```

Init DB otomatis: `deploy/init-db.sh` membuat database per-service
(`lumbung_auth`, `lumbung_tenant`, dst) saat container postgres pertama kali start.

### 3. Jalankan frontend

```bash
npm install
npm run dev
# Buka http://localhost:3000
```

### 4. Akun testing (setelah `make up`)

Register akun baru via `POST http://localhost:8080/api/auth/register`:

```json
{
  "username": "pengurus_test",
  "email": "test@harapan.test",
  "password": "lumbung123",
  "koperasi_id": "11111111-1111-1111-1111-111111111111",
  "role": "pengurus"
}
```

Atau aktifkan seed account (password: `lumbung123`). Hash di migration
`auth-svc/000002_seed.up.sql` adalah PLACEHOLDER — generate hash valid lalu update:

```bash
go run scripts/hash_password.go lumbung123
# salin output, lalu di psql:
# UPDATE users SET password_hash = '<output>' WHERE email LIKE '%.test';
```

| Email | Role | Koperasi |
|-------|------|----------|
| pengurus@harapan.test | pengurus | Harapan Baru (ternak) |
| kasir@harapan.test | kasir | Harapan Baru |
| anggota@harapan.test | anggota | Harapan Baru |
| pengurus@padiwangi.test | pengurus | Padiwangi Makmur (beras) |
| kasir@padiwangi.test | kasir | Padiwangi Makmur |
| admin@lumbung.test | super_admin | - |

### 5. Service URLs

| Service | Port | Keterangan |
|---------|------|------------|
| Gateway | :8080 | Entry point semua request |
| auth-svc | :8081 | Auth internal |
| tenant-svc | :8082 | Koperasi CRUD |
| member-svc | :8083 | Anggota |
| simpanpinjam-svc | :8084 | Simpanan & Pinjaman |
| inventori-svc | :8085 | Stok & Intake |
| pass-svc | :8086 | Digital Pass + Receipt |
| guard-svc | :8087 | Audit & Anomali |
| marketplace-svc | :8088 | Toko Koperasi |
| notif-svc | :8089 | Notifikasi & SSE |
| ai-svc | :8000 | YOLOv8 + Claude Vision |
| RabbitMQ UI | :15672 | lumbung:lumbung_dev (dev) |
| MinIO Console | :9001 | lumbung:lumbung_dev |

## Alur Saksi AI (Hero Feature)

```
1. Kasir buka kamera → capture foto ternak/hasil panen
2. Frontend POST /api/ai/detect → YOLOv8 count + bbox
3. Frontend POST /api/ai/analyze-mutu → Claude Vision skor mutu
4. Kasir + Anggota konfirmasi (dual approval)
5. Frontend POST /api/pass/intake → pass-svc buat Receipt HMAC
6. Event intake.recorded → inventori tambah stok + guard audit + notif
```

## Struktur Monorepo

```
lumbung/
├── shared/          # Go shared packages (auth, config, errors, events, middleware)
├── gateway/         # API Gateway Go+chi
├── services/        # 10 microservice Go
├── ai/              # Python FastAPI (YOLOv8 + Claude Vision)
├── deploy/          # docker-compose.yml + init-db.sh
├── lib/             # Frontend: api.ts, auth.ts, db.ts (Dexie), dll
├── components/      # React components (shadcn + custom)
├── app/             # Next.js App Router pages
└── scripts/         # Utility scripts (hash_password.go)
```

## Catatan Dev

- **Seed tenant** di-define di `tenant-svc/000002_seed.up.sql`. ID koperasi
  `11111111-...` (Harapan Baru) dan `22222222-...` (Padiwangi) dipakai konsisten
  oleh seed member, simpanpinjam, inventori, dan marketplace.
- **Password seed** harus diaktifkan manual (lihat bagian Akun testing) karena
  hash di repo sengaja placeholder — jangan commit hash password asli.
- **Supabase** (`NEXT_PUBLIC_SUPABASE_*`) legacy, tidak dipakai setelah rebuild
  microservice; biarkan placeholder agar build frontend tidak error.
