# Identidad

Gestiona las cuentas por correo y contraseña, las identidades externas de Google y Facebook y el ciclo de vida de la sesión.

| Capa | Responsabilidad |
| --- | --- |
| `domain/` | Modelo de cuenta y validación de nombre, correo y contraseña. |
| `application/` | Casos de uso y puertos `IdentityStore`, `OAuthStore` y `OAuthProviderAdapter`. Solicita a Privacidad la evidencia requerida para registrar una cuenta. |
| `infrastructure/` | Repositorios SQLite, adaptadores OAuth, hash scrypt e identificadores aleatorios de sesión. |
| `http/` | Adapta solicitudes de Next.js, valida el origen de las escrituras y traduce errores y cookies. |

El registro crea el usuario, la sesión y las evidencias en una transacción. El correo se normaliza antes de consultar o crear la cuenta y SQLite aplica su unicidad.

La cookie `stb_session` es `HttpOnly` y `SameSite=Lax`, con una vigencia de siete días. SQLite guarda el hash SHA-256 del identificador de sesión. El repositorio comprueba el vencimiento al consultarlo. Iniciar sesión con una cookie activa rota la sesión. Cerrar sesión revoca el registro correspondiente y vence la cookie.

`index.ts` conecta los casos de uso a sus adaptadores. Los futuros módulos con rutas privadas pueden usar `identity.session` para resolver al usuario y ejecutar sus propias comprobaciones de propiedad.

## OAuth

El flujo usa código de autorización. Cada intento caduca a los diez minutos y se consume una sola vez. SQLite vincula `state` con una cookie temporal `HttpOnly` del navegador. Google también usa PKCE y `nonce` y verifica la firma y las afirmaciones del token de identidad. Meta valida la aplicación y el usuario detrás del token antes de consultar su perfil.

`identidades_externas` guarda el proveedor y su identificador de usuario. El alta social crea el usuario, la identidad externa, el consentimiento y la sesión en una transacción. La vinculación requiere la misma sesión activa que abrió el intento. Las sesiones de la app usan la cookie `stb_session` y los tokens de los proveedores se descartan tras verificar la identidad.
