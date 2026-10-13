-- Migration: 0007_upload_kinds.sql
-- Description: Extend upload_kind enum to support direct uploads of market price datasets

ALTER TYPE upload_kind ADD VALUE IF NOT EXISTS 'prices';
ALTER TYPE upload_kind ADD VALUE IF NOT EXISTS 'mandi_prices';
ALTER TYPE upload_kind ADD VALUE IF NOT EXISTS 'usd_inr';
