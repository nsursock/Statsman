import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

async function portOpen(port) {
	return new Promise((resolve) => {
		const socket = net.connect({ host: '127.0.0.1', port });
		socket.once('connect', () => { socket.destroy(); resolve(true); });
		socket.once('error', () => resolve(false));
	});
}

for (const port of [4173, 4174]) {
	if (await portOpen(port)) throw new Error(`Port ${port} is already in use. Stop the stale Statsman E2E server before resetting its database.`);
}

const dir = path.resolve('.e2e');
fs.mkdirSync(dir, { recursive: true });
for (const name of ['selfhost.db', 'cloud.db']) {
	for (const suffix of ['', '-shm', '-wal']) fs.rmSync(path.join(dir, name + suffix), { force: true });
}
console.log('Reset E2E databases; retained cached blog builds.');
