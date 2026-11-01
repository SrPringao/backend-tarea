# Instalación en otra computadora y manejo de credenciales

Esta guía responde a la pregunta de la entrega: **¿cómo se ejecuta el proyecto en la computadora del profesor, que tiene el servidor de PostgreSQL pero no la base de datos, sin exponer credenciales en el código ni compartirlas?**

## Pasos (5 minutos)

Requisitos: Node.js 18 o superior y un servidor PostgreSQL 13 o superior en ejecución.

```bash
npm install
npm run setup        # 1a vez: crea .env y se detiene para que revises tus datos de PostgreSQL
# edita .env: DB_USER, DB_PASSWORD (y DB_HOST/DB_PORT si no son localhost:5432)
npm run setup        # 2a vez: crea la base, las tablas y los datos demo
npm run dev
```

Luego abre:

| Qué | Dónde |
|---|---|
| API REST (Swagger) | http://localhost:3000/api-docs |
| API GraphQL (GraphiQL) | http://localhost:3000/graphql |
| Comprobación | http://localhost:3000/api/health |

Usuarios demo: `demo@gastos.app` / `Demo1234` y `admin@gastos.app` / `Admin1234`.

Las pruebas automatizadas se ejecutan con `npm test` (usan la base `gastos_tarea_test`, que el setup también crea). Los comandos funcionan igual en Windows, macOS y Linux.

## Qué hace `npm run setup`

1. **Crea `.env`** a partir de `.env.example` si no existe, con un `JWT_SECRET` aleatorio generado en esa máquina.
2. **Revisa la configuración** y, si falta algo, dice exactamente qué variable corregir.
3. **Crea la base de datos** (`gastos_tarea`) y la de pruebas si no existen, conectándose a la base de mantenimiento `postgres` con el usuario de `.env`.
4. **Crea las tablas y carga datos de demostración** (`database/schema.sql` y `scripts/db-init.js`).
5. **Es seguro repetirlo**: si la base ya tiene tablas, no la toca. Para empezar de cero: `npm run setup -- --reset`.

## Respuesta a la pregunta de la entrega

**1. Las credenciales nunca están en el código fuente.**
Toda la configuración sensible se lee de variables de entorno (`process.env`), cargadas desde un archivo `.env` local. Ese archivo está en `.gitignore` y el script `npm run zip` lo excluye. En el proyecto solo se entrega `.env.example`, una plantilla con nombres de variables, valores de ejemplo y comentarios.

**2. Cada quien usa sus propias credenciales; no se comparten.**
El profesor escribe en su `.env` el usuario y la contraseña de **su** servidor PostgreSQL. No necesita las del equipo, y el equipo nunca ve las suyas. El `JWT_SECRET` también se genera en cada máquina. Para Supabase aplica lo mismo: cada persona usa su propio proyecto y sus propias llaves.

**3. La base de datos se crea sola.**
Como el profesor solo tiene el servidor, el setup crea la base y su estructura (tablas, llaves foráneas, restricciones e índices) y carga datos de demostración. No hay que importar respaldos ni ejecutar SQL a mano.

**4. La aplicación no depende de servicios que el profesor no tiene.**
- **Sin Gmail** (`GMAIL_USER` vacío): los correos se muestran en la consola del servidor, con el enlace de confirmación o el código de recuperación, y la API funciona igual.
- **Sin Supabase** (`SUPABASE_URL` vacío): los archivos se guardan en la carpeta `uploads/` y se sirven con URLs firmadas.
- **GraphQL** es un servidor propio dentro de Express, no el de Supabase, así que funciona con cualquier PostgreSQL.

**5. Errores claros en lugar de fallos misteriosos.**
Al arrancar se valida la configuración (variables faltantes, `DATABASE_URL` mal formada, credenciales a medias) y se muestra qué corregir. Si PostgreSQL rechaza la conexión, el mensaje indica qué revisar.

**6. Portabilidad.**
Versiones fijadas en `package-lock.json` (`npm install` instala exactamente las mismas), `engines: node >= 18`, scripts compatibles con Windows (`cross-env`) y sin rutas absolutas.

## Buenas prácticas aplicadas

| Práctica | Cómo se aplica |
|---|---|
| Configuración fuera del código (12-Factor App) | Variables de entorno; un mismo código para desarrollo, pruebas y producción |
| Plantilla documentada | `.env.example` con cada variable explicada; nunca valores reales |
| Secretos fuera del control de versiones | `.env` en `.gitignore` y excluido del zip |
| Validación temprana | `src/config/env.js` revisa todo al arrancar |
| Esquema reproducible | `database/schema.sql` + `npm run setup` |
| Bases separadas para pruebas | `npm test` nunca toca la base real ni Supabase |
| Privilegio mínimo en la nube | La llave `service_role` de Supabase vive solo en el backend; RLS bloquea el acceso directo a las tablas |
| Conexión cifrada a la nube | `DB_SSL=true` para Supabase |

## Opción: usar Supabase en lugar de un PostgreSQL local

1. Crear un proyecto gratuito en https://supabase.com. En **Settings → Data API**, desactivar la Data API (el backend se conecta directo a PostgreSQL).
2. **Connect → Direct → Session pooler → URI**: copiar la cadena en `DATABASE_URL` (si la contraseña tiene símbolos, codificarlos, p. ej. `@` = `%40`) y poner `DB_SSL=true`.
3. Para archivos: **Settings → API Keys**, copiar la *secret key* en `SUPABASE_SERVICE_ROLE_KEY` y la URL del proyecto (`https://<ref>.supabase.co`) en `SUPABASE_URL`.
4. `npm run setup` crea las tablas y el bucket privado `archivos`.

## Opción: Docker

`npm run db:up` levanta PostgreSQL 16 en el puerto 5434. En `.env`: `DB_PORT=5434`, `DB_USER=tarea`, `DB_PASSWORD=tarea_dev`. Después, `npm run setup`.
