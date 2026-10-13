# Correr en local

Requisitos: Node 18+ y Docker.

## 1. Prender PostgreSQL con Docker Compose

Desde la raíz del proyecto:

```bash
docker compose up -d
```

Ese comando lee `docker-compose.yml` y levanta el contenedor `backend_tarea_db` (PostgreSQL 16) en segundo plano. La base `gastos_tarea` queda publicada en `localhost:5434` (usuario `tarea`, contraseña `tarea_dev`). Los datos persisten en el volumen `tarea_pgdata`.

Equivalente con el script del proyecto:

```bash
npm run db:up
```

Para ver que el contenedor está arriba:

```bash
docker compose ps
```

Para detenerlo:

```bash
docker compose down
```

## 2. Instalar dependencias, preparar la base y arrancar la API

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

La API queda en `http://localhost:3001` y Swagger en `http://localhost:3001/api-docs`.

Usuarios de demostración:

| Correo | Contraseña | Rol |
|---|---|---|
| demo@gastos.app | Demo1234 | user |
| admin@gastos.app | Admin1234 | admin |

## 3. Generar el token y autorizar Swagger

Con la API en marcha, pide el token con `POST http://localhost:3001/api/auth/login`.

Cuerpo:

```json
{
  "email": "demo@gastos.app",
  "password": "Demo1234"
}
```

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gastos.app","password":"Demo1234"}'
```

La respuesta trae el JWT en `data.token`:

```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "8h",
    "user": {}
  }
}
```

Copia solo el valor de `data.token` (sin la palabra `Bearer`).

1. Abre `http://localhost:3001/api-docs`.
2. Pulsa **Authorize**.
3. Pega el token en el campo `bearerAuth` y confirma.
4. Ejecuta las operaciones protegidas desde esa página.

Para las rutas de administración, repite el login con `admin@gastos.app` / `Admin1234` y autoriza de nuevo con ese `data.token`.
