# luminous1x.github.io

My about-me page: a starfield where the icon gathers out of stars, with an orbit of sections and links around it.

Live at **https://luminous1x.github.io**

## Editing

- **`content.js`**: everything the page says: name, tagline, the About/Now text, links, the accent color and the pixel icon.
- **`glyphs.js`**: the little 16×16 icons in the orbit. Add your own and use them by name.
- `main.js` and `style.css` are the animation and the look.

Plain HTML, CSS and JS with no build step. Push to `main` and GitHub Pages updates the site within a minute or so.

THIS IS FREE TO USE! all code can be taken edited posted whatever you wanna do with it, it's OS for a reason

To preview locally:

```
python -m http.server 5173
```

then open http://localhost:5173.

## View counter

The eye badge in the corner shows how many browsers have opened the site. The count lives in a tiny Cloudflare Worker with a one-table D1 database, in `counter/`:

- each browser counts once, so refreshing doesn't add to it
- only visits from the live site count (local previews just read it), at most 5 a minute from one address
- nothing about visitors is stored, only the number

Pushing to GitHub doesn't update the Worker. After changing anything in `counter/`, deploy it from that folder (run `npx wrangler login` first if this PC isn't signed in):

```
npm install
npx wrangler deploy
```

If the site moves to a new address, add it to `COUNT_ORIGINS` and `READ_ORIGINS` in `counter/wrangler.toml` and deploy, or new visits won't count. To hide the badge, set `views: ''` in `content.js`.

## Link preview

`card.png` is the picture apps like Discord show when the site's link is shared. `card.html` draws it from `content.js`.

If you change the name, tagline or icon, update the `og:` tags near the top of `index.html`, then remake the picture (PowerShell, from this folder, needs Chrome):

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=4000 --screenshot="$PWD\card.png" "$PWD\card.html"
```
