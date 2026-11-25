# Workspace

Guarda un espacio privado por cuenta con el diagnóstico, el paso del borrador, el progreso de trámites y las actividades de demostración. `GET` y `PUT /api/v1/workspace` resuelven la cuenta desde la cookie de sesión. El cliente no envía un identificador de cuenta.

| Capa | Responsabilidad |
| --- | --- |
| `domain/` | Valida campos, opciones y límites del estado. |
| `application/` | Lee el espacio y aplica la revisión al guardar cambios. |
| `infrastructure/` | Guarda el espacio en SQLite en `espacios_de_trabajo`. |
| `http/` | Valida sesión y origen de escrituras y devuelve errores HTTP. |

El guardado requiere la revisión que devolvió la última lectura. Si otra pestaña guardó primero, el endpoint devuelve `409` y React recarga el estado. Los intereses de demostración se guardan en la cuenta y no se envían a terceros.
