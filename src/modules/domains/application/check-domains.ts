import { DomainName } from '../domain/domain-name';

interface DomainCatalog {
  findRegistered(names: string[]): Set<string>;
  catalogSize(): number;
}

export function createDomainChecks(catalog: DomainCatalog) {
  return (query: string | null) => {
    const name = DomainName.from(query);
    const variants = name.variants();
    const registered = catalog.findRegistered(variants);
    return {
      mode: 'simulation',
      catalogSize: catalog.catalogSize(),
      candidates: variants.map(domain => ({ domain, registered: registered.has(domain) })),
    };
  };
}
