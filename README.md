# API Finanzas Personales - Backend (Etapa 2/3)

Backend para una aplicación web y móvil en **Flutter** de control de gastos, presupuestos y patrimonio.
Construido con **Node.js + Express 5 + PostgreSQL** (local o **Supabase**) y expone dos APIs sobre la misma base:

- **REST** (etapa 1): 60 % de la lógica de negocio, con acceso a datos dividido entre **Sequelize ORM** y **SQL nativo** (`pg`).
- **GraphQL** (etapa 2): el 40 % restante, en `/graphql`, más un **servicio de correo** (confirmación de cuenta, notificaciones y cambio de contraseña).

> Instalación en otra computadora (p. ej. la del profesor): ver [`docs/INSTALACION.md`](docs/INSTALACION.md). En resumen: `npm install`, `npm run setup` y `npm run dev`.

## Entregables

| Entregable | Ubicación |
|---|---|
| Listado global de operaciones (Excel) | `docs/Documentacion_Inventario_Operaciones.xlsx` (Inventario con columna API y etapa, Resumen, Escenario de pruebas y Modelo de datos) |
| Código fuente | este proyecto (`npm run zip` genera `../backend-tarea.zip` con exactamente los archivos del último commit: nunca incluye `.env`, `node_modules` ni archivos subidos) |
| Documentación REST | `http://localhost:3000/api-docs` (Swagger UI / OpenAPI 3) |
| Documentación GraphQL | `http://localhost:3000/graphql` (GraphiQL), `docs/graphql/index.html` (página generada) y `docs/schema.graphql` |
| Pruebas automatizadas | `tests/` (Jest + Supertest, 148 casos) y hoja "Escenario de pruebas" del Excel |
| Pruebas manuales | `docs/API_Finanzas.postman_collection.json` (carpetas REST y carpeta GraphQL) y `docs/Escenario_de_Pruebas.docx` |
| Modelo de base de datos | `database/schema.sql` y diagrama entidad-relación en `docs/modelo-er.md` |
| Instalación y manejo de credenciales | `docs/INSTALACION.md` y `.env.example` |

## Inventario de operaciones

| | Operaciones | API | Acceso a datos |
|---|---|---|---|
| Etapa 1 (60 %) | 53 de 87 | REST | 28 Sequelize ORM, 25 SQL nativo |
| Etapa 2 (40 % restante) | 33 de 34 | GraphQL | 18 Sequelize ORM, 15 SQL nativo |
| Etapa 2: servicio de correo y archivos | 3 nuevas (OP-088 a OP-090) | REST | — |
| Documentada para la etapa de Flutter | 1 (OP-011, login con Google/Apple) | — | — |

El login con Google/Apple queda fuera porque requiere registrar la app en Google Cloud y una cuenta de Apple Developer (99 USD al año); se implementará junto con la app.

### Operaciones GraphQL (etapa 2)

| Módulo | Queries | Mutations |
|---|---|---|
| Autenticación | `me` | `requestPasswordReset`, `resetPassword`, `refreshToken`, `logout`, `verifyEmail`, `sendVerificationEmail` |
| Cuentas | `creditCardStatement` | `reorderAccounts`, `uploadAccountImage` |
| Categorías y contactos | | `createDefaultCategories`, `mergeCategories`, `setCategoryLimit`, `mergeContacts` |
| Gastos | `expenseSuggestions`, `exportExpensesCsv` | `importExpensesCsv`, `attachReceipt`, `splitExpense` |
| Presupuestos y gastos fijos | | `checkBudgetAlerts`, `fixedExpenseToExpense`, `sendPaymentReminders` |
| Patrimonio | `projections` | `reorderNetWorth`, `syncNetWorthWithAccount`, `createProjection`, `deleteProjection` |
| Reportes | `dailySpending`, `categoryComparison` | |
| Notificaciones | `devices` | `registerDevice`, `sendDailySummary` (admin) |
| Automatización | `apiTokens`, `cardNameMappings` | `createApiToken`, `revokeApiToken`, `createCardNameMapping`, `webhookExpense` (X-API-Key) |

### Correos

