export const cadastralAddresses = {
  id: '006-direcciones-catastrales',
  sql: `
    CREATE TABLE opt_direcciones_catastro (
      clave TEXT NOT NULL,
      codigo_predial TEXT NOT NULL,
      PRIMARY KEY (clave, codigo_predial)
    ) STRICT, WITHOUT ROWID;
    CREATE INDEX opt_direcciones_catastro_codigo ON opt_direcciones_catastro(codigo_predial);
  `,
};
