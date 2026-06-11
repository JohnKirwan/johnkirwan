# Software Section (radiatR + embedded Shiny app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level **Software** menu item on jkirwan.org opening a `/software/` page that describes the radiatR R package, links to its docs/source/app, and embeds the live shinylive app inline via an iframe.

**Architecture:** A new Hugo `landing` page (`content/software.md`) built from theme blocks, plus a reusable `shinyapp` shortcode (`layouts/shortcodes/shinyapp.html`) that emits a responsive, lazy-loaded iframe with a fallback link. The app itself is NOT copied here — the shortcode embeds the existing static shinylive build at `johnkirwan.github.io/radiatR/app/`, which radiatR's own release workflow keeps current. A single menu entry wires it into the top nav.

**Tech Stack:** Hugo (extended, modules) + Hugo Blox / Academic theme. No JS build. YAML config + Markdown + a Go-template shortcode.

**Branch:** `add-software-section` (already created, rebased on latest `main`).

---

## Verification tooling note (read first)

`hugo` and `go` are **not on PATH** in this environment; `npm run dev` (`hugo server -D`) will fail until they are installed. Two ways to verify:

- **Local build (preferred if you can install):** install Hugo Extended (matching CI: v0.136.5) and Go ≥ 1.19, then run `npm run dev` and open `http://localhost:1313/software/`.
  - Debian/Ubuntu/WSL quick path:
    ```bash
    sudo apt-get update && sudo apt-get install -y golang-go
    # Hugo Extended (pin to CI version):
    curl -sL https://github.com/gohugoio/hugo/releases/download/v0.136.5/hugo_extended_0.136.5_linux-amd64.tar.gz \
      | sudo tar -xz -C /usr/local/bin hugo
    hugo version   # expect: hugo v0.136.5 ... extended
    ```
- **CI / deploy preview (authoritative fallback):** push the branch and open a PR. GitHub Actions (`.github/workflows/publish.yaml`) and/or Netlify (`netlify.toml`) build the site; check the build succeeds and, if a Netlify deploy preview is available, open `/software/` there. The production deploy only happens when merged to `main`.

Each task below gives a build/verify step. If local Hugo is unavailable, treat "build succeeds in CI on the open PR" as the passing condition for the verify steps, and do the visual checks on the deploy preview.

---

## File Structure

- `layouts/shortcodes/shinyapp.html` — **new.** Reusable shortcode: responsive, lazy-loaded iframe + fallback link. One responsibility: embed a client-side web app. Reusable for any future app.
- `content/software.md` — **new.** The `/software/` landing page: intro, radiatR card (blurb + 3 links), embedded app. One responsibility: present software.
- `config/_default/menus.yaml` — **modify.** Add one `Software` nav entry.

