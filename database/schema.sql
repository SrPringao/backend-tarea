-- =====================================================================
-- Modelo relacional - API de finanzas personales (PostgreSQL 13+)
-- Montos en pesos con 2 decimales (NUMERIC(12,2)), fechas de gasto en DATE.
-- Este script es idempotente: elimina y vuelve a crear todas las tablas.
-- =====================================================================

DROP TABLE IF EXISTS fixed_expense_payments CASCADE;
DROP TABLE IF EXISTS fixed_expenses CASCADE;
DROP TABLE IF EXISTS net_worth_entries CASCADE;
DROP TABLE IF EXISTS monthly_budgets CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Usuarios del sistema (rol "admin" administra usuarios)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(160) NOT NULL UNIQUE,
  display_name  VARCHAR(80)  NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Preferencias (1 a 1 con usuario)
CREATE TABLE user_preferences (
  id             SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme          VARCHAR(10)   NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  currency       CHAR(3)       NOT NULL DEFAULT 'MXN',
  default_budget NUMERIC(12,2) CHECK (default_budget > 0),
  hide_amounts   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Cuentas / metodos de pago
CREATE TABLE accounts (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(60)   NOT NULL,
  type         VARCHAR(10)   NOT NULL CHECK (type IN ('credit', 'debit', 'cash')),
  color        VARCHAR(7),
  payment_day  SMALLINT      CHECK (payment_day BETWEEN 1 AND 31),
  credit_limit NUMERIC(12,2) CHECK (credit_limit >= 0),
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

-- Categorias de gasto (nombre unico por usuario sin importar mayusculas)
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(40) NOT NULL,
  color      VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX categories_user_name_unique ON categories (user_id, LOWER(name));

-- Personas que deben dinero al usuario (patrimonio)
CREATE TABLE contacts (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(60) NOT NULL,
  name_key    VARCHAR(60) NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contacts_user_name_key_unique UNIQUE (user_id, name_key)
);

-- Gastos variables
CREATE TABLE expenses (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date        DATE          NOT NULL,
  description VARCHAR(200),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX expenses_user_date_idx ON expenses (user_id, date DESC);
CREATE INDEX expenses_account_idx ON expenses (account_id);
CREATE INDEX expenses_category_idx ON expenses (category_id);

-- Presupuesto por mes (YYYY-MM)
CREATE TABLE monthly_budgets (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month      CHAR(7)       NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT monthly_budgets_user_month_unique UNIQUE (user_id, month)
);

-- Gastos fijos / recurrentes (renta, servicios, suscripciones)
CREATE TABLE fixed_expenses (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name         VARCHAR(60)   NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  day_of_month SMALLINT      CHECK (day_of_month BETWEEN 1 AND 31),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX fixed_expenses_user_idx ON fixed_expenses (user_id);

-- Registro de pago mensual de cada gasto fijo
CREATE TABLE fixed_expense_payments (
  id               SERIAL PRIMARY KEY,
  fixed_expense_id INTEGER NOT NULL REFERENCES fixed_expenses(id) ON DELETE CASCADE,
  user_id          UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month            CHAR(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fixed_expense_payments_unique UNIQUE (fixed_expense_id, month)
);

-- Patrimonio: activos (saldos, dinero que te deben) y deudas
CREATE TABLE net_worth_entries (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  label      VARCHAR(80)   NOT NULL,
  kind       VARCHAR(5)    NOT NULL CHECK (kind IN ('asset', 'debt')),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  due_date   DATE,
  sort_order INTEGER       NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX net_worth_entries_user_idx ON net_worth_entries (user_id);
