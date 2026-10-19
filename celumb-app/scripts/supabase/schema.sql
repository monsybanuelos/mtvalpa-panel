-- CeluMB schema for Supabase Postgres (mirrors local SQLite + photos)
-- Idempotent: safe to re-run. Prefer pooler DATABASE_URL from this VM.

CREATE TABLE IF NOT EXISTS phones (
  id BIGSERIAL PRIMARY KEY,
  stock_no TEXT NOT NULL UNIQUE,
  acquired_at TEXT NOT NULL,
  cost DOUBLE PRECISION NOT NULL,
  suggested_price DOUBLE PRECISION NOT NULL,
  margin_suggested DOUBLE PRECISION,
  includes_charger TEXT NOT NULL DEFAULT 'No',
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  imei TEXT,
  carrier TEXT NOT NULL DEFAULT 'Liberado',
  condition_label TEXT NOT NULL DEFAULT 'A Bueno (9-10)',
  ram TEXT,
  storage TEXT,
  battery_pct DOUBLE PRECISION,
  comments TEXT,
  compra_credito INTEGER NOT NULL DEFAULT 0,
  credito_monto DOUBLE PRECISION,
  credito_origen TEXT,
  photo1_path TEXT,
  photo2_path TEXT,
  status TEXT NOT NULL DEFAULT 'disponible'
    CHECK (status IN ('disponible', 'vendido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evolve existing phones table (no-op if columns already exist)
ALTER TABLE phones ADD COLUMN IF NOT EXISTS compra_credito INTEGER NOT NULL DEFAULT 0;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS credito_monto DOUBLE PRECISION;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS credito_origen TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS photo1_path TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS photo2_path TEXT;

CREATE TABLE IF NOT EXISTS accessories (
  id BIGSERIAL PRIMARY KEY,
  stock_no TEXT NOT NULL UNIQUE,
  catalog_code TEXT,
  codigo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  cost_unit DOUBLE PRECISION,
  precio_sugerido DOUBLE PRECISION,
  precio_maximo DOUBLE PRECISION,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  phone_id BIGINT NOT NULL UNIQUE REFERENCES phones(id),
  sold_at TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  customer TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'Presencial',
  extra_costs DOUBLE PRECISION NOT NULL DEFAULT 0,
  margin DOUBLE PRECISION,
  comments TEXT
);

CREATE TABLE IF NOT EXISTS credit_accounts (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT NOT NULL UNIQUE REFERENCES sales(id),
  debtor_name TEXT NOT NULL,
  debtor_phone TEXT,
  credit_type TEXT NOT NULL DEFAULT 'Crédito',
  plazo_dias INTEGER,
  payment_freq TEXT,
  principal DOUBLE PRECISION NOT NULL,
  paid_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  balance DOUBLE PRECISION NOT NULL,
  pago1 DOUBLE PRECISION,
  pago2_status TEXT NOT NULL DEFAULT 'No',
  pago3_status TEXT NOT NULL DEFAULT 'No',
  due_date TEXT,
  liquidado TEXT NOT NULL DEFAULT 'No',
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS plazo_dias INTEGER;
ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS payment_freq TEXT;

CREATE TABLE IF NOT EXISTS collections (
  id BIGSERIAL PRIMARY KEY,
  credit_id BIGINT NOT NULL REFERENCES credit_accounts(id),
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
  paid_at TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
  note TEXT
);

CREATE TABLE IF NOT EXISTS supplier_credits (
  id BIGSERIAL PRIMARY KEY,
  at TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
  creditor TEXT NOT NULL,
  paid TEXT NOT NULL DEFAULT 'No' CHECK (paid IN ('Si', 'No')),
  comments TEXT,
  stock_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger (
  id BIGSERIAL PRIMARY KEY,
  at TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
  kind TEXT NOT NULL,
  stock_no TEXT,
  amount DOUBLE PRECISION NOT NULL,
  available_after INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS app_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'ventas'))
);

CREATE INDEX IF NOT EXISTS idx_phones_status ON phones(status);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_ledger_at ON ledger(at DESC);
CREATE INDEX IF NOT EXISTS idx_accessories_stock ON accessories(stock_no);
