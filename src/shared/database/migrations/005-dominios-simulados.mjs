export const simulatedDomains = {
  id: '005-dominios-simulados',
  sql: `
    CREATE TABLE dominios_simulados (
      nombre TEXT NOT NULL PRIMARY KEY COLLATE NOCASE
    ) STRICT;

    WITH
    nombre(valor) AS (VALUES
      ('arte'), ('barrio'), ('bga'), ('brasa'), ('cafe'), ('calzado'), ('casa'), ('cocina'), ('comercio'),
      ('conecta'), ('crea'), ('cuero'), ('deco'), ('delicias'), ('diseño'), ('emprende'), ('envios'),
      ('estudio'), ('finca'), ('flor'), ('giro'), ('grano'), ('hogar'), ('idea'), ('madera'), ('marca'),
      ('miga'), ('moda'), ('oficina'), ('pan'), ('parque'), ('punto'), ('ruta'), ('sabor'), ('salud'),
      ('santander'), ('sierra'), ('sol'), ('taller'), ('tienda'), ('verde'), ('viva')
    ),
    complemento(valor) AS (VALUES
      ('andino'), ('artesanal'), ('bga'), ('bucaramanga'), ('central'), ('creativo'), ('directo'),
      ('digital'), ('delcampo'), ('delparque'), ('express'), ('fresco'), ('global'), ('local'), ('mas'),
      ('moderno'), ('natural'), ('norte'), ('nuevo'), ('online'), ('origen'), ('premium'), ('pro'),
      ('real'), ('ruitoque'), ('santander'), ('selecto'), ('sur'), ('total'), ('urbano'), ('verde'), ('vivo')
    ),
    extension(valor) AS (VALUES ('com'), ('com.co'), ('co'), ('net'))
    INSERT OR IGNORE INTO dominios_simulados (nombre)
    SELECT replace(nombre.valor,'ñ','n') || complemento.valor || '.' || extension.valor
    FROM nombre CROSS JOIN complemento CROSS JOIN extension;

    INSERT OR IGNORE INTO dominios_simulados (nombre) VALUES
      ('laesquina.com'), ('mundodigital.com'), ('puntoverde.com'), ('ruitoque.com'), ('la33.com'),
      ('elfogon.com'), ('sansilvestre.com'), ('panaderialamiga.com.co'), ('sintrabas.co'),
      ('cafeparque.com'), ('panaderiadelparque.com'), ('saborsantandereano.com'),
      ('lacocinacentral.com'), ('ferreteriacentral.com'), ('tiendadonpepe.com'), ('cafecentral.com.co');
  `,
};
