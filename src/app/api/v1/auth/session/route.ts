import { sessionHandler } from '@/modules/identity/http/auth-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = sessionHandler;
