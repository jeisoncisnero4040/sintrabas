import { workspaceGet, workspacePut } from '@/modules/workspace/http/workspace-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = workspaceGet;
export const PUT = workspacePut;
