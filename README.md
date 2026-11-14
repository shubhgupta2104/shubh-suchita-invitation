# Shubh & Suchita's invitation

Owner: Shubh & Suchita  
Date: 14 November 2026

## TL;DR

- Independent static invitation with a ruby-glitter opening, original theatre artwork, restartable curtains and native scrolling.
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

The opening is a fully opaque, viewport-sized native dialog. It selects a 720x1440 portrait or 1600x900 landscape render, both 6.75 seconds at 24 fps. The movie stays inside that dialog, so the header and underlying page cannot show through before the curtains finish opening. Touching or swiping anywhere starts the 3D scene. Both the movie and the settled hero use the same contained media frame, preserving the complete figures rather than cropping their heads, gowns or feet.

Glitter is part of the rendered fabric, not a separate canvas layer disappearing ahead of it. The couple starts turning at 2 seconds, half a second before the curtains fully clear, and moves steadily through 75 degrees until 6 seconds. The final 0.75-second hold is unchanged. Warm directional lighting, a soft floor pool and rim light are rendered into the scene. The pearl-and-gold butterfly leaves softly glowing gold dust with random spread, drift, size and lifetime, rather than evenly spaced dots. Dust follows the butterfly's actual position, and a few scene glints follow the movie's frame time where supported. All effects are finite and finish during the opening.

There are no visible gesture instructions or microphone prompts. A full-screen semantic button supports Enter and Space; Tab has a visible focus frame, and Escape opens immediately without music or skips an active reveal. Every document load starts at the top with the entrance closed. Supported initial anchors are honoured only after opening. Reduced motion keeps the entrance but skips its movement. Script failure leaves the invitation uncovered; blocked or slow video falls back to the open still.

The selected portrait or landscape movie is requested only after interaction, is muted and plays once. The final still is decoded before dissolving into it, using the same captured viewport-sized media plane, so the couple cannot shrink at the handoff. The video decoder is reset only after the dialog has left the top layer, preventing the closed poster from flashing onscreen. The unused responsive movie is not downloaded. A visible "Scroll to go down" cue leads into native scrolling; its arrow moves only three times. The original HTML remains the source for wording, and decorative reveal copy is stripped of duplicate IDs and hidden from assistive technology. No storage, analytics, backend or scroll interception is used.

The wedding countdown reads its target directly from the Phere entry's `datetime` in the canonical programme: 26 January 2027 at 4:30 PM IST. It stops ticking offscreen or in a hidden tab. Without JavaScript, the confirmed date remains visible.

The user-authorised "Vaaroon Forever" excerpt starts only when a guest activates the opening. It uses the requested 00:18 to 01:19 section, with two-second fades and a quiet, matched volume. No audio is downloaded before opening. It loops, pauses in a hidden tab, resumes when the guest returns, and resets with the entrance on refresh. There are no music switches or extra music labels, as requested. Browser or device playback restrictions may keep it silent without affecting the invitation. The AAC file is served with byte-range support.

| File | Edit here |
|---|---|
| `index.html` | Names, parents, eleven chronological programme entries, venue, directions and responder URL |
| `styles.css` | Responsive composition, fonts, paper, framing and curtain motion |
| `app.js` | Entrance and music lifecycle, countdown and deferred form embed |
| `assets/artwork/` | Local logo and original SVG illustrations |
| `assets/fonts/` | Local Cormorant font files and their OFL licence |
| `assets/audio/vaaroon-forever.m4a` | User-authorised 61-second excerpt of the supplied recording |
| `tools/prepare_music.py` | Reproducible extraction, fades and volume matching, using Python's standard library and macOS `afconvert` |
| `tools/render_opening.py` | Original 3D meshes, materials, cloth shape animation, couple pose, lighting and rendering using Blender 4.5 LTS |
| `assets/video/curtain-reveal.mp4` | Muted H.264 opening film, loaded only when the invitation is activated |
| `assets/video/curtain-reveal-wide.mp4` | Matching landscape film, selected instead of the portrait film on wide viewports |

To regenerate the audio on macOS, run `python3 tools/prepare_music.py /path/to/authorised-source.mp3`. The full source recording stays outside the repository and is not modified. The couple confirmed permission for public website use on 28 October 2026.

The scene can be rebuilt with `blender --background --factory-startup --disable-autoexec --python tools/render_opening.py -- --output /private/render/path --animation`. Use `--width 1600 --height 900` for the landscape framing. Blender is an offline authoring tool only, not a website dependency. Keep the `.blend` scene, raw frames and logs outside the public asset directories.

The local fonts use WOFF compression to keep the rendered opening within the existing asset budget. Recreate either from its original TTF with `pyftsubset source.ttf --flavor=woff --unicodes=U+0000-024F,U+1E00-1EFF,U+2000-206F,U+2190-21FF --layout-features='*' --output-file=font.woff`. The OFL licence is retained.

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

`npm run lint` checks JavaScript syntax without adding a linter dependency. `npm run check` also validates canonical content, the 1.5 MB initial-resource budget and the exact public artifact contents. Browser checks additionally verify that no movie loads before interaction, only the selected responsive variant is fetched, and the final poster matches the movie's last frame and displayed dimensions.

Browser tests use an existing local Google Chrome installation. On Apple Silicon with an x64 Node runtime, `tools/chrome-arm64.sh` ensures Chrome runs natively rather than through Rosetta. Tests start their own loopback server on port 4197 and stop it at the end. Screenshots go to `test-results/screenshots/`; set `SCREENSHOT_DIR` to use a private artifact directory. Form requests are intercepted in regression tests. Real signed-out form access is checked separately without submitting responses.

## Impact

Five functions and six meal entries are available without JavaScript. The 26 January programme includes Jai Mala at 3 PM, Phere at 4:30 PM and Gala Dinner at 7 PM, replacing that day's previous 8 PM dinner. Date-time values use the venue's `+05:30` offset, Asia/Kolkata. The initial first-party transfer budget is 1.5 MB, excluding Google's form payload.

## Risks and open questions

The existing form retains its old event options and times because the couple requested it unchanged. Only the form owner can correct those details or supply a replacement. Do not edit the form or submit a test response without permission.

The venue artwork is an original interpretation, not a promise of booked decor. The opening couple is an original decorative 3D model, not a portrait of Shubh and Suchita. The private video inspired the sequence; its creator's imagery and recording are not shipped. Automated viewport checks are not a claim of testing every physical phone or browser.

## Ask / Next steps

| Action | Owner | Date |
|---|---|---|
| Supply an updated form if the temporary original should be replaced | Shubh | When ready |
| Set `#rsvp-link`'s `href` and check the replacement signed out | Implementer | After receiving an updated URL |
| Approve remote creation, commits, pushes and public hosting | Shubh & Suchita | Before publishing changes |
