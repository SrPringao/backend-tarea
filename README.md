# API Finanzas Personales - Backend (Etapa 1/3)

Backend REST para una aplicación web y móvil en **Flutter** de control de gastos, presupuestos y patrimonio.
Construido con **Node.js + Express 5 + PostgreSQL**, con acceso a datos dividido entre **Sequelize ORM** y **SQL nativo** (`pg`).

## Entregables

| Entregable | Ubicación |
|---|---|
| Listado global de operaciones (Excel, 60 % implementado) | `docs/Inventario_Operaciones.xlsx` (hojas Inventario, Resumen, Escenario de pruebas y Modelo de datos) |
| Código fuente | este proyecto (`npm run zip` genera `../backend-tarea.zip` sin `node_modules` ni `.env`) |
| Escenario de pruebas automatizado | `tests/` (Jest + Supertest, 89 casos) y hoja "Escenario de pruebas" del Excel |
| Escenario de pruebas manual | `docs/API_Finanzas.postman_collection.json` |
| Documento del escenario de pruebas (14 casos manuales con espacio para evidencias) | `docs/Escenario_de_Pruebas.docx` |
| Documentación interactiva | `http://localhost:3000/api-docs` (Swagger / OpenAPI 3) |
| Modelo de base de datos | `database/schema.sql` y diagrama entidad-relación en `docs/modelo-er.md` |

## Inventario de operaciones

- **87 operaciones** identificadas en 13 módulos.
- **53 implementadas (60.9 %)**: 28 con Sequelize ORM y 25 con SQL nativo.
- **34 documentadas como versiones futuras (39.1 %)**: recuperación de contraseña, OAuth, notificaciones push, importar/exportar, simulador, automatizaciones, etc.

| Módulo | Acceso a datos | Endpoints implementados |
|---|---|---|
| Autenticación | Sequelize ORM | register, login, me (GET/PUT/DELETE), password |
| Usuarios (admin) | Sequelize ORM | listar, consultar, cambiar rol/estado, eliminar |
| Cuentas | Sequelize ORM | CRUD + listar + archivar |
| Categorías | Sequelize ORM | CRUD + listar |
| Contactos | Sequelize ORM | CRUD + listar |
| Preferencias | Sequelize ORM | consultar, actualizar |
| Gastos | SQL nativo | CRUD + listar con filtros/paginación + resumen por categoría |
| Presupuestos | SQL nativo | definir (upsert), listar, estado del mes, eliminar |
| Gastos fijos | SQL nativo | CRUD + listar + marcar/desmarcar pago |
| Patrimonio | SQL nativo | CRUD + listar + resumen neto |
| Reportes | SQL nativo | dashboard, tendencia mensual |

## Arquitectura

```
src/
  app.js                 Express: seguridad, rutas, documentación y manejo de errores
  server.js              Arranque y cierre ordenado
  config/
    env.js               Variables de entorno
    database.js          Instancia de Sequelize + Pool de pg (SQL nativo)
  routes/                Solo definen URL -> middlewares -> controlador
  controllers/           Reglas de negocio y respuesta HTTP
  models/
    orm/                 Modelos Sequelize, un archivo por modelo (User, UserPreference, Account,
                         Category, Contact); index.js solo define las relaciones
    sql/                 Consultas SQL nativas parametrizadas (gastos, presupuestos, fijos, patrimonio, reportes)
  validators/            Esquemas Joi, un archivo <módulo>.validator.js por módulo (mensajes en español)
  middlewares/           auth (JWT + roles), validate, rateLimit, errorHandler
  docs/                  inventory.js (fuente única) y openapi.js (Swagger generado)
  utils/                 ApiError, respuestas, helpers de SQL y fechas
database/schema.sql      Modelo relacional (10 tablas, llaves foráneas, CHECK, índices)
scripts/                 db-init (esquema + datos demo), generar-excel, generar-postman
tests/                   Pruebas de integración
```

