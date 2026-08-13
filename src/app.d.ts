// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
		namespace App {
				interface Locals {
						user: import('$lib/server/auth').User | null;
						isAdmin: boolean;
				}
		}
		namespace App {
				// interface Error {}
				// interface Locals {}
				// interface PageData {}
				// interface PageState {}
				// interface Platform {}
		}
}

export {};
