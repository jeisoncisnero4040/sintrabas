export type OptPrecision = 'centroide_predial' | 'referencia_del_prototipo';
export type OptPolygon = [number, number][][];

export interface OptMatch {
  address?: string;
  parcelCode?: string;
  activityArea?: string;
  urbanTreatment?: string;
  neighborhood?: string;
  commune?: string;
  precision: OptPrecision;
}

export class OptQueryError extends Error {}

export class OptQuery {
  readonly text: string;
  readonly parcelCode: string | null;
  readonly unitId?: string;

  constructor(input: Record<string, unknown>) {
    const { query, unitId, area, people } = input;
    if (typeof query !== 'string' || query.trim().length < 3 || query.length > 140) {
      throw new OptQueryError('Escribe la dirección completa o un código predial.');
    }
    if (unitId !== undefined && (typeof unitId !== 'string' || !/^\d{1,5}$/u.test(unitId))) {
      throw new OptQueryError('Selecciona una unidad de uso del catálogo municipal.');
    }
    if (area !== undefined && (typeof area !== 'number' || !Number.isFinite(area) || area <= 0)) {
      throw new OptQueryError('El área debe ser mayor que cero.');
    }
    if (people !== undefined && (typeof people !== 'number' || !Number.isSafeInteger(people) || people < 1)) {
      throw new OptQueryError('Ingresa un número entero positivo de personas.');
    }

    this.text = query.trim();
    this.unitId = unitId;
    const trimmedCode = this.text.replace(/[\s-]/gu, '');
    this.parcelCode = /^\d{15,30}$/u.test(trimmedCode) ? trimmedCode : null;
  }
}

export function containsPoint(polygon: OptPolygon, x: number, y: number): boolean {
  let inside = false;
  for (const ring of polygon) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [ax, ay] = ring[previous];
      const [bx, by] = ring[index];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
  }
  return inside;
}
