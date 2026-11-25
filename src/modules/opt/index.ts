import { createOpt } from './application/lookup-opt';
import { sqliteOpt } from './infrastructure/sqlite-opt';

export const opt = createOpt(sqliteOpt);