| Correo | Cuándo se envía |
|---|---|
| Confirma tu cuenta | Al registrarse (`POST /api/auth/register`) o con `sendVerificationEmail`. El enlace abre `GET /api/auth/verify-email` |
| Código para restablecer tu contraseña | `requestPasswordReset` (código de 6 dígitos, 15 minutos, 5 intentos) |
| Tu contraseña cambió | Al cambiarla por REST (`PUT /api/auth/password`) o con `resetPassword` |
| Alerta de presupuesto | `checkBudgetAlerts`: al 80 % y 100 % del presupuesto del mes o del límite de una categoría |
| Recordatorio de pagos próximos | `sendPaymentReminders`: gastos fijos sin pagar que vencen pronto |
| Resumen de gastos del día | `sendDailySummary` (admin) |
| Notificación informativa | `POST /api/notifications/email` (admin) |

Las alertas, los recordatorios y el resumen también corren solos cada día a las 08:00 con `ENABLE_SCHEDULER=true`. Cada alerta se envía una sola vez (tabla `notification_log`). Sin credenciales de Gmail, los correos se muestran en la consola y la API funciona igual.

## Arquitectura

```
Flutter ──► Express (helmet, CORS, rate limit, límites de tamaño)
              ├── /api/...    REST    → routes → middlewares (JWT, Joi) → controllers ─┐
              ├── /graphql    GraphQL → resolvers (guardas JWT/rol, Joi) ──────────────┤
              │                                                                       ▼
              │                                 services/ (lógica de negocio de la etapa 2)
              │                                   ├── models/orm (Sequelize) | models/sql (pg)
              │                                   ├── services/mail (nodemailer + plantillas)
              │                                   └── services/storage (Supabase Storage | disco)
              └────────────────────────────────► PostgreSQL (local o Supabase)
```

```
src/
  app.js                 Express: seguridad, REST, GraphQL, documentación y manejo de errores
  server.js              Arranque, tareas programadas y cierre ordenado
  config/                env.js (validación de variables) y database.js (Sequelize + Pool de pg, local o DATABASE_URL)
  routes/, controllers/  API REST (una ruta y un controlador por módulo)
  graphql/
    schema/*.graphql     Schema por módulo, con descripción en cada tipo y operación
    resolvers/*.js       Resolvers delgados: autorizan, validan y llaman al servicio
    context.js           Identifica al usuario (Bearer o X-API-Key)
    guards.js            requireUser, requireAdmin, requireApiKey, validateArgs
    errors.js            Enmascarado de errores (códigos en extensions, sin pila)
    index.js             Servidor graphql-yoga con graphql-armor
  services/              Lógica de negocio reutilizable (auth, correo, archivos, módulos de la etapa 2, tareas programadas)
  models/orm/            Modelos Sequelize, uno por archivo
  models/sql/            Consultas SQL nativas parametrizadas
  validators/            Esquemas Joi por módulo (REST y argumentos GraphQL)
  middlewares/           auth, validate, rateLimit, errorHandler
  docs/                  inventory.js (fuente única), openapi.js y graphqlExamples.js
database/schema.sql      Modelo relacional (18 tablas, llaves foráneas, CHECK, índices y RLS)
scripts/                 setup, db-init, generar-excel, generar-postman, generar-docs-graphql
tests/                   Pruebas de integración (REST, GraphQL, correo y sesiones)
```

**Por qué GraphQL propio y no el `pg_graphql` de Supabase:** funciona con cualquier PostgreSQL (Supabase o el servidor local del profesor) sin compartir llaves, aplica autenticación, validación y reglas de negocio en cada resolver y reutiliza los modelos existentes.

`src/docs/inventory.js` es la fuente única del inventario: de él salen el Excel, Swagger y la colección de Postman. Los ejemplos de Postman se validan contra el schema GraphQL al generarse.

## Seguridad

**En ambas APIs**
- **JWT** (HS256) con identificador `jti`: `logout` lo revoca y deja de servir en REST y GraphQL. **Refresh tokens** de un solo uso con rotación; reutilizar uno ya usado cierra todas las sesiones del usuario (detección de robo).
- Contraseñas con **bcrypt**; política de mínimo 8 caracteres con letras y números.
- **Autorización por rol** (`user` / `admin`) y **aislamiento de datos**: cada consulta filtra por `user_id`; un recurso ajeno responde 404.
- **Validación** con Joi en params, query, body y argumentos GraphQL; se eliminan campos desconocidos.
- **SQL parametrizado** en todas las consultas; columnas de orden por whitelist y comodines de `LIKE` escapados.
- **Rate limiting**: general (300 por 15 min), autenticación (20 por 15 min), GraphQL (300 por 15 min) y correos de admin (30 por hora).
- **Respuestas**: cabeceras de Helmet, `Cache-Control: no-store` en la API, errores sin pila ni detalles internos.
- **Tokens de un solo uso** (verificación, recuperación, refresh, API) guardados solo como hash SHA-256; códigos con expiración y límite de intentos. `requestPasswordReset` no revela si un correo existe.

