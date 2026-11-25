# Backend de SINTRABAS

API de SINTRABAS en Next.js. Implementa registro, sesiones y consentimientos, y guarda el interior del MVP por cuenta en SQLite. React sigue en `../app`.

El backend sigue la arquitectura de monolito modular por capas del plan técnico. Usa Next.js y TypeScript con Node.js 20.19 y SQLite. El diagnóstico y el progreso se guardan en el módulo Workspace. El catálogo de trámites del prototipo genera la ruta orientativa en React.

## Desarrollo local

Desde `sintrabas-servidor`, instala las dependencias e inicia la API.

```powershell
npm ci
npm run dev
```

La API escucha en `http://127.0.0.1:3000`. En otra terminal, desde `app`, ejecuta `npm ci` y `npm run dev`. Abre la dirección que indique Vite. El proxy reenvía `/api/v1` a Next.js y mantiene la cookie en el mismo origen de la aplicación.

La API crea `data/sintrabas.sqlite` y aplica las migraciones al abrir la base por primera vez. Para usar otro archivo, configura `SQLITE_PATH` en `.env.local`. Puedes ejecutar `npm run db:migrate` para preparar la base antes de iniciar la API.

Para desplegar ambos proyectos bajo un dominio, dirige `/api/v1` a Next.js y sirve `index.html` del frontend en las rutas React, incluidas `/app` y sus rutas hijas. `.env.production` fija `AUTH_ORIGIN=https://sintrabas.co` para `npm start`. La cookie usa `Secure` por defecto en ese modo. Ubica la base SQLite en almacenamiento persistente con permisos de escritura para Next.js.

## Configurar Google y Facebook

Agrega en `.env.local` del backend los pares de credenciales que quieras activar, según [.env.example](.env.example). Mantén los secretos dentro de Next.js. React descubre los proveedores habilitados al cargar la app.

| Proveedor | Variables | URI de retorno en la consola del proveedor |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` | `<origen>/api/v1/auth/oauth/google/callback` |
| Facebook (Meta) | `META_APP_ID` y `META_APP_SECRET` | `<origen>/api/v1/auth/oauth/meta/callback` |

- En Google Auth Platform crea un cliente OAuth de tipo **Aplicación web** y registra su URI de retorno exacta. En desarrollo puedes usar `http://127.0.0.1:5173/api/v1/auth/oauth/google/callback` si Vite está en esa dirección. [Configurar Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- En Meta activa **Facebook Login** para web y registra la URI de retorno exacta de tu origen HTTPS en **Valid OAuth Redirect URIs**. Para probar en modo de desarrollo usa una cuenta con rol autorizado en la app. El backend usa Graph API `v26.0` por defecto y acepta `META_GRAPH_VERSION` para cambiarla. [Configurar Facebook Login](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow) · [Roles en Meta](https://developers.facebook.com/documentation/development/build-and-test/app-roles)

`.env.development` fija `http://127.0.0.1:5173` para `npm run dev` y `.env.production` fija `https://sintrabas.co` para `npm start`. Guarda las credenciales en `.env.local` o en las variables privadas del servidor. Si necesitas otro origen, define `AUTH_ORIGIN` para ese entorno en el proceso de Next.js o en su archivo `.env.development.local` o `.env.production.local`. Conserva el mismo protocolo, host y puerto al registrar los retornos. Reinicia Next.js después de guardar las variables. Si hay un proxy inverso, evita registrar la cadena de consulta de las rutas de retorno.

Para crear una cuenta nueva con OAuth se necesita un correo devuelto por el proveedor y aceptar los términos y el tratamiento de datos. Si ya tienes cuenta, inicia sesión con tu método actual y usa **Vincular** en la pantalla de tu cuenta. El vínculo se hace por el identificador que verifica el proveedor.

## Contrato HTTP

| Método y ruta | Entrada | Éxito |
| --- | --- | --- |
| `POST /api/v1/auth/register` | `name`, `email`, `password`, `consent` | `201`, usuario y cookie de sesión |
| `POST /api/v1/auth/login` | `email`, `password` | `200`, usuario y nueva cookie de sesión |
| `GET /api/v1/auth/session` | Cookie de sesión | `200`, usuario |
| `POST /api/v1/auth/logout` | Cookie si existe | `200`, revocación y eliminación de la cookie |
| `GET /api/v1/auth/oauth/providers` | Sin parámetros | `200`, lista `data.providers` de proveedores configurados |
| `POST /api/v1/auth/oauth/{provider}/start` | `intent` (`login`, `signup` o `link`), `consent` para `signup` | `200`, `data.authorizationUrl` y cookie temporal |
| `GET /api/v1/auth/oauth/{provider}/callback` | Respuesta de Google o Meta y cookie temporal | `303`, retorno a React y cookie de sesión si corresponde |

El registro requiere `consent: { "terms": true, "data": true, "marketing": false, "version": "2026-11" }`. `marketing` acepta `true` o `false`. Las respuestas de acceso tienen la forma `{ "data": { "user": { "id": "…", "name": "…", "email": "…" } } }`. El cierre devuelve `{ "data": {} }`.

Los errores devuelven `{ "error": { "code": "…", "message": "…" } }`. El estado `401` indica credenciales inválidas o sesión ausente, `409` correo ya registrado, `422` campos o consentimiento inválidos y `403` un origen no autorizado en una operación de escritura. Registro e inicio de sesión esperan `application/json` y admiten cuerpos de hasta 8 KiB.

## Módulos

| Módulo | Responsabilidad |
| --- | --- |
| [Identidad](src/modules/identity/README.md) | Cuentas, contraseñas y ciclo de vida de la sesión |
| [Privacidad](src/modules/privacy/README.md) | Validación de versiones legales y evidencia del consentimiento |
| [Workspace](src/modules/workspace/README.md) | Diagnóstico, avance y actividad de demostración por cuenta |
| [OPT](src/modules/opt/README.md) | Importación y consulta del POT de Bucaramanga |
| [Dominios](src/modules/domains/README.md) | Consulta de variantes en un catálogo simulado |

Para cargar las capas del POT en otra instalación ejecuta `node scripts/import-opt.mjs` desde este directorio. El importador trae las fuentes del visor municipal y registra su procedencia. La base SQLite local del proyecto se conserva en `data/sintrabas.sqlite`.

`src/app/api` expone las rutas y delega al adaptador HTTP de Identidad. `src/shared/database` encapsula la apertura de SQLite y las migraciones. `servidor/` contiene el servicio legado de verificaciones y contacto.

## Verificación

```powershell
npm run typecheck
npm run build
npm run smoke:auth -- http://127.0.0.1:3000
```

La prueba de humo registra cuentas sintéticas en la instancia indicada. Ejecútala con una base de desarrollo o pruebas. Usa la URL de Vite para comprobar también el proxy.