Order: shortcode first (the page depends on it), then the page, then the menu entry (so the nav target exists before it's linked).

---

## Task 1: `shinyapp` shortcode

**Files:**
- Create: `layouts/shortcodes/shinyapp.html`

- [ ] **Step 1: Create the shortcode file**

Create `layouts/shortcodes/shinyapp.html` with exactly:

```go-html-template
{{/*
  shinyapp — embed a static / client-side (e.g. shinylive) web app in a
  responsive, lazy-loaded iframe, with a fallback link if it fails to load.

  Params:
    src    (required) — the app URL.
    height (optional) — iframe height (any CSS length). Default "800px".
    title  (optional) — accessible iframe title. Default "Embedded app".

  Usage:
    {{< shinyapp src="https://johnkirwan.github.io/radiatR/app/" height="850px" title="radiatR Shiny app" >}}
*/ -}}
{{- $src := .Get "src" -}}
{{- if not $src -}}
  {{- errorf "shinyapp shortcode requires a 'src' parameter (%s)" .Position -}}
{{- end -}}
{{- $height := .Get "height" | default "800px" -}}
{{- $title := .Get "title" | default "Embedded app" -}}
<div class="shinyapp-embed" style="width:100%; margin:1.5rem 0;">
  <iframe
    src="{{ $src }}"
    title="{{ $title }}"
    loading="lazy"
    allow="fullscreen; clipboard-write"
    referrerpolicy="no-referrer-when-downgrade"
    style="width:100%; height:{{ $height }}; border:1px solid #ddd; border-radius:8px;">
  </iframe>
  <p style="margin-top:.5rem; font-size:.9rem;">
    If the app doesn’t load,
    <a href="{{ $src }}" target="_blank" rel="noopener">open it in a new tab</a>.
  </p>
</div>
```

- [ ] **Step 2: Sanity-check the template parses**

If Hugo is installed: `hugo --quiet --renderToMemory` from the repo root and confirm no template parse error is printed. (A missing `src` only errors when the shortcode is *used* without it — Task 2 covers real usage.)
Expected: command exits 0, no `error` lines mentioning `shinyapp`.
If Hugo is not installed: skip to the PR/CI check in Task 4 — a parse error there fails the build.

- [ ] **Step 3: Commit**

```bash
git add layouts/shortcodes/shinyapp.html
git commit -m "feat: add shinyapp shortcode for embedding client-side apps"
```

---

## Task 2: `/software/` page

**Files:**
- Create: `content/software.md`

Pattern reference: `content/projects.md` (a `type: landing` page built from blocks). The blurb text comes from radiatR's DESCRIPTION ("Analysis and Visualisation of Circular Arena Tracking Data").

- [ ] **Step 1: Create the page file**

Create `content/software.md` with exactly:

```markdown
---
title: 'Software'
date: 2026-06-10
type: landing

design:
  # Section spacing
  spacing: '5rem'

# Page sections
sections:
  - block: markdown
    content:
      title: 'Software'
      text: |-
        Open-source tools I build and maintain. Below you can read the
        documentation, browse the source, or use the app directly in your
        browser.
    design:
      columns: '1'

  - block: markdown
    content:
      title: 'radiatR'
      text: |-
        **Analysis and visualisation of circular-arena tracking data.** An R
        package providing a complete pipeline for analysing animal orientation
        and movement in circular arenas — reading data from 20+ tracking tools
        (EthoVision, DeepLabCut, SLEAP, TRex, ANY-maze, TrackMate, idtracker.ai,
        and others), deriving per-trial heading directions, and producing
        circular-statistics summaries and figures.

        [📖 Documentation](https://johnkirwan.github.io/radiatR) ·
        [💻 Source on GitHub](https://github.com/JohnKirwan/radiatR) ·
        [🚀 Open the app in a new tab](https://johnkirwan.github.io/radiatR/app/)

        The interactive app below runs entirely in your browser (no install
        required) and may take a few seconds to start.
    design:
      columns: '1'

  - block: markdown
    content:
      text: |-
        {{< shinyapp src="https://johnkirwan.github.io/radiatR/app/" height="850px" title="radiatR Shiny app" >}}
    design:
      columns: '1'
---
```

- [ ] **Step 2: Build and verify the page renders**

If Hugo is installed: `npm run dev`, then open `http://localhost:1313/software/`.
Expected:
- Page title "Software" and the radiatR section render.
- The three links (Documentation, Source, Open the app) are present and point to the URLs above.
- An iframe appears and loads the radiatR app (interactive after a few seconds).
- A fallback "open it in a new tab" link appears beneath the iframe.

If Hugo is not installed: defer this visual check to the deploy preview in Task 4.

- [ ] **Step 3: Commit**

```bash
git add content/software.md
git commit -m "feat: add /software/ page with radiatR card and embedded app"
```

---

## Task 3: Add the Software menu item

**Files:**
- Modify: `config/_default/menus.yaml`

Existing entries use a `name`, an 8-char alphanumeric `identifier`, a `url`, and a `weight`. The new entry sits between **CV** (30) and **Papers** (40).

- [ ] **Step 1: Add the menu entry**

In `config/_default/menus.yaml`, add this block after the `CV` entry (the one with `weight: 30`) and before `Papers`:

```yaml
  - name: Software
    identifier: Sw7Kq2Lm
    url: software/
    weight: 35
```

The resulting `main:` list order should be: Bio (10), Experience (20), CV (30), Software (35), Papers (40).

- [ ] **Step 2: Build and verify the menu**

If Hugo is installed: `npm run dev`, open `http://localhost:1313/`.
Expected: top nav shows **Software** between **CV** and **Papers**; clicking it navigates to `/software/`.
If Hugo is not installed: defer to Task 4.

- [ ] **Step 3: Commit**

```bash
git add config/_default/menus.yaml
git commit -m "feat: add Software item to top navigation"
```

---

## Task 4: Full build verification + PR

**Files:** none (verification + integration).

- [ ] **Step 1: Full local build (if Hugo available)**

Run: `npm run dev` (or `hugo --quiet` for a one-shot build).
Expected: build succeeds with no errors; `/software/` renders with working nav link, three external links, and a live embedded app; no other page regressed.

- [ ] **Step 2: Push the branch and open a PR**

```bash
git push -u origin add-software-section
gh pr create --base main --title "Add Software section (radiatR + embedded Shiny app)" \
  --body "Adds a top-level Software menu item linking to a new /software/ page that documents the radiatR R package (docs, source, app) and embeds the live shinylive app via an iframe. App stays hosted by the radiatR release workflow; nothing duplicated here. See docs/superpowers/specs/2026-06-10-software-section-design.md."
```

- [ ] **Step 3: Confirm the CI/deploy build is green**

Check the PR's GitHub Actions build (and Netlify deploy preview if present). If a deploy preview URL is available, open `/software/` on it and repeat the visual checks from Tasks 2–3 (links work, app embeds and runs).
Expected: build green; `/software/` renders correctly on the preview.

- [ ] **Step 4 (optional): cross-origin embed smoke check**

Confirm the app actually frames (GitHub Pages currently sends no `X-Frame-Options`/CSP `frame-ancestors`):
```bash
curl -sI https://johnkirwan.github.io/radiatR/app/ | grep -iE 'x-frame-options|content-security-policy' || echo "no framing restriction headers — embeddable"
```
Expected: `no framing restriction headers — embeddable`. If headers ever appear, the in-page "open in a new tab" fallback still works; note it on the PR.

---

## Self-Review

**Spec coverage:**
- Menu item → Task 3. ✓
- `/software/` page with intro + radiatR card (blurb + Docs/Source/App links) + embedded app → Task 2. ✓
- `shinyapp` shortcode (responsive, lazy, fallback link) → Task 1. ✓
- Iframe-embed of existing build, no copied WASM, no build-pipeline change here → architecture honoured (only the three files in the spec are touched). ✓
- Verification (build, menu, links, app loads, no regressions) → Tasks 2–4. ✓
- Error handling (app offline fallback link; Goldmark-unsafe avoided via shortcode) → shortcode fallback link in Task 1; iframe emitted by shortcode not raw HTML. ✓

**Placeholder scan:** No TBD/TODO; all file contents are complete and literal.

**Consistency:** Shortcode name `shinyapp` and its params (`src`/`height`/`title`) are identical in Task 1 (definition) and Task 2 (usage). Menu `url: software/` matches the page path `content/software.md` → `/software/`. Weights are internally ordered (CV 30 < Software 35 < Papers 40).

**Note on the third block:** the embedded-app section uses a `markdown` block whose `text` is only the `shinyapp` shortcode; Hugo renders shortcodes inside block `text`. If the theme were to strip it, the Task 2 verify step catches it and the fallback is to call the shortcode from a dedicated section template — but the standard markdown block renders shortcodes, so this is expected to work as written.
