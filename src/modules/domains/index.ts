import { createDomainChecks } from './application/check-domains';
import { catalogSize, findRegistered } from './infrastructure/sqlite-domain-catalog';

export const checkDomains = createDomainChecks({ catalogSize, findRegistered });
