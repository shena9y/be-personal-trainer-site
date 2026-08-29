# be-personal-trainer-site

> Personal-training website for Brandon Ross — "Be Personal Trainer". Strength, conditioning and nutrition coaching in Melbourne or online. Vanilla HTML/CSS/JS landing page with PWA support — no build step.

---

### GitHub "About" (short version)

```
Static personal-training site for Be Personal Trainer — strength, conditioning & nutrition coaching in Melbourne or online. Vanilla HTML/CSS/JS, no build step.
```

---

## Overview

A single-page marketing site for **Be Personal Trainer**, the personal-training business of Brandon Ross, based in Melbourne (Level 13, 2 Elizabeth St).

The page covers:

- **Hero** — intro, animated progress ring and "varied training" card
- **Training** — 4-week beginner workout program timeline (Crossfit / Running / Crossfit + running)
- **About me** — Brandon's 12 years of coaching experience, certified strength & conditioning coach, nutrition L3
- **Services** — what's included (personal plan reviews every 2 weeks, form checks, nutrition targets)
- **E-training** — online plan options from $39/month
- **Contact** — client-side validated contact form, location and phone/email details

## Features

- **Zero dependencies, zero build step** — plain HTML, CSS and JavaScript
- **PWA-ready** — `site.webmanifest`, favicon + generated icons via `make_icons.py`
- **Performance focused**:
  - Preloaded hero image with `fetchpriority="high"` and aspect-ratio set (no CLS)
  - Non-blocking Google Fonts load
  - Lazy-loaded below-the-fold images with explicit `width`/`height`
- **Small interactions** (all in vanilla JS):
  - Sticky nav with shadow on scroll
  - Mobile burger menu with `aria-expanded`
  - Scroll-spy active link highlighting
  - Animated SVG progress rings on scroll into view
  - Scroll-reveal animations
  - Showreel video modal (YouTube embed) with Escape / backdrop close
  - Client-side contact-form validation with inline error messages
- **Accessibility-minded** — semantic sections, `sr-only` labels, `aria-live` error regions, dialog `role`/`aria-modal`

## Tech stack

| Layer                 | Tech                                            |
| --------------------- | ----------------------------------------------- |
| Markup                | Semantic HTML5                                  |
| Styling               | CSS (custom properties, responsive layout)      |
| Logic                 | Vanilla JavaScript (IntersectionObserver, etc.) |
| Icons                 | Hand-rolled inline SVG                          |
| Image/icon generation | Python script (`make_icons.py`)                 |

## File structure

```
fit-site/
├── index.html          # Single-page site
├── styles.css          # All styling
├── script.js           # Interactivity
├── site.webmanifest    # PWA manifest
├── favicon.svg         # SVG favicon source
├── icon.png            # PNG icon
├── make_icons.py       # Generates icon-192.png / icon-512.png
├── robots.txt
└── README.md
```

## Getting started

No dependencies, no build step — open `index.html` in a browser, or serve the folder locally:

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then visit <http://localhost:8000>.

## Notes

- The contact form is **client-side validation only** — no backend/endpoint is wired up yet (see the `formStatus` message in `script.js`).
- Canonical URL, contact phone/email and site copy use placeholders (`bepersonaltrainer.example`, `hello@bepersonal.example`) — replace with real values before launch.

## Credits

- Built by [Mohammed Hamdy](https://github.com/shena9y)
- Photography via Unsplash
