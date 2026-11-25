export const identityAndPrivacy = {
  id: '001-identidad-privacidad',
  sql: `
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL CHECK (length(nombre) <= 120),
      correo TEXT COLLATE NOCASE NOT NULL UNIQUE CHECK (length(correo) <= 254),
      password_hash TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;

    CREATE TABLE sesiones (
      token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
      usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
      creada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expira_en TEXT NOT NULL
    ) STRICT;

    CREATE INDEX sesiones_expira_en ON sesiones (expira_en);
    CREATE INDEX sesiones_usuario_id ON sesiones (usuario_id);

    CREATE TABLE documentos_legales_version (
      tipo TEXT NOT NULL CHECK (tipo IN ('terms', 'data', 'marketing')),
      version TEXT NOT NULL,
      PRIMARY KEY (tipo, version)
    ) STRICT;

    INSERT INTO documentos_legales_version (tipo, version)
    VALUES ('terms', '2026-11'), ('data', '2026-11'), ('marketing', '2026-11');

    CREATE TABLE consentimientos (
      usuario_id TEXT NOT NULL REFERENCES usuarios (id),
      tipo TEXT NOT NULL,
      version TEXT NOT NULL,
      aceptado INTEGER NOT NULL CHECK (aceptado IN (0, 1)),
      registrado_en TEXT NOT NULL,
      PRIMARY KEY (usuario_id, tipo, version),
      FOREIGN KEY (tipo, version) REFERENCES documentos_legales_version (tipo, version),
      CHECK (tipo = 'marketing' OR aceptado = 1)
    ) STRICT;
  `,
};
