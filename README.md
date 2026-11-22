# Shubh & Suchita's invitation

Owner: Shubh & Suchita  
Date: 22 November 2026

## TL;DR

- Independent static invitation with a ruby-glitter opening, original theatre artwork, restartable curtains and native scrolling.
- The opening uses Timo77's licensed dancing couple, with authored materials, contact-preserving rig changes and gentle sway.
- `index.html` is the canonical source for names, dates, programme and directions.
- The grand envelope uses approved dog artwork and live text. The original RSVP form follows it.
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

Glitter is part of the rendered fabric. In the source movies the couple turns 75 degrees from 2 to 6 seconds, followed by a 0.75-second hold. The invitation plays the first two seconds at normal speed, then plays the remaining turn and hold at 1.5x. The turn takes about 2.7 seconds on screen and native scrolling returns about 5.6 seconds after playback starts, including the dissolve. Music stays at normal speed.

The approved 150-to-225-degree sweep keeps both partners readable. Actual upper-body sway and wrist-contact IK complement the turn; this is not stepping choreography or cloth simulation. The original model's missing photographic textures are not restored: skin, hair, suit and gown use newly authored materials. The licensed figures are not a likeness of Shubh and Suchita.

The pearl-and-gold butterfly follows the left side of the composition once the names appear. Its longer trail combines a fine warm-white core, a soft gold wake and drifting, gently twinkling dust, capped at 320 particles. Twenty-four scene highlights and a foreground-only stage-light bloom add depth without drawing a ring across the couple's feet. The decorative copy sits above the effects. Flight, dust and highlights follow the movie's frame time where supported, pause with it, and fade out before the final handoff. Reduced motion skips these effects entirely.

There are no visible gesture instructions or microphone prompts. A full-screen semantic button supports Enter and Space; Tab has a visible focus frame, and Escape opens immediately without music or skips an active reveal. Every document load starts at the top with the entrance closed. Supported initial anchors are honoured only after opening. Reduced motion keeps the entrance but skips its movement. Script failure leaves the invitation uncovered; blocked or slow video falls back to the open still.

The selected portrait or landscape movie prepares in the background while the curtains are closed, without autoplay. A tap waits for the complete file before starting the reveal, so a cold mobile connection cannot interrupt the animation halfway through. A full CSS fabric fallback remains visible until the curtain image has decoded, avoiding half-loaded poster frames. During a real wait, a small preparation message and gentle wing movement keep the entrance responsive. Preparation and playback have separate failure handling; loading time never consumes the animation's duration. The unused responsive movie is not downloaded, and reduced motion skips movie preparation entirely.

A brief, silent, in-memory audio primer unlocks the existing audio element on an early tap. The real soundtrack is requested only once the movie is fully downloaded, rather than competing for the same mobile bandwidth. Switching tabs pauses the opening and resumes the same frame on return; it does not jump to the final couple image. Refresh still restarts at closed curtains. Prepared blob URLs are revoked when the entrance closes.

The final still is decoded before dissolving into it, using the same captured viewport-sized media plane, so the couple cannot shrink at the handoff. The video decoder is reset only after the dialog has left the top layer, preventing the closed poster from flashing onscreen. A visible "Scroll to go down" cue leads into native scrolling; its arrow moves only three times. The original HTML remains the source for wording, and decorative reveal copy is stripped of duplicate IDs and hidden from assistive technology. No storage, analytics, backend or scroll interception is used.

Phone text spacing uses the actual captured viewport height, not the hardware screen height. This accounts for the iPhone 15 Pro's 393x659 Safari viewport with browser bars visible. The venue line stays at least 20px above the measured figure bounds across all 162 poses, the short landscape layout places the names side by side, and the scroll cue moves to the side when vertical space is tight. `tests/fixtures/opening-bounds.json` ties those geometry measurements to the exact movie/poster hashes so changing the artwork requires rechecking its clearance.

