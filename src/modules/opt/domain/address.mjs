const streetNames = {
  K: 'Carrera', C: 'Calle', A: 'Avenida', T: 'Transversal', D: 'Diagonal',
  BL: 'Bulevar', PJ: 'Pasaje', AU: 'Autopista',
};
const streetCodes = {
  CARRERA: 'K', CRA: 'K', CR: 'K', KRA: 'K', KR: 'K', K: 'K',
  CALLE: 'C', CLL: 'C', CL: 'C', C: 'C',
  AVENIDA: 'A', AVDA: 'A', AVE: 'A', AV: 'A', A: 'A',
  TRANSVERSAL: 'T', TRANSV: 'T', TRANS: 'T', TV: 'T', T: 'T',
  DIAGONAL: 'D', DIAG: 'D', DG: 'D', D: 'D',
  BULEVAR: 'BL', BOULEVARD: 'BL', BLV: 'BL', BLVD: 'BL', BL: 'BL', BV: 'BL',
  PASAJE: 'PJ', PJ: 'PJ', AUTOPISTA: 'AU', AUT: 'AU', AU: 'AU',
};
const suffixes = {
  BIS: 'BIS', OCC: 'OCC', OCCIDENTE: 'OCC', NORTE: 'N',
  PEATONAL: 'PEAT', PEAT: 'PEAT', OESTE: 'W', ESTE: 'E', SUR: 'S',
};

const number = token => /^\d+[A-Z]{0,4}$/u.test(token ?? '');
const suffix = token => suffixes[token] || (/^[A-Z]$/u.test(token ?? '') ? token : '');
const withoutLeadingZeros = value => value.replace(/^0+(?=\d)/u, '');
const complement = /\s+(?:AP|APTO|APARTAMENTO|BR|BARRIO|ED|EDIFICIO|INT|INTERIOR|TORRE|OF|OFICINA|LOC|LOCAL|PISO|CASA|BLOQUE|BLQ|CONJ|CONJUNTO)(?:\s|$)/u;

export function parseOptAddress(input) {
  const tokens = input.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^0-9A-Z ]/gu, ' ').replace(/^([A-Z]+)(?=\d)/u, '$1 ')
    .replace(/\s+/gu, ' ').trim().split(complement, 1)[0].split(' ')
    .filter(token => token && !['NO', 'NRO', 'NUM', 'NUMERO'].includes(token));
  const street = streetCodes[tokens.shift()];
  if (!street) return null;

  function readNumber() {
    if (!number(tokens[0])) return '';
    let part = withoutLeadingZeros(tokens.shift());
    while (suffix(tokens[0])) part += suffix(tokens.shift());
    return part;
  }

  let route;
  if (number(tokens[0])) {
    route = street + readNumber();
  } else {
    const name = [];
    while (tokens.length && !number(tokens[0])) name.push(tokens.shift());
    if (!name.length) return null;
    route = street + ':' + name.join(' ');
  }

  const cross = readNumber();
  if (!cross) return null;
  if (tokens.length === 0) return { route, cross, plate: '' };
  if (tokens.length !== 1 || !/^\d{1,4}[A-Z]?$/u.test(tokens[0])) return null;
  return { route, cross, plate: withoutLeadingZeros(tokens[0]) };
}

export function formatOptAddress(route, cross, plate) {
  const parts = /^(BL|PJ|AU|[KCATD])(?::(.+)|(.+))$/u.exec(route);
  if (!parts) return route + ' # ' + cross + '-' + plate;
  const title = parts[2]?.toLowerCase().replace(/\b\p{L}/gu, char => char.toUpperCase()) ?? parts[3];
  return streetNames[parts[1]] + ' ' + title + ' # ' + cross + ' - ' + plate;
}

export function cadastralCodeVariants(code) {
  if (code.length === 15) return [code, '68001' + code];
  if (code.length === 20 && code.startsWith('68001')) return [code, code.slice(5)];
  return [code];
}
