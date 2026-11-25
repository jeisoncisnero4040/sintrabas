import { applicationsGet, applicationsPost } from '@/modules/aliados/http/handlers';

export const runtime = 'nodejs';
export const GET = applicationsGet;
export const POST = applicationsPost;
