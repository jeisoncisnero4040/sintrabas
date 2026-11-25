export class InvalidWorkspace extends Error {}

const businesses = ['restaurante', 'tienda', 'ropa', 'servicios', 'belleza', 'taller', 'produccion', 'digital',
  'bar', 'panaderia', 'gimnasio', 'salud', 'educacion', 'hotel', 'droguería', 'mascotas', 'transporte', 'construccion'];
const locations = ['cabecera', 'centro', 'sotomayor', 'norte', 'floridablanca', 'sinlocal', 'buscando', 'predio'];
const procedures = ['rut', 'suelo', 'homonimia', 'matricula', 'sas', 'ica', 'bomberos', 'sayco', 'sanitario',
  'manipulacion', 'invima', 'planilla', 'factura', 'renovacion', 'licor', 'rnt', 'habilitacion'];

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InvalidWorkspace();
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new InvalidWorkspace();
  return value.trim();
}

function option(value: unknown, values: readonly string[]): string {
  if (typeof value !== 'string' || !values.includes(value)) throw new InvalidWorkspace();
  return value;
}

function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new InvalidWorkspace();
  return value;
}

function optionalNumber(value: unknown, max: number, integer = false) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max || (integer && !Number.isInteger(value))) {
    throw new InvalidWorkspace();
  }
  return value;
}

export function validateWorkspace(value: unknown) {
  const input = record(value);
  const source = record(input.diagnosis);
  const diagnosis = {
    business: option(source.business, ['', ...businesses]),
    name: text(source.name, 120),
    location: option(source.location, ['', ...locations]),
    address: text(source.address, 160),
    parcelCode: text(source.parcelCode ?? '', 64),
    optUnitId: text(source.optUnitId ?? '', 24),
    optArea: optionalNumber(source.optArea, 1000000),
    optPeople: optionalNumber(source.optPeople, 100000, true),
    optChecked: source.optChecked === true,
    legalForm: option(source.legalForm, ['', 'natural', 'sas', 'nose']),
    people: option(source.people, ['1', '2-5', '6-20', '20+']),
    area: option(source.area, ['s', 'm', 'l']),
    financing: option(source.financing, ['si', 'no']),
  };
  const { step, finalized } = input;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > 5 || typeof finalized !== 'boolean') {
    throw new InvalidWorkspace();
  }
  if (finalized && (!diagnosis.business || diagnosis.name.length < 3 || !diagnosis.location || !diagnosis.legalForm)) {
    throw new InvalidWorkspace();
  }
  if (finalized && diagnosis.location === 'predio' && diagnosis.address.length < 5) throw new InvalidWorkspace();
  const completed = [...new Set(list(input.completed, procedures.length).map(id => option(id, procedures)))];
  const activities = list(input.activities, 20).map(item => {
    const row = record(item);
    const kind = option(row.kind, ['aliado', 'apoyo', 'financiacion', 'postulacion']);
    const label = text(row.label, 140);
    const note = text(row.note, 250);
    const at = text(row.at, 30);
    if (!label || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(at) || !Number.isFinite(Date.parse(at))) {
      throw new InvalidWorkspace();
    }
    return { kind, label, note, at };
  });

  return { diagnosis, step, finalized, completed, activities };
}

export type WorkspaceState = ReturnType<typeof validateWorkspace>;
