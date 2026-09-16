import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TRACKER_URL = 'http://localhost:4173/tracker.js';
const blogs = [
	{ name: 'come-terry', siteId: 'e2e-come-terry', dir: process.env.E2E_BLOG_CT_DIR || path.resolve('../Come&Terry'), config: '.eleventy.js' },
	{ name: 'tilblog', siteId: 'e2e-tilblog', dir: process.env.E2E_BLOG_TIL_DIR || path.resolve('../TilBlog-TodayILearned'), config: 'eleventy.config.js' }
];

function filesIn(root) {
	if (!fs.existsSync(root)) return [];
	const files = [];
	for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const file = path.join(root, entry.name);
		if (entry.isDirectory()) files.push(...filesIn(file));
		else if (entry.isFile()) files.push(file);
	}
	return files;
}

function fingerprint(blog) {
	const hash = crypto.createHash('sha1');
	for (const file of [...filesIn(path.join(blog.dir, 'src')), path.join(blog.dir, 'package-lock.json'), path.join(blog.dir, blog.config)]) {
		if (fs.existsSync(file)) hash.update(path.relative(blog.dir, file)).update(fs.readFileSync(file));
	}
	return hash.update(TRACKER_URL).update(blog.siteId).digest('hex');
}

for (const blog of blogs) {
	if (!fs.existsSync(blog.dir)) throw new Error(`Missing ${blog.name} repository: ${blog.dir}`);
	if (!fs.existsSync(path.join(blog.dir, 'node_modules'))) throw new Error(`Missing ${blog.name}/node_modules. Run npm install in ${blog.dir}.`);
	const output = path.resolve(`.e2e/blogs/${blog.name}`);
	const stampFile = path.join(output, 'stamp.json');
	const hash = fingerprint(blog);
	let cached;
	try { cached = JSON.parse(fs.readFileSync(stampFile, 'utf8')).hash; } catch {}
	if (cached === hash && !process.env.E2E_REBUILD_BLOGS && fs.existsSync(path.join(output, 'dist/index.html'))) {
		console.log(`[cache] ${blog.name}`);
		continue;
	}
	console.log(`[build] ${blog.name}`);
	execFileSync('npm', ['run', 'build'], {
		cwd: blog.dir,
		stdio: 'inherit',
		env: { ...process.env, STATSMAN_SCRIPT_URL: TRACKER_URL, STATSMAN_SITE_ID: blog.siteId, STATSMAN_ALLOW_LOCALHOST: '1', ELEVENTY_ENV: 'production' }
	});
	const source = path.join(blog.dir, 'dist');
	const destination = path.join(output, 'dist');
	fs.rmSync(destination, { recursive: true, force: true });
	fs.mkdirSync(output, { recursive: true });
	fs.cpSync(source, destination, { recursive: true });
	const html = fs.readFileSync(path.join(destination, 'index.html'), 'utf8');
	if (!html.includes(`data-site="${blog.siteId}"`) || !html.includes(TRACKER_URL)) throw new Error(`${blog.name} output does not contain the E2E tracker configuration.`);
	fs.writeFileSync(stampFile, JSON.stringify({ hash, builtAt: new Date().toISOString() }, null, 2));
}