**Específico de GraphQL**
- graphql-armor: profundidad máxima 8, costo máximo 5000, máximo 10 alias, 2000 tokens y 20 directivas por consulta.
- Errores enmascarados: solo llegan mensajes pensados para el cliente, con `extensions.code` (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`).
- En producción se desactivan la introspección y GraphiQL, y se ocultan las sugerencias de campos.
- Subidas: máximo 3 MB por petición y 2 MB por archivo; el tipo se valida por los primeros bytes (JPEG, PNG, PDF), no por la extensión; el nombre del archivo se genera al azar.

**Correo, archivos y base de datos**
- Plantillas de correo con todo dato del usuario escapado (sin inyección de HTML). El envío de notificaciones es solo para admin y hacia usuarios registrados (no es un relay abierto).
- Archivos privados: Supabase Storage con bucket privado o disco, siempre con **URLs firmadas que expiran en 1 hora**.
- CSV exportado protegido contra inyección de fórmulas.
- **Row Level Security** activado en todas las tablas: en Supabase bloquea el acceso directo con la llave pública; solo el backend (dueño de las tablas) accede.
- Credenciales solo en `.env` (fuera del repositorio y del zip); la app valida la configuración al arrancar.

## Cómo ejecutar

Requisitos: Node 18+ y un PostgreSQL 13+ (propio, Docker o Supabase).

```bash
npm install
npm run setup     # crea .env si no existe, la base si no existe, las tablas, los datos demo y el bucket de Supabase
npm run dev       # REST: http://localhost:3000/api-docs | GraphQL: http://localhost:3000/graphql
```

`npm run setup` se detiene si la base ya tiene tablas (para no borrar datos); `npm run setup -- --reset` las vuelve a crear.

**Opciones de base de datos** (en `.env`, explicadas en `.env.example`):
- **PostgreSQL propio**: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- **Docker del proyecto**: `npm run db:up` y en `.env` `DB_PORT=5434`, `DB_USER=tarea`, `DB_PASSWORD=tarea_dev`.
- **Supabase**: `DATABASE_URL` (cadena "Session pooler") y `DB_SSL=true`; para archivos, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

Usuarios de demostración:

| Correo | Contraseña | Rol |
|---|---|---|
| demo@gastos.app | Demo1234 | user (con 3 meses de datos) |
| admin@gastos.app | Admin1234 | admin |

### Pruebas y documentos

```bash
npm test                    # 148 pruebas de integración (siempre sobre la base de pruebas, nunca sobre Supabase)
npm run docs:all            # ejecuta las pruebas y regenera Excel, Postman y la documentación de GraphQL
npm run zip                 # empaqueta el último commit para entregar (se niega si hay cambios sin commit)
```

### Probar GraphQL

1. Pide un token con `POST /api/auth/login` (`demo@gastos.app` / `Demo1234`).
2. Abre `http://localhost:3000/graphql` (GraphiQL), agrega en **Headers** `{ "Authorization": "Bearer TOKEN" }` y ejecuta, por ejemplo:

   ```graphql
   query {
     dailySpending { month total dailyBudget }
     categoryComparison { monthA monthB categories { categoryName totalA totalB percentChange } }
   }
   ```

3. En Postman, la carpeta **GraphQL (etapa 2)** tiene un ejemplo de cada operación (incluidas las subidas de archivos).

### Probar REST (Swagger)

1. Ejecuta `POST /api/auth/login` desde Swagger, copia `data.token` (sin la palabra `Bearer`).
2. Pulsa **Authorize**, pega el token en `bearerAuth` y confirma.
3. Para las rutas de administración repite el login con `admin@gastos.app` / `Admin1234`.

Se conserva el generador propio de OpenAPI (desde el inventario y los esquemas Joi, servido con swagger-ui-express) en lugar de swagger-autogen: así la documentación usa las validaciones reales y no puede quedar desactualizada respecto a ellas.

## Formato de las APIs

- **REST**: `{ "ok": true, "data": ..., "meta"? }` o `{ "ok": false, "error": { status, message, details? } }`. Códigos 200, 201, 202, 204, 400, 401, 403, 404, 409, 411, 413 y 429.
- **GraphQL**: `{ "data": ..., "errors"?: [{ message, path, extensions: { code, status, details? } }] }`.
- Montos en pesos con 2 decimales, fechas `YYYY-MM-DD`, meses `YYYY-MM`, fechas y horas ISO 8601.
