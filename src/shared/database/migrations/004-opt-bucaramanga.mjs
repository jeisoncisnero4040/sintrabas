export const optBucaramanga = {
  id: '004-opt-bucaramanga',
  sql: `
    CREATE TABLE opt_fuentes (
      codigo TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      url TEXT NOT NULL,
      importado_en TEXT NOT NULL,
      total INTEGER NOT NULL CHECK (total >= 0)
    ) STRICT;

    CREATE TABLE opt_unidades (
      codigo TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      fuente TEXT NOT NULL REFERENCES opt_fuentes(codigo)
    ) STRICT;

    CREATE TABLE opt_predios (
      fuente TEXT NOT NULL REFERENCES opt_fuentes(codigo),
      fid INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      codigo_anterior TEXT,
      longitud REAL NOT NULL,
      latitud REAL NOT NULL,
      PRIMARY KEY (fuente, fid)
    ) STRICT;
    CREATE INDEX opt_predios_codigo ON opt_predios(codigo);
    CREATE INDEX opt_predios_codigo_anterior ON opt_predios(codigo_anterior);

    CREATE TABLE opt_capas (
      id INTEGER PRIMARY KEY,
      fuente TEXT NOT NULL REFERENCES opt_fuentes(codigo),
      fid INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      detalle TEXT,
      anillos_json TEXT NOT NULL CHECK (json_valid(anillos_json)),
      UNIQUE (fuente, fid)
    ) STRICT;
    CREATE VIRTUAL TABLE opt_capas_limites USING rtree(id, min_x, max_x, min_y, max_y);

    CREATE TABLE opt_direcciones_referencia (
      clave TEXT PRIMARY KEY NOT NULL,
      direccion TEXT NOT NULL,
      area_actividad TEXT,
      tratamiento TEXT,
      barrio TEXT,
      comuna TEXT,
      fuente TEXT NOT NULL REFERENCES opt_fuentes(codigo)
    ) STRICT;
  `,
};
