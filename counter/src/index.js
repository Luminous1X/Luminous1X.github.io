// The view counter behind the site's eye badge.
//
//   GET  /  → { "views": 123 }                    just reads the count
//   POST /  → { "views": 124, "counted": true }   adds one, then reads it
//
// The page sends the POST once per browser and a GET after that, so each visitor counts
// once. Only visits from the live site (COUNT_ORIGINS in wrangler.toml) are added; the
// other pages in READ_ORIGINS, like a local preview, can read the count but not change it.
// Nothing about visitors is stored: the database holds one number.

const COUNTER = 'views';

export default {
	async fetch(request, env) {
		const origin = request.headers.get('Origin') || '';
		const canCount = words(env.COUNT_ORIGINS).includes(origin);
		const canRead = canCount || words(env.READ_ORIGINS).includes(origin);

		const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
		if (canRead) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
		const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

		if (new URL(request.url).pathname !== '/') return reply({ error: 'not found' }, 404);

		switch (request.method) {
			case 'OPTIONS':
				return new Response(null, {
					status: 204,
					headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Max-Age': '86400' }
				});

			case 'GET':
				return reply({ views: await read(env) });

			case 'POST': {
				if (!canRead) return reply({ error: 'not allowed from here' }, 403);
				if (!canCount || !(await underLimit(request, env))) return reply({ views: await read(env), counted: false });
				const row = await env.DB.prepare(
					'INSERT INTO counters (name, n) VALUES (?1, 1) ON CONFLICT (name) DO UPDATE SET n = n + 1 RETURNING n'
				)
					.bind(COUNTER)
					.first();
				return reply({ views: row.n, counted: true });
			}

			default:
				return reply({ error: 'method not allowed' }, 405);
		}
	}
};

const words = (s) => String(s || '').split(/\s+/).filter(Boolean);

async function read(env) {
	const row = await env.DB.prepare('SELECT n FROM counters WHERE name = ?1').bind(COUNTER).first();
	return row ? row.n : 0;
}

// a handful of counted visits a minute from any one IP address, so a script hammering the
// counter can't run the number up quickly (the address is only checked, never stored)
async function underLimit(request, env) {
	if (!env.LIMITER) return true;
	const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
	const { success } = await env.LIMITER.limit({ key: ip });
	return success;
}
