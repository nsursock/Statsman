import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const mappings = [
	[4181, path.resolve('.e2e/blogs/come-terry/dist')],
	[4182, path.resolve('.e2e/blogs/tilblog/dist')],
	[4183, path.resolve('tests/e2e/fixtures/tracker-lab')]
];
const mimes = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

for (const [port, root] of mappings) {
	http.createServer((request, response) => {
		const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
		const relative = pathname.replace(/^\/+/, '');
		const candidates = pathname.endsWith('/')
			? [path.join(root, relative, 'index.html')]
			: [path.join(root, relative), path.join(root, relative, 'index.html'), path.join(root, `${relative}.html`)];
		const file = candidates.find((candidate) => candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile());
		if (!file) {
			response.writeHead(404, { 'Content-Type': 'text/plain' });
			response.end('Not found');
			return;
		}
		response.writeHead(200, { 'Content-Type': mimes[path.extname(file)] ?? 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
		createReadStream(file).pipe(response);
	}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on ${port}`));
}
