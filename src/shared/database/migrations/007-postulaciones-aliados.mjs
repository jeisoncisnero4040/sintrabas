export const allyApplications = {
  id: '007-postulaciones-aliados',
  sql: `
    CREATE TABLE postulaciones_aliados (
      id TEXT PRIMARY KEY NOT NULL,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      solicitud_id TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('facilitador', 'consultor')),
      datos_json TEXT NOT NULL CHECK (json_valid(datos_json)),
      estado TEXT NOT NULL DEFAULT 'pendiente_revision' CHECK (estado = 'pendiente_revision'),
      creada_en TEXT NOT NULL,
      UNIQUE (usuario_id, solicitud_id)
    ) STRICT;
    CREATE INDEX postulaciones_aliados_usuario ON postulaciones_aliados(usuario_id, creada_en DESC);
  `,
};
