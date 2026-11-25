# Postulaciones de aliados

El módulo recibe postulaciones de facilitadores y consultores desde `/app/unete`. El dominio valida los datos, la aplicación genera el acuse de demostración y el repositorio conserva la solicitud en SQLite con estado `pendiente_revision`.

`POST /api/v1/aliados/postulaciones` requiere una sesión, el origen de la aplicación y un `requestId` único. Un reintento de la misma cuenta con el mismo identificador devuelve el mismo folio. `GET` lista hasta 20 acuses de la cuenta para «Mis datos». Los acuses contienen el rol, la fecha, el folio y el estado. Los datos del formulario permanecen en SQLite.

La demostración confirma la recepción. La revisión y el envío de correos quedan fuera del flujo.
