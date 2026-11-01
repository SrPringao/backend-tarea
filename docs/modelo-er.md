# Modelo entidad-relación

Diagrama del modelo relacional definido en `database/schema.sql` (PostgreSQL). La imagen `modelo-er.png` se generó a partir de este mismo diagrama.

![Modelo entidad-relación](modelo-er.png)

```mermaid
erDiagram
    users ||--|| user_preferences : "tiene"
    users ||--o{ accounts : "registra"
    users ||--o{ categories : "define"
    users ||--o{ contacts : "registra"
    users ||--o{ expenses : "registra"
    users ||--o{ monthly_budgets : "define"
    users ||--o{ fixed_expenses : "registra"
    users ||--o{ fixed_expense_payments : "registra"
    users ||--o{ net_worth_entries : "registra"
    accounts ||--o{ expenses : "se paga con"
    categories |o--o{ expenses : "clasifica"
    categories |o--o{ fixed_expenses : "clasifica"
    fixed_expenses ||--o{ fixed_expense_payments : "se paga en"
    accounts |o--o{ net_worth_entries : "respalda"
    contacts |o--o{ net_worth_entries : "debe"

    users {
        UUID id PK
        VARCHAR email UK
        VARCHAR display_name
        TEXT password_hash
        VARCHAR role "user | admin"
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    user_preferences {
        SERIAL id PK
        UUID user_id FK,UK
        VARCHAR theme "dark | light"
        CHAR currency
        NUMERIC default_budget
        BOOLEAN hide_amounts
    }
    accounts {
        SERIAL id PK
        UUID user_id FK
        VARCHAR name
        VARCHAR type "credit | debit | cash"
        VARCHAR color
        SMALLINT payment_day
        NUMERIC credit_limit
        TIMESTAMPTZ archived_at
    }
    categories {
        SERIAL id PK
        UUID user_id FK
        VARCHAR name "único por usuario"
        VARCHAR color
    }
    contacts {
        SERIAL id PK
        UUID user_id FK
        VARCHAR name
        VARCHAR name_key "único por usuario"
        TIMESTAMPTZ archived_at
    }
    expenses {
        SERIAL id PK
        UUID user_id FK
        INTEGER account_id FK "ON DELETE RESTRICT"
        INTEGER category_id FK "ON DELETE SET NULL"
        NUMERIC amount "> 0"
        DATE date
        VARCHAR description
    }
    monthly_budgets {
        SERIAL id PK
        UUID user_id FK
        CHAR month "YYYY-MM, único por usuario"
        NUMERIC amount "> 0"
    }
    fixed_expenses {
        SERIAL id PK
        UUID user_id FK
        INTEGER category_id FK "ON DELETE SET NULL"
        VARCHAR name
        NUMERIC amount "> 0"
        SMALLINT day_of_month
    }
    fixed_expense_payments {
        SERIAL id PK
        INTEGER fixed_expense_id FK
        UUID user_id FK
        CHAR month "único por gasto fijo"
        NUMERIC amount
        TIMESTAMPTZ paid_at
    }
    net_worth_entries {
        SERIAL id PK
        UUID user_id FK
        INTEGER account_id FK "ON DELETE SET NULL"
        INTEGER contact_id FK "ON DELETE SET NULL"
        VARCHAR label
        VARCHAR kind "asset | debt"
        NUMERIC amount
        DATE due_date
        INTEGER sort_order
    }
```

## Reglas de integridad

- Todas las tablas cuelgan de `users` con `ON DELETE CASCADE`: al eliminar un usuario se borra toda su información.
- Una cuenta con gastos no se puede eliminar (`ON DELETE RESTRICT`); la API responde 409 y sugiere archivarla.
- Al eliminar una categoría, sus gastos quedan sin categoría (`ON DELETE SET NULL`).
- `CHECK` en montos, roles, tipos y formato de mes; `UNIQUE` en correo, presupuesto por mes, pago por mes y nombres por usuario.
