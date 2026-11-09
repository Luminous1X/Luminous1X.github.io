// ─────────────────────────────────────────────────────────────────────────────
//  Everything the page says lives here. Edit freely, then refresh.
//
//  Pixel art key (for `icon` here and the glyphs in glyphs.js):
//    .  empty      #  light      +  shade      o  outline (black)      *  accent color
// ─────────────────────────────────────────────────────────────────────────────

window.SITE = {
	name: 'Luminous1X',
	tagline: 'c++ · larping till i run out of claude usage ',

	// shown under the tagline once the orbit opens
	hint: 'pick a star',

	// the glow color: the icon's core, its halo, links and the menu cursor
	accent: '#ffd98a',

	// your GitHub username; the Projects window lists your public repos from it
	github: 'Luminous1X',

	// the big pixel icon in the middle (any size works, keep every row the same length)
	icon: [
		'............o........o...',
		'...........o#o......o#o..',
		'...........o#o.....oo#oo.',
		'...........o#o....o##*##o',
		'...........o#o.....oo#oo.',
		'..........o+##o.....o#o..',
		'..........o+##o......o...',
		'.........o++###o.........',
		'........o+++####o........',
		'.......o#+++###++o.......',
		'.....oo###++##++++oo.....',
		'.oooo######***++++++oooo.',
		'o##########***##########o',
		'.oooo++++++***######oooo.',
		'.....oo++++##++###oo.....',
		'.......o++###+++#o.......',
		'........o####+++o........',
		'.........o###++o.........',
		'..........o##+o..........',
		'..........o##+o..........',
		'...oo......o#o...........',
		'..o#+o.....o#o...........',
		'..o++o.....o#o...........',
		'...oo......o#o...........',
		'............o............'
	],

	// the inner ring: each one opens a window. `body` is plain HTML.
	sections: [
		{
			label: 'About',
			glyph: 'person',
			title: 'About me',
			body: `
				<p>Hi, I'm <b></b>.</p>
				<p>I (try to) write C++ and like figuring out how things work under the hood, usually by ripping programs apart and rebuilding them.</p>
				<p>Pick a star around the icon to look around, or find me through the links on the outer ring.</p>
			`
		},
		{
			label: 'Projects',
			glyph: 'folder',
			title: 'Projects',
			// true = list your public GitHub repos under the body text, live
			repos: true,
			body: `<p>Things I've built, pulled straight from my GitHub.</p>`
		},
		{
			label: 'Now',
			glyph: 'star',
			title: "What I'm up to",
			body: `
				<ul>
					<li>Learning C++, linear algebra, cyber sec.</li>
					<li>Building this site.</li>
				</ul>
			`
		}
	],

	// the outer ring: links. Leave `url` empty and it shows as "add link" until you fill it in.
	// glyphs available: code, chat, play, mail, globe, music, gamepad, person, folder, heart, star
	socials: [
		{ label: 'GitHub', glyph: 'code', url: 'https://github.com/Luminous1X' },
		{ label: 'Discord', glyph: 'chat', url: '_ominousbeing' },
		{ label: 'YouTube', glyph: 'play', url: 'https://www.youtube.com/@Luminous540' },
		{ label: 'Email', glyph: 'mail', url: '781tm2mxq@mozmail.com' } // e.g. 'mailto:you@example.com'
	]
};