Venue and RSVP use prominent, gold-accented navigation buttons with 44px minimum touch targets. Parent names have brighter, bolder type while relationship labels remain quieter. Portrait phones use 12px parent text; short landscape views use 11px to preserve the couple-name hierarchy and safe spacing. The header height, movie framing and figure scale remain unchanged.

The wedding countdown reads its target directly from the Phere entry's `datetime` in the canonical programme: 26 January 2027 at 4:00 PM IST. It stops ticking offscreen or in a hidden tab. Without JavaScript, the confirmed date remains visible.

The supplied "Ishq Wala Love" instrumental starts only when a guest activates the opening. Its 2.6106875-second digital-silence prefix is removed without cutting musical samples. A 50ms fade-in preserves the quiet pickup; the first audible window is 0.26 seconds into the delivered track. The 254.722625-second AAC retains the quiet playback volume and two-second fade-out. It loops, pauses in a hidden tab, resumes when the guest returns, and resets on refresh. There are no music switches or extra music labels. Browser or device restrictions may keep it silent without blocking the invitation. Delivery supports byte ranges. Public website use of this supplied recording was confirmed by the user on 19 November 2026.

The page uses ivory, burgundy and gold framing, fuller floral banners and restrained scroll-linked edge sparkles. Short, faint gold rules separate sections instead of repeated patterned strips. Sparkles stay outside the central text, stop moving when scrolling stops, and are hidden for reduced motion and forced colours.

The RSVP envelope retains the approved dogs, burgundy lining, embossed paper, ribbon and wax seal. Printed lettering and the raster button were replaced with local paper texture. The heading, signature, date and venue are live HTML. Blank paper expands on smaller screens and at zoom without stretching the artwork. High contrast keeps the live text and fallback link without decorative imagery. Source concepts and supplied pet references are not shipped.

| File | Edit here |
|---|---|
| `index.html` | Names, parents, programme entries, venue, directions, responder URL and share-card metadata. If the public domain changes, update the absolute Open Graph and Twitter image URLs and `og:url`. |
| `styles.css` | Responsive composition, fonts, paper, framing and curtain motion |
| `app.js` | Entrance and music lifecycle, countdown and deferred form embed |
| `assets/artwork/` | Local logo and original SVG illustrations |
| `assets/fonts/` | Local Cormorant font files and their OFL licence |
| `assets/audio/ishq-wala-love-instrumental-v3.m4a` | Current user-authorised soundtrack with the silent prefix removed |
| `assets/artwork/rsvp-envelope-*.webp` | Approved envelope artwork with live HTML copy layered over it |
| `tests/fixtures/music.json`, `rsvp-artwork.json`, `opening-bounds.json` | Provenance, exact asset hashes, audio timing and measured geometry |
| `tools/prepare_music.py` | Retained authoring helper for the older Vaaroon excerpt, not the current soundtrack |
| `tools/render_opening.py`, `tools/import_colored_vrml.py` | Retained authoring work for the earlier 3dklon scan, not the current rigged couple |
| `assets/video/curtain-reveal.mp4` | Muted H.264 opening film, prepared while curtains are closed and played only after activation |
| `assets/video/curtain-reveal-wide.mp4` | Matching landscape film, selected instead of the portrait film on wide viewports |

The active media are checked-in delivery assets, not generated during a Pages build. Private authoring used the original Timo77 Blender scene and macOS audio tools. The source recordings, model downloads, working scenes and raw frames remain outside the repository. Do not use the older `tools/prepare_music.py` helper to overwrite the current soundtrack.

The retained scan renderer can still reproduce the earlier scan experiment with `blender --background --factory-startup --disable-autoexec --python tools/render_opening.py -- --scan /private/licensed-assets/para2.wrl --output /private/render/path --animation`. It does not reproduce the current Timo77 animation. Its restricted importer rejects scripts, external resources and unsupported VRML structures and verifies the supplied source hash. Keep `.wrl` and `.blend` files, raw frames and logs private.

