# SINTRABAS · servidor de conexiones

Conecta la herramienta con las fuentes que no se pueden llamar desde el navegador.

## Arranque
1. Instalar Node 18 o superior.
2. Copiar `.env.ejemplo` como `.env` y llenar las llaves.
3. `node --env-file=.env server.js`
4. En el HTML, escribir la dirección del servidor en `CONFIG.apiBase` (por ejemplo `https://api.sintrabas.co`).

## Qué activa cada llave
| Variable | Activa | Estado |
|---|---|---|
| `ANTHROPIC_API_KEY` | Asistente con IA (`/sina`) | Probado con un servicio simulado; falta probar con la llave real |
| `GODADDY_TOKEN` o `GODADDY_KEY` + `GODADDY_SECRET` | Disponibilidad de dominios (`/dominios`) | Sin probar: requiere cuenta GoDaddy con acceso a la API de disponibilidad |
| `npm i playwright` | SIC (`/nombre/sic`) y RUES (`/nombre/rues`) | Borrador sin probar contra los sitios reales |

## Antes de producción
- Sesiones: validar en el servidor el token de Google y el de Meta antes de crear la sesión.
- Poner caché y límite de consultas por minuto a `/nombre/*`, `/dominios` y `/sina`.
- Fijar `ORIGEN_PERMITIDO` al dominio real.
- Correr `node verificar-enlaces.js` y corregir los enlaces de trámites que fallen.
