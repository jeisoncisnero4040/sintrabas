import { InvalidWorkspace, validateWorkspace, type WorkspaceState } from '../domain/workspace-state';

interface WorkspaceSnapshot {
  state: WorkspaceState | null;
  revision: number;
}

interface WorkspaceRepository {
  readWorkspace(userId: string): WorkspaceSnapshot;
  writeWorkspace(userId: string, state: WorkspaceState, revision: number): WorkspaceSnapshot | null;
}

export function createWorkspaceOperations({ readWorkspace, writeWorkspace }: WorkspaceRepository) {
  return {
    getWorkspace: readWorkspace,
    updateWorkspace(userId: string, input: Record<string, unknown>) {
      const { revision, state } = input;
      if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) throw new InvalidWorkspace();
      return writeWorkspace(userId, validateWorkspace(state), revision);
    },
  };
}
