import { createWorkspaceOperations } from './application/workspace';
import { readWorkspace, writeWorkspace } from './infrastructure/sqlite-workspace';

export const { getWorkspace, updateWorkspace } = createWorkspaceOperations({ readWorkspace, writeWorkspace });
