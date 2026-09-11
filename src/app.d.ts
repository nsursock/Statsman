declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/db').User | null;
			isCloud: boolean;
			adminOk: boolean;
		}
	}
}

export {};
