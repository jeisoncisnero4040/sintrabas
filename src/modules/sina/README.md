# Sina

Sina orienta a los usuarios de SINTRABAS sobre el diagnóstico y los trámites de formalización. React llama a `POST /api/v1/sina`. Next.js comprueba el origen y la sesión, lee el avance de la cuenta desde SQLite y consulta Anthropic con el SDK oficial.

## Capas

- `domain/conversation.ts` valida los mensajes del chat.
- `domain/agent-profile.ts` contiene el perfil jurídico importado de `agents/sina.md`, el modelo, el esfuerzo y las fuentes oficiales.
- `application/chat.ts` combina la conversación con un resumen del espacio del usuario.
- `infrastructure/anthropic.ts` llama a Claude con búsqueda web en fuentes oficiales y devuelve texto y citas.
- `http/sina-handlers.ts` traduce los resultados a la API. La ruta pública del monolito está en `src/app/api/v1/sina/route.ts`.

## Configuración

Define `ANTHROPIC_API_KEY` en el `.env.local` del backend o en las variables protegidas del servidor. `ANTHROPIC_MODEL` permite elegir el modelo y por defecto usa `claude-opus-5-5`. Reinicia Next.js si el proceso ya estaba en ejecución y no recarga las variables.

El paquete declarativo de SINA contiene un perfil y un entorno. La definición publicada tiene la lista de skills vacía. El backend ejecuta el perfil importado con la API Messages y habilita la búsqueda web de Anthropic en los dominios definidos en el perfil. La configuración de ejecución se versiona con el monolito.

## API

Envía `{"messages":[{"role":"user","content":"¿Por dónde empiezo?"}]}`. La respuesta es `{"data":{"answer":"…","sources":[{"url":"…","title":"…"}]}}`. `sources` contiene las citas de la búsqueda cuando están disponibles. React adjunta hasta cuatro turnos previos y, cuando está disponible, el próximo trámite que muestra el tablero. El chat vive en React durante la sesión del espacio. A Anthropic se envían los mensajes y el resumen de avance, con la actividad, modalidad de ubicación y figura jurídica. La dirección exacta, el código predial, los datos de la cuenta y el nombre del negocio quedan fuera del resumen automático.
