import { OptQuery, OptQueryError, type OptMatch } from '../domain/opt';
import { cadastralSource, potSource } from '../domain/sources.mjs';

export interface OptUnit {
  id: string;
  label: string;
}

export interface OptInventory {
  dataDate: string | null;
  counts: { parcels: number; zones: number; addresses: number; cadastralAddresses: number; units: number };
}

export interface OptRepository {
  inventory(): OptInventory;
  units(): OptUnit[];
  unit(unitId: string): OptUnit | undefined;
  findParcel(code: string): OptMatch[];
  findAddress(address: string): OptMatch[];
}

function isReady(inventory: OptInventory) {
  const { parcels, addresses, cadastralAddresses, units } = inventory.counts;
  return units > 0 && (parcels > 0 || addresses > 0 || cadastralAddresses > 0);
}

export function createOpt(repository: OptRepository) {
  return {
    catalog() {
      const inventory = repository.inventory();
      return {
        status: isReady(inventory) ? 'ready' : 'not_imported',
        units: repository.units(),
        counts: inventory.counts,
        source: { ...potSource, dataDate: inventory.dataDate, addressUrl: cadastralSource.url },
      };
    },
    lookup(input: Record<string, unknown>) {
      const query = new OptQuery(input);
      const inventory = repository.inventory();
      const source = { ...potSource, dataDate: inventory.dataDate, addressUrl: cadastralSource.url };
      const { parcels, addresses, cadastralAddresses } = inventory.counts;
      if (!cadastralAddresses && !(query.parcelCode ? parcels : addresses)) {
        return {
          status: 'not_imported',
          validated: false,
          matches: [],
          source,
          message: 'El catálogo para este tipo de búsqueda aún no está disponible en SINTRABAS. Puedes consultar el visor municipal.',
        };
      }
      const unit = query.unitId ? repository.unit(query.unitId) : undefined;
      if (query.unitId && !unit) throw new OptQueryError('Selecciona una unidad de uso del catálogo municipal.');
      const matches = query.parcelCode ? repository.findParcel(query.parcelCode) : repository.findAddress(query.text);
      const status = matches.length === 0 ? 'not_found'
        : !matches.some(match => match.validated) ? 'reference'
        : matches.length > 1 || (!query.parcelCode && !query.completeAddress) ? 'ambiguous' : 'found';
      const message = {
        not_found: 'No se pudo validar en el catálogo disponible. Revisa la dirección o prueba con el código predial.',
        reference: 'La dirección aparece en el índice de referencia de SINTRABAS. Para validarla en el catálogo, consulta su código predial en el visor municipal.',
        ambiguous: 'Selecciona la dirección y el código de tu predio. Si tienes el código exacto, puedes buscarlo directamente.',
        found: 'Coincide con el catálogo consultado. El concepto sobre el uso de la actividad se solicita en la Alcaldía.',
      }[status];
      return { status, validated: status === 'found', matches, source, message, ...(unit ? { unit } : {}) };
    },
  };
}
