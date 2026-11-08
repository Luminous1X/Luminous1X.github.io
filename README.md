# luminous1x.github.io

My about-me page: a starfield where the icon gathers out of stars, with an orbit of sections and links around it.

Live at **https://luminous1x.github.io**

## Editing

- **`content.js`**: everything the page says: name, tagline, the About/Now text, links, the accent color and the pixel icon.
- **`glyphs.js`**: the little 16×16 icons in the orbit. Add your own and use them by name.
- `main.js` and `style.css` are the animation and the look.

Plain HTML, CSS and JS with no build step. Push to `main` and GitHub Pages updates the site within a minute or so.

To preview locally:

```
python -m http.server 5173
```

then open http://localhost:5173.
