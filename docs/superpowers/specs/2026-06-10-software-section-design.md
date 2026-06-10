# Design: "Software" section linking radiatR + embedded Shiny app

**Date:** 2026-06-10
**Status:** Approved (design); implementation pending
**Site:** jkirwan.org (Hugo Blox / Academic theme, this repo)

## Goal

Surface the radiatR R package and its Shiny app from the personal website, by
adding a top-level **Software** menu item that opens a dedicated page. The page
describes radiatR, links out to its documentation and source, and embeds the
live Shiny app inline so it runs at `jkirwan.org/software/`.

## Context / facts

- **Website**: this repo, deployed to `https://jkirwan.org/` via GitHub Pages
  (`.github/workflows/publish.yaml`, builds from `main`). Hugo Blox theme; the
  top menu is `config/_default/menus.yaml`; pages are `type: landing` built from
  blocks (see `content/projects.md`).
- **radiatR docs**: `https://johnkirwan.github.io/radiatR` (pkgdown).
- **radiatR source**: `https://github.com/JohnKirwan/radiatR`.
- **radiatR app**: `https://johnkirwan.github.io/radiatR/app/` — a **static
  shinylive build** (client-side WebAssembly), rebuilt automatically on each
  radiatR GitHub Release (`shinylive.yaml` workflow → `gh-pages/app`). Because
  it is fully client-side, it can be embedded cross-origin in an `<iframe>` and
  runs inside the visitor's browser. Verified: GitHub Pages serves it without
  `X-Frame-Options`/CSP `frame-ancestors`, so framing is allowed.

## Decisions

- **Embed via iframe**, not by copying the build into this repo. The app stays
  built by radiatR's own release workflow (single source of truth, auto-updates,
  no large WASM bundle committed here, no sync step). Visitors see it at
  `jkirwan.org/software/` with the domain in the address bar.
- Use a **Hugo shortcode** for the iframe rather than raw HTML in markdown, so
  the embed renders reliably regardless of the theme's Goldmark `unsafe` setting
  and is reusable for future apps.

## Components

### 1. Menu item — `config/_default/menus.yaml`
Add a `Software` entry pointing to `/software/`, `weight: 35` (between **CV** at
30 and **Papers** at 40). Give it a unique `identifier` consistent with the
existing entries.

### 2. Page — `content/software.md`
A `type: landing` page (same pattern as `content/projects.md`) with stacked
sections:

1. **Intro** (`markdown` block): heading "Software" + one line of context.
2. **radiatR card** (`markdown` or `cta-card` block): the package blurb (from
   its DESCRIPTION — "Analysis and Visualisation of Circular Arena Tracking
   Data": a pipeline for analysing animal orientation/movement in circular
   arenas, reading 20+ tracking tools) plus buttons/links to:
   - **Documentation** → `https://johnkirwan.github.io/radiatR`
   - **Source (GitHub)** → `https://github.com/JohnKirwan/radiatR`
   - **Open app in new tab** → `https://johnkirwan.github.io/radiatR/app/`
3. **Embedded app**: the shortcode call (see below) embedding the live app.

### 3. Shortcode — `layouts/shortcodes/shinyapp.html`
Renders a responsive, lazy-loaded iframe in a full-width container with a
sensible min-height. Parameters:
- `src` (required) — the app URL.
- `height` (optional, default e.g. `800px`) — iframe height.
- `title` (optional) — accessibility label.

Usage in `content/software.md`:
```
{{< shinyapp src="https://johnkirwan.github.io/radiatR/app/" height="850px" title="radiatR Shiny app" >}}
```

## Data flow

Static site build only. Hugo renders `content/software.md` → the `shinyapp`
shortcode emits the `<iframe>`. At view time the browser loads the shinylive app
from `johnkirwan.github.io/radiatR/app/` into the iframe; the WASM runtime
executes in the iframe's own origin. No server-side component on either site.

## Error handling / edge cases

- **App offline / slow WASM load**: the iframe still shows; the shortcode
  includes a fallback "Open the app directly" link beneath the frame, and the
  card already links to the app in a new tab.
- **Goldmark `unsafe` off**: avoided by using a shortcode (always rendered),
  not raw HTML in the markdown body.
- **Mobile / small screens**: container is full-width with a fixed height;
  shinylive itself is responsive. Acceptable for v1.
- **Future framing restrictions** (if GitHub Pages ever sets `frame-ancestors`):
  the "Open app in new tab" link remains a working fallback.

## Testing / verification

- Build locally (`hugo server`), confirm: **Software** appears in the top menu;
  `/software/` renders the intro, card with three working links, and the app
  iframe; the app loads and is interactive.
- Confirm no regressions on other pages (menu weights unchanged elsewhere).

## Out of scope (YAGNI)

- Copying/hosting the shinylive build in this repo.
- A general "projects/software" collection refactor.
- Additional software entries (the card pattern makes this trivial later).

## Files touched

- `config/_default/menus.yaml` (edit: add menu item)
- `content/software.md` (new)
- `layouts/shortcodes/shinyapp.html` (new)
