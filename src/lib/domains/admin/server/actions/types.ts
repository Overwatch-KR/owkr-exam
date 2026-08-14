import type { RequestEvent } from '@sveltejs/kit';

export type AdminAction = (event: RequestEvent) => Promise<unknown>;
