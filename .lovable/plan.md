# Documentación: Migración fuera de Lovable Cloud a infraestructura propia (PostgreSQL/Supabase)

Solo diagnóstico/documentación. No se ha modificado código, datos, usuarios, variables, plan ni despliegues.

## Resumen oficial

Lovable **no ofrece migración de un clic** de Cloud a Supabase self-hosted. El proceso oficial es: exportar la base de datos, mover el código vía Git, y exportar archivos de Storage por separado.

## 1) Backup completo / conexión PostgreSQL

- **Ruta oficial:** More → Cloud → Overview → **Advanced settings** → sección "Export Lovable Cloud data" → tarjeta **Database** → "Export" → "Start export".
- Lovable **envía un enlace de descarga por correo** cuando el export está listo; el archivo también queda guardado en el Cloud storage del proyecto.
- El archivo es un **archivo `.backup`** que se importa con **`pg_restore`** (tu cliente PostgreSQL debe soportar compresión **zstd**).
- No hay cadena de conexión PostgreSQL directa expuesta para `pg_dump` desde fuera; la vía soportada es este export + `pg_restore` en el destino.
- Cuidado con opciones de restauración selectiva de `pg_restore` para evitar conflictos.

## 2) Exportar auth.users (contraseñas)

- El export de base de datos **SÍ incluye las cuentas de usuario con sus hashes de contraseña** (formato hasheado seguro, compatible con Supabase Auth al restaurarse en el esquema `auth`).
- **NO incluye:** configuración de proveedores de sign-in (Google, etc.), ni las API keys del proyecto. Debes reconfigurarlas en el destino.
- Los usuarios con sesión activa deberán **volver a iniciar sesión** tras la migración.
- Referencia adicional: guía de Supabase "migrating users between projects".

## 3) Exportar Storage (buckets/objects)

- **NO está incluido en el export de base de datos.** Debes **descargar los archivos manualmente** desde Cloud → Files/Storage y subirlos a buckets equivalentes en el nuevo Supabase.
- Buckets actuales del proyecto: `customer-photos` (privado) e `invoices` (público). Recréalos con la misma visibilidad.

## 4) Edge Functions y secrets

- **Edge Functions:** el código fuente ya está en el repositorio (`supabase/functions/`, 25 funciones) y se obtiene vía **Git sync** (GitHub/GitLab/Bitbucket) o descargando el codebase (planes de pago). Se redespliegan con `supabase functions deploy` en el destino.
- **Secrets:** NO se exportan (por seguridad). Debes reconfigurarlos manualmente en el destino. Secrets actuales a recrear: `DECOLECTA_API_TOKEN`, `RESEND_API_KEY`, `SEGURFACT_EMAIL`, `SEGURFACT_PASSWORD`, `SEGURFACT_URL` (los `SUPABASE_*` y `LOVABLE_API_KEY` son gestionados por la plataforma y se reemplazan por los del nuevo proyecto).
- El `verify_jwt = false` de cada función está en `supabase/config.toml` (incluido en el repo).

## 5) Limitaciones específicas de Lovable Cloud

- Sin acceso directo por cadena de conexión para `pg_dump` externo; solo export vía UI.
- No hay migración automática Cloud → Supabase; es manual (DB + Storage + secrets + providers).
- Esquema, triggers y funciones (`public.*`) viajan dentro del export de base de datos; verifica que el rol/ownership y los `GRANT` se apliquen bien al restaurar.
- Funciones que dependen de servicios de Lovable (p. ej. Lovable AI Gateway) deberán reemplazarse por integraciones propias.
- El botón "Publish" de Lovable seguirá desplegando en hosting de Lovable; debes configurar tu propio pipeline de despliegue y apuntar el dominio `pedidos.innsanma.com` al nuevo host.

## Orden sugerido de migración

1. Conectar Git sync (o descargar codebase) para tener frontend + functions + config.
2. Crear proyecto Supabase destino (self-hosted o cloud).
3. Export data (Database) desde Cloud → Advanced settings; restaurar con `pg_restore`.
4. Recrear buckets y copiar archivos de Storage.
5. Redesplegar Edge Functions y configurar secrets + proveedores de auth + redirect URLs.
6. Probar en URL temporal (login, pedidos, portal online) antes de cambiar el dominio.
7. Apuntar el dominio al nuevo host.
