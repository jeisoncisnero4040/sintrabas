import { oauthStartHandler } from '@/modules/identity/http/auth-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = oauthStartHandler;