Flujo de una petición: `ruta -> authenticate -> validate(Joi) -> controlador -> modelo (ORM o SQL) -> PostgreSQL`.

El archivo `src/docs/inventory.js` es la fuente única del inventario: de él salen el Excel, Swagger y la colección de Postman, así no se contradicen entre sí.

## Seguridad y validación

- **Autenticación JWT** (HS256, expiración configurable) y contraseñas con **bcrypt**. Política de contraseña: mínimo 8 caracteres con letras y números.
- **Autorización por rol** (`user` / `admin`) y **aislamiento de datos**: cada consulta filtra por `user_id`. Acceder a un recurso ajeno devuelve 404 y no revela que existe.
- Se valida que la cuenta, la categoría y el contacto relacionados pertenezcan al usuario.
- Los usuarios desactivados pierden el acceso de inmediato, aunque su token siga vigente.
- **Validación de entrada** con Joi en params, query y body. Se eliminan campos desconocidos y se responde 400 con el detalle por campo.
- **SQL parametrizado** en todas las consultas nativas; la columna de orden sale de una whitelist y los comodines de `LIKE` se escapan.
- **Helmet** (cabeceras HTTP), **CORS** configurable, límite de 100 KB por petición.
- **Rate limiting**: 300 peticiones por IP cada 15 minutos y 20 intentos de login/registro cada 15 minutos.
- **Integridad en la base**: llaves foráneas, `CHECK`, `UNIQUE` y transacciones (por ejemplo, registro de usuario y preferencias).
- **Errores consistentes**: `{ ok: false, error: { status, message, details? } }`. Los errores de Postgres (23505, 23503, 23514) se traducen a 409/400 sin exponer detalles internos.

## Cómo ejecutar

Requisitos: Node 18+ y Docker (o un PostgreSQL 13+ propio, ajustando `.env`).

```bash
npm install
cp .env.example .env        # ya incluye valores para el docker-compose
npm run db:up               # PostgreSQL 16 en el puerto 5434 (crea también la base de pruebas)
npm run db:init             # crea tablas y carga datos demo
npm run dev                 # http://localhost:3000  |  docs: http://localhost:3000/api-docs
```

Para revisar o detener el contenedor de PostgreSQL: `docker compose ps` y `docker compose down` (los datos persisten en el volumen `tarea_pgdata`).

Usuarios de demostración:

| Correo | Contraseña | Rol |
|---|---|---|
| demo@gastos.app | Demo1234 | user (con 3 meses de datos) |
| admin@gastos.app | Admin1234 | admin |

### Pruebas y documentos

```bash
npm run db:init:test        # una sola vez: prepara la base gastos_tarea_test
npm test                    # 89 pruebas de integración
npm run docs:all            # ejecuta las pruebas y regenera el Excel y la colección de Postman
npm run zip                 # empaqueta el código para entregar
```

### Probar desde Swagger

1. Pide un token con `POST /api/auth/login` (desde Swagger o con curl):

   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@gastos.app","password":"Demo1234"}'
   ```

2. Copia el valor de `data.token` (sin la palabra `Bearer`).
3. Abre `http://localhost:3000/api-docs`, pulsa **Authorize**, pega el token en `bearerAuth` y confirma.
4. Para las rutas de administración repite el login con `admin@gastos.app` / `Admin1234`.

### Postman

Importa `docs/API_Finanzas.postman_collection.json`, ejecuta **Autenticación > POST Iniciar sesión** y el token se guarda solo en la variable `{{token}}`.

## Formato de la API

- Respuesta exitosa: `{ "ok": true, "data": ..., "meta": { "total", "page", "limit", "totalPages" } }` (`meta` solo en listados).
- Montos en pesos con 2 decimales, fechas `YYYY-MM-DD`, meses `YYYY-MM`.
- Códigos: 200 OK, 201 creado, 204 eliminado, 400 validación, 401 sin token o token inválido, 403 sin permiso, 404 no encontrado, 409 conflicto, 413 cuerpo muy grande, 429 demasiadas peticiones.
