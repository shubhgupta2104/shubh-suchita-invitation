# Shubh & Suchita's invitation

Owner: Shubh & Suchita  
Date: 27 October 2026

## TL;DR

- Independent static invitation with original artwork, restartable curtains and native scrolling.
- `index.html` is the canonical source for names, dates, programme and directions.
- The original RSVP form is embedded unchanged at the couple's request.
- GitHub Pages publishes only the generated public files. The old website and original form are not modified.

## Why this matters

The invitation celebrates 25 and 26 January 2027 at Evara Resort. Its content and implementation are independent of the existing wedding website.

## What we are doing

Run the private preview with Node 22 or newer:

```sh
npm run dev
```

Open `http://127.0.0.1:4186/`. `PORT=4188 npm run dev` selects another loopback port if needed. No dependency installation is needed to serve the site. The preview server allows only the intended HTML, CSS, JavaScript and asset files. It does not expose source records, tests, package files, private references or directory listings.

The curtain uses a native modal dialog, activated only after its keyboard and Escape handlers are installed. The monogram crest opens it; Escape opens without animation or music. There is no visible Skip control, following the couple's feedback. Every document load starts at the top. Supported initial anchors are honoured only after opening. Reduced motion keeps the entrance but skips its movement. Script failure leaves the semantic invitation uncovered. No storage, analytics, backend or scroll interception is used.

The wedding countdown reads its target directly from the Phere entry's `datetime` in the canonical programme: 26 January 2027 at 4:00 PM IST. It stops ticking offscreen or in a hidden tab. Without JavaScript, the confirmed date remains visible.

The original instrumental, "Ivory Evening", starts only when a guest activates the crest. No audio is downloaded before that action. It loops quietly, pauses in a hidden tab, resumes when the guest returns, and resets with the entrance on refresh. There are no music switches or extra music labels, as requested. Browser or device playback restrictions may keep it silent without affecting the invitation. The AAC file is served with byte-range support.

| File | Edit here |
|---|---|
| `index.html` | Names, parents, ten chronological programme entries, venue, directions and responder URL |
| `styles.css` | Responsive composition, fonts, paper, framing and curtain motion |
| `app.js` | Entrance and music lifecycle, countdown and deferred form embed |
| `assets/artwork/` | Local logo and original SVG illustrations |
| `assets/fonts/` | Local Cormorant font files and their OFL licence |
| `assets/audio/ivory-evening.m4a` | Original 51.2-second instrumental with synthesized plucked strings, flute-like melody and light percussion |
| `tools/render_music.py` | Reproducible score and synthesis source, using Python's standard library and macOS `afconvert` |

To regenerate the audio on macOS, run `python3 tools/render_music.py`. No external recordings, samples, music service, executable downloads or additional packages are needed.

### RSVP form

The couple explicitly chose to use the original published form unchanged for now. Its older programme and venue wording differ from this invitation. A short note directs guests to the invitation's current schedule.

The **`href` attribute** on `<a id="rsvp-link">` in `index.html` is the only URL configuration field. If the owner later supplies an updated form, replace that value with its verified HTTPS Google Forms `/forms/d/e/.../viewform` URL, never an editor URL.

The same anchor is the visible separate-tab fallback, including without JavaScript. `app.js` validates the URL and adds `embedded=true` to the iframe URL. The iframe is created only near the RSVP section. There is no cross-origin autoheight, hidden Google branding, submission interception or simulated confirmation.

### GitHub Pages

`npm run build` recreates `dist/` from the canonical HTML, CSS, JavaScript and local assets. It rejects asset symlinks and unexpected file types. Development scripts, tests, dependencies, source records and private screenshots are not included in the website artifact.

The pinned GitHub-owned actions in `.github/workflows/pages.yml` deploy that artifact on pushes to `sgupta12/publish-invitation`, or by manual workflow dispatch. Enable GitHub Pages with the GitHub Actions build source. No custom domain or third-party hosting service is required. Public publishing, commits and pushes require the owner's approval.

### Checks

The development-only test dependency is pinned to Microsoft's Playwright. Install it without package lifecycle hooks:

```sh
npm ci --ignore-scripts
npm run check
npm test
```

`npm run lint` checks JavaScript syntax without adding a linter dependency. `npm run check` also validates canonical content, the transfer budget and the exact public artifact contents.

Browser tests use an existing local Google Chrome installation. They start their own loopback server on port 4197 and stop it at the end. Screenshots go to `test-results/screenshots/`; set `SCREENSHOT_DIR` to use a private artifact directory. Form requests are intercepted in regression tests. Real signed-out form access is checked separately without submitting responses.

## Impact

Four functions and six meal entries are available without JavaScript. Date-time values use the venue's `+05:30` offset, Asia/Kolkata. The initial first-party transfer budget is 1.5 MB, excluding Google's form payload.

## Risks and open questions

The existing form retains its old event options and times because the couple requested it unchanged. Only the form owner can correct those details or supply a replacement. Do not edit the form or submit a test response without permission.

The artwork is an original interpretation of venue features, not a promise of booked decor. Automated viewport checks are not a claim of testing every physical phone or browser.

## Ask / Next steps

| Action | Owner | Date |
|---|---|---|
| Supply an updated form if the temporary original should be replaced | Shubh | When ready |
| Set `#rsvp-link`'s `href` and check the replacement signed out | Implementer | After receiving an updated URL |
| Approve remote creation, commits, pushes and public hosting | Shubh & Suchita | Before publishing changes |
