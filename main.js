// The page: a starfield where the icon gathers out of drifting stars, then an orbit of
// sections and links opens around it. Everything it says comes from content.js.

(() => {
	'use strict';

	const SITE = window.SITE;
	const GLYPHS = window.GLYPHS;
	const TAU = Math.PI * 2;

	// ------------------------------------------------------------ helpers

	const $ = (selector) => document.querySelector(selector);
	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	const lerp = (a, b, t) => a + (b - a) * t;
	const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
	const easeOut = (t) => 1 - (1 - t) ** 3;
	const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
	const esc = (s) =>
		String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

	const root = document.documentElement;
	root.style.setProperty('--accent', SITE.accent);
	const css = getComputedStyle(root);
	const FG = css.getPropertyValue('--fg').trim() || '#f1f1f4';
	const MID = css.getPropertyValue('--mid').trim() || '#8b8b9c';
	const ACCENT = SITE.accent;

	/** '#abc' or '#aabbcc' at some alpha */
	function rgba(hex, a) {
		let h = hex.replace('#', '');
		if (h.length === 3) h = [...h].map((c) => c + c).join('');
		const n = parseInt(h, 16);
		return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
	}

	const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
	let still = motionQuery.matches;

	// ------------------------------------------------------------ pixel art

	const TONES = { o: '#000', '#': 'var(--fg)', '+': 'var(--mid)', '*': 'var(--accent)' };
	const GLOW_TONES = { '#': 'var(--fg)', '+': 'var(--fg)', '*': 'var(--accent)' };
	const PIXEL = { o: '#000', '#': FG, '+': MID, '*': ACCENT };

	/** a pixel grid as an SVG, one path per color, neighbouring cells merged into runs */
	function gridSvg(rows, tones) {
		const width = Math.max(...rows.map((r) => r.length));
		const paths = {};
		rows.forEach((row, y) => {
			for (let x = 0; x < row.length; ) {
				const ch = row[x];
				let w = 1;
				while (row[x + w] === ch) w++;
				if (tones[ch]) paths[ch] = (paths[ch] || '') + `M${x} ${y}h${w}v1h-${w}z`;
				x += w;
			}
		});
		const body = Object.entries(paths)
			.map(([ch, d]) => `<path style="fill:${tones[ch]}" d="${d}"/>`)
			.join('');
		return `<svg viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
	}
	const glyphSvg = (name) => gridSvg(GLYPHS[name] || GLYPHS.globe, TONES);

	const ICON = SITE.icon;
	const ICON_W = Math.max(...ICON.map((r) => r.length));
	const ICON_H = ICON.length;
	const pixels = [];
	ICON.forEach((row, y) => [...row].forEach((ch, x) => PIXEL[ch] && pixels.push({ x, y, ch })));

	// ------------------------------------------------------------ text, icon, favicon

	document.title = SITE.name;
	document.querySelector('meta[name="description"]')?.setAttribute('content', `${SITE.name}: ${SITE.tagline}`);

	$('#name').innerHTML =
		`<span class="sr-only">${esc(SITE.name)}</span>` +
		[...SITE.name]
			.map((ch, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`)
			.join('');
	$('#tagline').textContent = SITE.tagline;
	$('#hint').textContent = SITE.hint;

	const iconEl = $('#icon');
	iconEl.querySelector('.pixels').innerHTML = gridSvg(ICON, TONES);
	iconEl.querySelector('.halo').innerHTML = gridSvg(ICON, GLOW_TONES);
	const shiny = pixels.filter((p) => p.ch === '#' || p.ch === '*');
	iconEl.querySelector('.glints').innerHTML = Array.from({ length: 7 }, () => {
		const p = shiny[Math.floor(Math.random() * shiny.length)];
		const period = 2.4 + Math.random() * 2.8;
		return `<i class="glint" style="left:${((p.x + 0.5) / ICON_W) * 100}%;top:${((p.y + 0.5) / ICON_H) * 100}%;--p:${period.toFixed(2)}s;--d:${(Math.random() * period).toFixed(2)}s"></i>`;
	}).join('');

	{
		const size = 64;
		const c = document.createElement('canvas');
		c.width = c.height = size;
		const g = c.getContext('2d');
		const cell = Math.floor(size / Math.max(ICON_W, ICON_H));
		const ox = Math.floor((size - cell * ICON_W) / 2);
		const oy = Math.floor((size - cell * ICON_H) / 2);
		for (const p of pixels) {
			g.fillStyle = PIXEL[p.ch];
			g.fillRect(ox + p.x * cell, oy + p.y * cell, cell, cell);
		}
		const link = document.createElement('link');
		link.rel = 'icon';
		link.href = c.toDataURL();
		document.head.append(link);
	}

	// ------------------------------------------------------------ things in orbit

	const RING_SPEED = [0.2, 0.12]; // radians per second, inner and outer
	const sections = SITE.sections.map((s) => ({ ...s, ring: 0 }));
	const links = SITE.socials.map((s) => ({ ...s, ring: 1 }));
	const sats = [];
	const hovered = new Set();
	let focused = null;
	let windowOpen = false;

	[...sections, ...links].forEach((item, order) => {
		const isSection = item.ring === 0;
		const copy = !isSection && item.copy ? String(item.copy) : '';
		const empty = !isSection && !copy && !item.url;
		const isLink = !isSection && !copy && !empty;
		const isMail = /^mailto:/i.test(item.url || '');
		const el = document.createElement(isLink ? 'a' : 'button');
		el.className = 'sat' + (empty ? ' empty' : '');
		if (isLink) {
			el.href = item.url;
			if (!isMail) {
				el.target = '_blank';
				el.rel = 'me noopener';
			}
		} else {
			el.type = 'button';
		}
		const note = empty ? 'add link' : copy ? 'copy' : '';
		el.innerHTML =
			glyphSvg(item.glyph) +
			`<span class="label" aria-hidden="true">${esc(item.label)}${note ? `<small>· ${note}</small>` : ''}</span>`;
		el.setAttribute(
			'aria-label',
			isSection
				? `${item.label}, opens a window`
				: copy
					? `${item.label}: copy ${copy}`
					: empty
						? `${item.label}, no link yet`
						: isMail
							? `${item.label}`
							: `${item.label}, opens in a new tab`
		);
		if (empty) el.setAttribute('aria-disabled', 'true');

		const ring = isSection ? sections : links;
		const i = ring.indexOf(item);
		const base = isSection ? -Math.PI / 2 + (i / ring.length) * TAU : Math.PI / 5 + (i / ring.length) * TAU;
		const sat = { el, ring: item.ring, base, order, shown: false, z: 0, trail: [], x: 0, y: 0 };
		sats.push(sat);

		el.addEventListener('click', (e) => {
			if (isSection) openWindow(item);
			else if (copy) copyAndTell(item, copy, sat);
			else if (empty) e.preventDefault();
		});
		el.addEventListener('pointerenter', () => hovered.add(el));
		el.addEventListener('pointerleave', () => hovered.delete(el));
		el.addEventListener('focus', () => {
			if (el.matches(':focus-visible')) focused = el;
		});
		el.addEventListener('blur', () => {
			if (focused === el) focused = null;
		});
		$('#orbit').append(el);
	});

	// ------------------------------------------------------------ layout

	const canvas = $('#sky');
	const ctx = canvas.getContext('2d');
	const stage = $('#stage');
	const L = {};

	function layout() {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		Object.assign(L, { vw, vh, dpr });
		canvas.width = Math.round(vw * dpr);
		canvas.height = Math.round(vh * dpr);

		const narrow = vw < 700;
		const tall = vh > vw * 1.4;
		L.tilt = -0.2;
		// phones held upright have height to spare, so the orbit opens up more
		L.flatten = narrow ? (tall ? 0.6 : 0.5) : 0.36;
		L.cell = clamp(Math.round(Math.min(vw, vh * 1.2) / (narrow ? 95 : 125)), 3, 7);
		L.iconW = ICON_W * L.cell;
		L.iconH = ICON_H * L.cell;
		L.sat = narrow ? 36 : 44;
		L.nameSize = Math.round(clamp(Math.min(vw * 0.075, vh * 0.08), 30, 64));
		L.tagSize = Math.round(clamp(Math.min(vw * 0.032, vh * 0.034), 18, 24));

		const titleH = L.nameSize + L.tagSize * 1.25 + 54;
		const gap = L.sat * 0.5 + 26;
		// how far up and down the tilted, flattened orbit reaches, per pixel of radius
		const reach = Math.hypot(Math.sin(L.tilt), L.flatten * Math.cos(L.tilt));
		let outer = Math.min(vw / 2 - L.sat * 0.75 - 10, 520);
		// leave room above the top of the orbit for the hover labels
		outer = Math.min(outer, (vh - titleH - gap - L.sat - 96) / (2 * reach));
		const inner = Math.max(L.iconW / 2 + L.sat * 0.6 + 8, outer * 0.62);
		outer = Math.max(outer, inner + L.sat * 0.9);
		L.radii = [inner, outer];
		L.half = outer * reach;

		const total = L.half * 2 + gap + titleH;
		L.cx = Math.round(vw / 2);
		L.cy = Math.round(Math.max(L.half + L.sat, (vh - total) / 2 + L.half));
		L.iconX = Math.round(L.cx - L.iconW / 2);
		L.iconY = Math.round(L.cy - L.iconH / 2);

		const titleY = L.iconY + L.iconH + 20;
		const titleOpenY = L.cy + L.half + gap;
		const vars = {
			'--cell': `${L.cell}px`,
			'--icon-x': `${L.iconX}px`,
			'--icon-y': `${L.iconY}px`,
			'--icon-w': `${L.iconW}px`,
			'--icon-h': `${L.iconH}px`,
			'--sat': `${L.sat}px`,
			'--name-size': `${L.nameSize}px`,
			'--tag-size': `${L.tagSize}px`,
			'--title-y': `${Math.round(titleY)}px`,
			'--slide': `${Math.round(Math.max(0, titleOpenY - titleY))}px`
		};
		for (const [k, v] of Object.entries(vars)) stage.style.setProperty(k, v);

		makeStars();
		makeDust();
	}

	/** a point on a ring, plus how near it is: -1 far side … 1 near side */
	function orbitPoint(r, angle) {
		const X = r * Math.cos(angle);
		const Y = r * L.flatten * Math.sin(angle);
		const c = Math.cos(L.tilt);
		const s = Math.sin(L.tilt);
		return [L.cx + X * c - Y * s, L.cy + X * s + Y * c];
	}

	// ------------------------------------------------------------ the sky

	// one soft dot, stamped for every glowing star
	const glow = document.createElement('canvas');
	glow.width = glow.height = 64;
	{
		const g = glow.getContext('2d');
		const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		grad.addColorStop(0, rgba(FG, 1));
		grad.addColorStop(0.2, rgba(FG, 0.45));
		grad.addColorStop(0.5, rgba(FG, 0.1));
		grad.addColorStop(1, rgba(FG, 0));
		g.fillStyle = grad;
		g.fillRect(0, 0, 64, 64);
	}

	let stars = [];
	function makeStars() {
		const count = Math.min(750, Math.round((L.vw * L.vh) / 2400));
		stars = Array.from({ length: count }, () => {
			const big = Math.random() < 0.06;
			return {
				x: Math.random() * L.vw,
				y: Math.random() * L.vh,
				size: big ? 2 : Math.random() < 0.3 ? 1.5 : 1,
				a: big ? 0.65 + Math.random() * 0.35 : 0.1 + Math.random() * 0.5,
				speed: 0.5 + Math.random() * 2.2,
				phase: Math.random() * TAU,
				depth: 0.2 + Math.random() * 0.8,
				big
			};
		});
	}

	const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };
	window.addEventListener(
		'pointermove',
		(e) => {
			mouse.x = e.clientX / L.vw;
			mouse.y = e.clientY / L.vh;
		},
		{ passive: true }
	);

	function drawStars(t) {
		const px = still ? 0 : (mouse.sx - 0.5) * -14;
		const py = still ? 0 : (mouse.sy - 0.5) * -10;
		ctx.fillStyle = FG;
		for (const s of stars) {
			const tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
			const x = s.x + px * s.depth;
			const y = s.y + py * s.depth;
			ctx.globalAlpha = s.a * tw;
			if (s.big) {
				ctx.drawImage(glow, x - 8, y - 8, 16, 16);
				// a little cross flare right at the top of the twinkle
				const flare = still ? 0 : clamp((tw - 0.9) / 0.1, 0, 1);
				if (flare > 0) {
					const len = 7 * flare;
					ctx.fillRect(x - len, y - 0.5, len * 2, 1);
					ctx.fillRect(x - 0.5, y - len, 1, len * 2);
				}
			}
			ctx.fillRect(Math.round(x - s.size / 2), Math.round(y - s.size / 2), s.size, s.size);
		}
		ctx.globalAlpha = 1;
	}

	const meteors = [];
	let nextMeteor = 3 + Math.random() * 4;
	function drawMeteors(t) {
		if (still) return;
		if (t > nextMeteor) {
			const dir = Math.random() < 0.5 ? 1 : -1;
			const angle = 0.25 + Math.random() * 0.4;
			meteors.push({
				x: dir > 0 ? Math.random() * L.vw * 0.6 : L.vw * (0.4 + Math.random() * 0.6),
				y: Math.random() * L.vh * 0.4,
				dx: Math.cos(angle) * dir,
				dy: Math.sin(angle),
				speed: 650 + Math.random() * 450,
				born: t,
				life: 0.7 + Math.random() * 0.5
			});
			nextMeteor = t + 4 + Math.random() * 9;
		}
		for (let i = meteors.length - 1; i >= 0; i--) {
			const m = meteors[i];
			const age = t - m.born;
			if (age > m.life) {
				meteors.splice(i, 1);
				continue;
			}
			const p = age / m.life;
			const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
			const hx = m.x + m.dx * m.speed * age;
			const hy = m.y + m.dy * m.speed * age;
			const len = Math.min(age * m.speed, 110);
			const grad = ctx.createLinearGradient(hx - m.dx * len, hy - m.dy * len, hx, hy);
			grad.addColorStop(0, rgba(FG, 0));
			grad.addColorStop(1, rgba(FG, 0.9 * a));
			ctx.strokeStyle = grad;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(hx - m.dx * len, hy - m.dy * len);
			ctx.lineTo(hx, hy);
			ctx.stroke();
			ctx.globalAlpha = a;
			ctx.drawImage(glow, hx - 6, hy - 6, 12, 12);
			ctx.globalAlpha = 1;
		}
	}

	// ------------------------------------------------------------ the icon gathering

	// every pixel of the icon starts as a star somewhere on screen and spirals into place
	const flock = pixels.map((p) => ({
		...p,
		sx: Math.random(),
		sy: Math.random(),
		delay: 0.25 + Math.random() * 1.1,
		dur: 1.4 + Math.random() * 0.9,
		spin: 0.8 + Math.random() * 0.9
	}));
	const FORMED = Math.max(...flock.map((q) => q.delay + q.dur));
	const OPEN = FORMED + 0.7;
	const LAUNCH = 1.1;
	const SETTLED = OPEN + 0.15 + sats.length * 0.12 + LAUNCH;

	function drawFormation(t) {
		const { cx, cy, cell } = L;
		for (const q of flock) {
			const k = clamp((t - q.delay) / q.dur, 0, 1);
			const sx = q.sx * L.vw;
			const sy = q.sy * L.vh;
			const tx = L.iconX + (q.x + 0.5) * cell;
			const ty = L.iconY + (q.y + 0.5) * cell;
			const a0 = Math.atan2(sy - cy, sx - cx);
			const a1 = Math.atan2(ty - cy, tx - cx);
			// always turn the same way, by at least `spin`, and land exactly on the pixel
			let turn = (((a1 - a0) % TAU) + TAU) % TAU;
			if (turn < q.spin) turn += TAU;
			const e = easeInOut(k);
			const angle = a0 + turn * e;
			const r = lerp(Math.hypot(sx - cx, sy - cy), Math.hypot(tx - cx, ty - cy), e);
			const x = cx + Math.cos(angle) * r;
			const y = cy + Math.sin(angle) * r;

			const appear = clamp((t - q.delay * 0.4) / 0.5, 0, 1);
			const land = clamp((k - 0.82) / 0.18, 0, 1);
			if (land < 1) {
				ctx.globalAlpha = 0.85 * appear * (1 - land);
				ctx.drawImage(glow, x - 7, y - 7, 14, 14);
				ctx.fillStyle = FG;
				ctx.fillRect(x - 1, y - 1, 2, 2);
			}
			if (land > 0) {
				const s = cell * land;
				ctx.globalAlpha = 1;
				ctx.fillStyle = PIXEL[q.ch];
				ctx.fillRect(x - s / 2, y - s / 2, s, s);
			}
		}
		ctx.globalAlpha = 1;
	}

	// ------------------------------------------------------------ the orbit

	let dust = [];
	function makeDust() {
		dust = [];
		L.radii.forEach((r, ring) => {
			const count = Math.round(r / 3.2);
			for (let i = 0; i < count; i++)
				dust.push({
					ring,
					angle: Math.random() * TAU,
					off: gauss() * (ring ? 9 : 6),
					size: Math.random() < 0.2 ? 1.5 : 1,
					a: 0.15 + Math.random() * 0.45,
					speed: 1 + Math.random() * 2.5,
					phase: Math.random() * TAU,
					drift: 0.75 + Math.random() * 0.3
				});
		});
	}

	let orbitClock = 0;

	function drawOrbit(t) {
		const grow = still ? 1 : easeOut(clamp((t - OPEN) / 1.4, 0, 1));
		if (grow <= 0) return;

		ctx.save();
		ctx.translate(L.cx, L.cy);
		ctx.rotate(L.tilt);
		ctx.setLineDash([2, 7]);
		ctx.lineWidth = 1;
		ctx.strokeStyle = rgba(FG, 0.16 * grow);
		L.radii.forEach((r, ring) => {
			ctx.lineDashOffset = (ring ? 1 : -1) * orbitClock * 6;
			ctx.beginPath();
			ctx.ellipse(0, 0, r * grow, r * L.flatten * grow, 0, 0, TAU);
			ctx.stroke();
		});
		ctx.restore();

		ctx.fillStyle = FG;
		for (const d of dust) {
			const angle = d.angle + orbitClock * RING_SPEED[d.ring] * d.drift;
			const [x, y] = orbitPoint((L.radii[d.ring] + d.off) * grow, angle);
			const near = (Math.sin(angle) + 1) / 2;
			const tw = still ? 0.8 : 0.6 + 0.4 * Math.sin(t * d.speed + d.phase);
			ctx.globalAlpha = d.a * tw * grow * (0.5 + 0.5 * near);
			ctx.fillRect(x - d.size / 2, y - d.size / 2, d.size, d.size);
		}
		ctx.globalAlpha = 1;
	}

	function updateSats(t) {
		for (const s of sats) {
			const start = OPEN + 0.15 + s.order * 0.12;
			const k = clamp((t - start) / LAUNCH, 0, 1);
			if (k <= 0) continue;
			if (!s.shown) {
				s.el.style.visibility = 'visible';
				s.shown = true;
			}
			// spiral out of the icon, unwinding onto the ring
			const e = easeOut(k);
			const angle = s.base + orbitClock * RING_SPEED[s.ring] - (1 - e) * 2.2;
			const [x, y] = orbitPoint(L.radii[s.ring] * e, angle);
			const depth = Math.sin(angle);
			const scale = (0.86 + 0.16 * depth) * (0.35 + 0.65 * e);
			const opacity = (0.6 + 0.2 * (depth + 1)) * clamp(k * 3, 0, 1);
			s.x = x;
			s.y = y;
			s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
			s.el.style.opacity = opacity.toFixed(3);
			const z = depth >= 0 ? 30 : 10;
			if (z !== s.z) {
				s.el.style.zIndex = z;
				s.z = z;
			}

			// a short trail while it flies out, which then fades away
			if (k < 1) {
				s.trail.push([x, y]);
				if (s.trail.length > 14) s.trail.shift();
			} else if (s.trail.length) {
				s.trail.shift();
			}
			ctx.fillStyle = FG;
			s.trail.forEach(([tx, ty], j) => {
				ctx.globalAlpha = ((j + 1) / s.trail.length) * 0.5;
				ctx.fillRect(tx - 1, ty - 1, 2, 2);
			});
			ctx.globalAlpha = 1;
		}
	}

	// ------------------------------------------------------------ copying, with a little note

	const CHECK = ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'];
	const toastEl = $('#toast');
	let toastTimer = 0;

	async function copyText(text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {}
		// older browsers, or no clipboard permission: the select-and-copy fallback
		const back = document.activeElement;
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
		document.body.append(area);
		area.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {}
		area.remove();
		back?.focus?.({ preventScroll: true });
		return ok;
	}

	function showToast(glyph, title, value, ok) {
		toastEl.innerHTML =
			glyphSvg(glyph) +
			`<span class="toast-text"><span class="toast-title">${ok ? gridSvg(CHECK, { '#': 'var(--accent)' }) : ''}${esc(title)}</span><span class="toast-value">${esc(value)}</span></span>`;
		// if it couldn't copy, leave it up longer so the text can be selected by hand
		toastEl.classList.toggle('manual', !ok);
		toastEl.classList.remove('show');
		void toastEl.offsetWidth; // restarts the pop-in when one is already showing
		toastEl.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toastEl.classList.remove('show'), ok ? 2600 : 8000);
	}

	async function copyAndTell(item, text, sat) {
		const ok = await copyText(text);
		if (ok) burst(sat.x, sat.y);
		showToast(item.glyph, ok ? item.toast || `${item.label} copied` : "Couldn't copy, here it is", text, ok);
	}

	// a little burst of pixels from whatever got copied
	const sparks = [];
	function burst(x, y) {
		if (still) return;
		const born = now();
		for (let i = 0; i < 16; i++) {
			const angle = Math.random() * TAU;
			const speed = 60 + Math.random() * 110;
			sparks.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				born,
				life: 0.45 + Math.random() * 0.45,
				accent: Math.random() < 0.4
			});
		}
	}

	function drawSparks(t) {
		for (let i = sparks.length - 1; i >= 0; i--) {
			const p = sparks[i];
			const age = t - p.born;
			if (age > p.life) {
				sparks.splice(i, 1);
				continue;
			}
			const d = (1 - Math.exp(-3 * age)) / 3; // they slow down as they fly out
			ctx.globalAlpha = 1 - age / p.life;
			ctx.fillStyle = p.accent ? ACCENT : FG;
			ctx.fillRect(p.x + p.vx * d - 1, p.y + p.vy * d - 1, 2, 2);
		}
		ctx.globalAlpha = 1;
	}

	// ------------------------------------------------------------ windows

	const win = $('#window');
	const winBody = $('#window-body');

	function openWindow(item) {
		if (win.open) return;
		$('#window-title').textContent = item.title || item.label;
		win.querySelector('.bar-glyph').innerHTML = glyphSvg(item.glyph);
		winBody.innerHTML = item.body || '';
		[...winBody.children].forEach((el, i) => el.style.setProperty('--k', i));
		if (item.repos) showRepos();
		winBody.scrollTop = 0;
		win.classList.remove('closing');
		win.showModal();
		windowOpen = true;
	}

	function closeWindow() {
		if (!win.open || win.classList.contains('closing')) return;
		if (still) return win.close();
		win.classList.add('closing');
		setTimeout(() => {
			win.classList.remove('closing');
			win.close();
		}, 160);
	}

	win.querySelector('.close').addEventListener('click', closeWindow);
	win.addEventListener('click', (e) => {
		if (e.target === win) closeWindow(); // a click on the backdrop
	});
	win.addEventListener('cancel', (e) => {
		e.preventDefault();
		closeWindow();
	});
	win.addEventListener('close', () => {
		windowOpen = false;
	});

	const LANG_COLORS = {
		'C++': '#f34b7d',
		C: '#a8b9cc',
		'C#': '#178600',
		Python: '#3572a5',
		JavaScript: '#f1e05a',
		TypeScript: '#3178c6',
		Rust: '#dea584',
		Go: '#00add8',
		Java: '#b07219',
		Lua: '#6b6bff',
		HTML: '#e34c26',
		CSS: '#663399',
		Shell: '#89e051',
		Kotlin: '#a97bff',
		Swift: '#f05138'
	};

	function ago(iso) {
		const seconds = (new Date(iso) - Date.now()) / 1000;
		const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
		const units = [
			['year', 31536000],
			['month', 2592000],
			['week', 604800],
			['day', 86400],
			['hour', 3600],
			['minute', 60]
		];
		for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
		return 'just now';
	}

	let repos = null;
	async function fetchRepos() {
		if (repos) return repos;
		try {
			const cached = JSON.parse(sessionStorage.getItem('repos') || 'null');
			if (cached && cached.user === SITE.github && Date.now() - cached.at < 10 * 60e3) return (repos = cached.repos);
		} catch {}
		const res = await fetch(`https://api.github.com/users/${encodeURIComponent(SITE.github)}/repos?per_page=100&sort=pushed`);
		if (!res.ok) throw new Error(`GitHub said ${res.status}`);
		repos = (await res.json())
			.filter((r) => !r.fork && !r.archived)
			.map((r) => ({
				name: r.name,
				url: r.html_url,
				desc: r.description,
				lang: r.language,
				stars: r.stargazers_count,
				pushed: r.pushed_at
			}))
			.sort((a, b) => b.stars - a.stars || new Date(b.pushed) - new Date(a.pushed));
		try {
			sessionStorage.setItem('repos', JSON.stringify({ user: SITE.github, at: Date.now(), repos }));
		} catch {}
		return repos;
	}

	async function showRepos() {
		const profile = `https://github.com/${encodeURIComponent(SITE.github)}`;
		const list = document.createElement('ul');
		list.className = 'repos';
		list.style.setProperty('--k', winBody.children.length);
		list.innerHTML = '<li class="loading note">Loading repos<span class="cursor">_</span></li>';
		winBody.append(list);
		try {
			const items = await fetchRepos();
			list.innerHTML = items.length
				? items
						.map(
							(r, i) => `<li style="--k:${i}"><a class="repo" href="${esc(r.url)}" target="_blank" rel="noopener">
						<span class="repo-name">${esc(r.name)}</span>
						${r.desc ? `<span class="repo-desc">${esc(r.desc)}</span>` : ''}
						<span class="repo-meta">${r.lang ? `<i class="dot" style="--c:${LANG_COLORS[r.lang] || 'var(--mid)'}"></i>${esc(r.lang)} ·` : ''} ★ ${r.stars} · updated ${esc(ago(r.pushed))}</span>
					</a></li>`
						)
						.join('')
				: '<li class="note">No public repos yet.</li>';
		} catch {
			list.innerHTML = `<li class="note">Couldn't reach GitHub just now. <a href="${profile}" target="_blank" rel="noopener">See them on GitHub</a>.</li>`;
			return;
		}
		const more = document.createElement('a');
		more.className = 'more';
		more.href = profile;
		more.target = '_blank';
		more.rel = 'noopener';
		more.textContent = 'All of it on GitHub →';
		more.style.setProperty('--k', winBody.children.length);
		winBody.append(more);
	}

	// ------------------------------------------------------------ the clock

	const t0 = performance.now();
	let warp = still ? SETTLED : 0;
	const now = () => (performance.now() - t0) / 1000 + warp;

	// any click or key during the intro skips straight to the orbit opening
	function skipIntro() {
		const t = now();
		if (t < OPEN) warp += OPEN - t;
	}
	window.addEventListener('pointerdown', skipIntro);
	window.addEventListener('keydown', skipIntro);

	motionQuery.addEventListener('change', (e) => {
		still = e.matches;
		if (still) warp += Math.max(0, SETTLED - now());
	});

	let formed = false;
	let opened = false;
	let speed = 1;
	let last = performance.now();

	function frame(ms) {
		const dt = Math.min(0.05, (ms - last) / 1000);
		last = ms;
		const t = now();

		if (!formed && t >= FORMED) {
			document.body.classList.add('formed');
			formed = true;
		}
		if (!opened && t >= OPEN) {
			document.body.classList.add('open');
			opened = true;
		}

		// the orbit eases to a stop while you're pointing at something in it, or reading a window
		const target = still || hovered.size || focused || windowOpen ? 0 : 1;
		speed += (target - speed) * Math.min(1, dt * 5);
		orbitClock += dt * speed;
		mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 3);
		mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 3);

		ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
		ctx.clearRect(0, 0, L.vw, L.vh);
		drawStars(t);
		drawMeteors(t);
		drawOrbit(t);
		if (t < FORMED) drawFormation(t);
		updateSats(t);
		drawSparks(t);

		requestAnimationFrame(frame);
	}

	layout();
	window.addEventListener('resize', layout);
	requestAnimationFrame(frame);
})();
