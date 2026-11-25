export const workspaces = {
  id: '003-espacios-de-trabajo',
  sql: `
    CREATE TABLE espacios_de_trabajo (
      usuario_id TEXT NOT NULL PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
      estado_json TEXT NOT NULL CHECK (json_valid(estado_json)),
      revision INTEGER NOT NULL CHECK (revision > 0),
      actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
  `,
};
