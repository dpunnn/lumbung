#!/bin/sh
# Membuat database per-service saat container Postgres pertama kali inisialisasi.
# Dijalankan oleh entrypoint resmi postgres (docker-entrypoint-initdb.d).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE lumbung_auth'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_auth')\gexec
    SELECT 'CREATE DATABASE lumbung_tenant'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_tenant')\gexec
    SELECT 'CREATE DATABASE lumbung_member'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_member')\gexec
    SELECT 'CREATE DATABASE lumbung_simpanpinjam'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_simpanpinjam')\gexec
    SELECT 'CREATE DATABASE lumbung_inventori'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_inventori')\gexec
    SELECT 'CREATE DATABASE lumbung_pass'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_pass')\gexec
    SELECT 'CREATE DATABASE lumbung_guard'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_guard')\gexec
    SELECT 'CREATE DATABASE lumbung_marketplace'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_marketplace')\gexec
    SELECT 'CREATE DATABASE lumbung_notif'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lumbung_notif')\gexec

    -- User aplikasi non-superuser untuk RLS tenant isolation.
    -- POSTGRES_USER (lumbung) adalah superuser yang bypass RLS, sehingga
    -- services runtime menggunakan lumbung_app agar RLS policy berlaku.
    CREATE USER lumbung_app WITH PASSWORD 'lumbung_app_dev' LOGIN;
    GRANT CONNECT ON DATABASE lumbung_auth TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_tenant TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_member TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_simpanpinjam TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_inventori TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_pass TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_guard TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_marketplace TO lumbung_app;
    GRANT CONNECT ON DATABASE lumbung_notif TO lumbung_app;
EOSQL

# Grant schema privileges di setiap database (harus connect per-db)
for DB in lumbung_auth lumbung_tenant lumbung_member lumbung_simpanpinjam \
          lumbung_inventori lumbung_pass lumbung_guard lumbung_marketplace lumbung_notif; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
    GRANT USAGE, CREATE ON SCHEMA public TO lumbung_app;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO lumbung_app;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO lumbung_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO lumbung_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO lumbung_app;
EOSQL
done
