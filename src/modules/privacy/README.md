# Privacidad

Valida los consentimientos del registro y crea la evidencia con la versión legal y la fecha UTC del servidor.

| Capa | Responsabilidad |
| --- | --- |
| `domain/` | Tipos de consentimiento, versión vigente y errores de dominio. |
| `application/` | `signupConsent` exige términos y autorización de datos y registra la decisión opcional sobre novedades. |
| `infrastructure/` | Persiste las evidencias con la transacción de registro que abre Identidad. |

Identidad consume `signupConsent` desde `index.ts`. Cada decisión ocupa una fila de `consentimientos` vinculada a `documentos_legales_version` en SQLite, incluida la decisión de no recibir novedades.

El registro con Google o Facebook valida el consentimiento antes de redirigir al proveedor. La evidencia se guarda cuando la cuenta se crea, con la fecha en que se presentó la aceptación.

Para publicar una nueva versión, agrega sus tres tipos en una migración y actualiza `LEGAL_VERSION` y la versión de los textos del frontend. Conserva las filas históricas para mantener la evidencia asociada a la versión aceptada.
