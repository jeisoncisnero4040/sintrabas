# Dominios

El módulo consulta un catálogo SQLite de dominios registrados simulados. La migración 005 combina nombres y extensiones y agrega los ejemplos que usaba el diagnóstico original. Los resultados ilustran el flujo del MVP y no confirman disponibilidad real.

| Capa | Responsabilidad |
| --- | --- |
| `domain/` | Normaliza el nombre y crea sus variantes. |
| `application/` | Compara las variantes con el catálogo. |
| `infrastructure/` | Consulta SQLite con parámetros. |
| `http/` | Verifica la sesión y responde a `GET /api/v1/dominios?q=nombre`. |
