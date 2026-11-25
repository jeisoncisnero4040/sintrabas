import { createAllyApplications } from './application/applications';
import { listApplications, recordApplication } from './infrastructure/sqlite-applications';

export const { getAllyApplications, submitAllyApplication } = createAllyApplications({ listApplications, recordApplication });