The active model is the original [Dancing wedding couple by Timo77](https://www.thingiverse.com/thing:3181273), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Retain the source, creator, licence and adaptation notice in the keyboard-accessible footer Credits disclosure. It is not the ShareAlike STL remix.

Across all 162 active poses, the geometry leaves at least 61.67514% clear above and 4.06195% below. Grounding, contact constraints, normalized bounds and exact delivery hashes are recorded in `tests/fixtures/opening-bounds.json`. Posters were decoded from the finished movies, preserving the same geometry and framing at the handoff.

The local fonts use WOFF compression to keep the rendered opening within the existing asset budget. Recreate either from its original TTF with `pyftsubset source.ttf --flavor=woff --unicodes=U+0000-024F,U+1E00-1EFF,U+2000-206F,U+2190-21FF --layout-features='*' --output-file=font.woff`. The OFL licence is retained.

### RSVP form

The couple explicitly chose to use the original published form unchanged. Its older programme and venue wording differ from this invitation. The invitation's canonical programme contains the current timings; the extra schedule-note sentence and header Schedule link were removed at the couple's request.

The **`href` attribute** on `<a id="rsvp-link">` in `index.html` is the only URL configuration field. The current link prefills arrival for 25 January 2027 at 10:00 AM in both the embedded form and the separate tab. Guests can change it. When replacing the link, use the owner's HTTPS Google Forms `/forms/d/e/.../viewform` URL with its prefill parameters, never an editor URL.

The embedded form follows the envelope. The only separate-tab RSVP link is in the “Form not loading?” line below the form. Without JavaScript, the same link is available without the loading prompt. `app.js` validates its URL and adds `embedded=true` only for the iframe, which loads near the RSVP section. There is no cross-origin autoheight, hidden Google branding, submission interception or simulated confirmation.

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

`npm run lint` checks JavaScript syntax without adding a linter dependency. `npm run check` also validates canonical content, the 1.5 MB render-asset budget, silent fast-start H.264 timing and the exact public artifact contents. Browser checks verify selected-variant-only preparation, no autoplay, an immediate tap during a delayed download or an empty-cache 1 Mbps connection, uninterrupted completed playback, background-tab pause/resume, and posters matching the movie's first and last frames at native resolution. Before/midway/after playback captures also check text separation and unchanged handoff dimensions at 393x659, 393x700, 393x759, 393x852 and 1440x1000.

Browser tests use an existing local Google Chrome installation. On Apple Silicon with an x64 Node runtime, `tools/chrome-arm64.sh` ensures Chrome runs natively rather than through Rosetta. Tests start their own loopback server on port 4197 and stop it at the end. Screenshots go to `test-results/screenshots/`; set `SCREENSHOT_DIR` to use a private artifact directory. Form requests are intercepted in regression tests. Real signed-out form access is checked separately without submitting responses.

## Impact

All programme entries are available without JavaScript. The programme starts with Haldi at noon on 25 January. On 26 January, breakfast is at 8 AM, Jai Mala at 2 PM, Phere at 4 PM and Gala Dinner at 8 PM. The timeline also lists Vidai at 7 AM and breakfast at 8 AM on 27 January; the invitation dates remain 25 and 26 January. Date-time values use the venue's `+05:30` offset, Asia/Kolkata. Background preparation downloads only the selected responsive movie before interaction, trading earlier data transfer for uninterrupted first-click playback.

## Risks and open questions

The existing form retains its old event options and times because the couple requested it unchanged. Only the form owner can correct those details or supply a replacement. Do not edit the form or submit a test response without permission.

The venue artwork is an original interpretation, not a promise of booked decor. The generic couple has limited source detail and authored shaders rather than restored photographic textures. The RSVP pets are generated artwork based on the supplied reference, not actual pet photographs. The private reference videos, their recordings and creator imagery are not shipped. Automated viewport checks are not a claim of testing every physical phone or browser.

## Ask / Next steps

| Action | Owner | Date |
|---|---|---|
| Supply an updated form if the temporary original should be replaced | Shubh | When ready |
| Set `#rsvp-link`'s `href` and check the replacement signed out | Implementer | After receiving an updated URL |
| Retain asset credits and recheck public-use permission if the soundtrack changes | Implementer | Before future releases |
