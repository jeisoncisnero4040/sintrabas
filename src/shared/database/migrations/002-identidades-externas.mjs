export const externalIdentities = {
  id: '002-identidades-externas',
  sql: `
    CREATE TABLE identidades_externas (
      proveedor TEXT NOT NULL CHECK (proveedor IN ('google', 'meta')),
      sujeto TEXT NOT NULL CHECK (length(sujeto) > 0),
      usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
      vinculada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (proveedor, sujeto),
      UNIQUE (usuario_id, proveedor)
    ) STRICT;

    CREATE TABLE oauth_flows (
      state_hash TEXT PRIMARY KEY CHECK (length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'),
      browser_hash TEXT NOT NULL CHECK (length(browser_hash) = 64 AND browser_hash NOT GLOB '*[^0-9a-f]*'),
      proveedor TEXT NOT NULL CHECK (proveedor IN ('google', 'meta')),
      intencion TEXT NOT NULL CHECK (intencion IN ('login', 'signup', 'link')),
      redirect_uri TEXT NOT NULL,
      verificador_pkce TEXT NOT NULL,
      nonce TEXT NOT NULL,
      consentimientos_json TEXT CHECK (consentimientos_json IS NULL OR json_valid(consentimientos_json)),
      link_session_hash TEXT CHECK (link_session_hash IS NULL OR (
        length(link_session_hash) = 64 AND link_session_hash NOT GLOB '*[^0-9a-f]*'
      )),
      expira_en TEXT NOT NULL,
      CHECK ((intencion = 'signup') = (consentimientos_json IS NOT NULL)),
      CHECK ((intencion = 'link') = (link_session_hash IS NOT NULL))
    ) STRICT;

    CREATE INDEX oauth_flows_expira_en ON oauth_flows (expira_en);
  `,
};
