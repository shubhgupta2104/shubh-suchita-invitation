# Invitation asset sources

Owner: Shubh & Suchita  
Date: 19 November 2026

## TL;DR

- The supplied pink monogram retains its colour, proportions and meaningful details.
- The opening uses Timo77's original dancing couple under CC BY 4.0, with accessible footer attribution.
- Scenery, textile and ceremony SVGs are original; the approved generated envelope uses live HTML text and a real button.
- Cormorant fonts retain their existing SIL Open Font License.
- The supplied "Ishq Wala Love" instrumental has public website permission confirmed by the user on 19 November 2026.

## Why this matters

The visual references guide the composition, not the reuse or tracing of another invitation's artwork. The original website and supplied source assets remain unchanged.

## What we are doing

| Asset | Source and handling |
|---|---|
| `monogram.jpg` | User-supplied `WhatsApp Image 2026-11-14 at 23.42.57.jpeg`. Resampled from 1254 square to 400 square using macOS `sips`, retaining colours, proportions and artwork. Application/EXIF metadata was removed. The original file was not modified. |
| `cormorant-garamond-medium.woff`, `cormorant-garamond-italic.woff` | Derived from the old project's existing local TTF fonts using installed FontTools. WOFF compression retains Latin and extended Latin characters, punctuation, arrows and layout features, with no change to the invitation's glyph appearance. Copyright 2015 the Cormorant Project Authors. See `assets/fonts/OFL.txt` for the complete SIL Open Font License 1.1. The source fonts remain unchanged in the old project. |
| `evara-garden.svg` | Original illustration informed by the supplied read-only venue photographs: cream cottages, dark sloping roofs, terraces, lawn, pool and wooded hills. No photo is included. Not a rendering of booked wedding decor. |
| Couple in the opening renders | [Dancing wedding couple by Timo77](https://www.thingiverse.com/thing:3181273), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Uses the original author's Blender file, not the ShareAlike STL remix. Adaptations include newly authored materials, smooth shading, pose/contact IK, rig-weight changes for grounding, scene lighting, gentle joint sway and the approved 75-degree pair turn. Source and delivery hashes are in `tests/fixtures/opening-bounds.json`. Missing external photographic textures were not restored. The raw model and working scenes remain private. |
| `curtain-closed.jpg`, `curtain-open.jpg`, their `-wide` variants, and both `video/curtain-reveal*.mp4` files | The licensed couple is rendered within the original curtain, glitter, lighting and stage scene. Portrait 720x1440 and landscape 1600x900 renders share a 6.75-second timeline. The 75-degree turn runs from 2 to 6 seconds; curtains clear at 2.5 seconds. Posters are decoded from each finished movie at native dimensions. No promotional preview image or source-video frame is used as a website asset. |
| Glitter on the curtain surface | Included in the original rendered material so it follows the same cloth movement. No detached canvas particle layer, microphone or downloaded texture. |
| `butterfly.svg` | Original scalable pearl-and-gold butterfly with veined wings, fine gilt edges, wing spots, body and antennae. CSS wingbeats and flight are synchronised to the opening movie's frame time where supported. No downloaded butterfly artwork. |
| Butterfly trail and scene highlights | Original layered gold wake and drifting dust drawn along the butterfly's actual path, with random spread, size, lifetime and gentle twinkling. Capped at 320 particles. Twenty-four finite scene glints and a masked foreground stage-light bloom fade out before the handoff. No particle library, external effect assets or reference-video pixels are used. |
| `toran.svg` | Original layered marigold swags, rose knots, mango leaves and gold pendants joining the programme days. |
| `botanical.svg`, `flower.svg`, `vine-border.svg`, `embroidery.svg` | Original curved botanical stems, veined leaves, roses, layered marigold petals and decorative stitching. |
| `ceremonies.svg` | Original matching Haldi bowl, rings and dhol, decorated horse, Jai Mala flower garlands, Phere fire and candlelit Gala Dinner table illustrations. No downloaded icons or illustration libraries. |
| `floral-bridge.svg` | Original layered roses, marigolds, jasmine, foliage and hanging blooms with pearl/gold chains above the countdown. |
| `page-sparkle.svg` | Original sparse gold edge glints. CSS ties their movement to scrolling, with a static fallback and no pointer interception. Reduced motion and forced colours disable the effect. |
| `rsvp-envelope-*.webp` | Derived from the user-approved generated wedding-envelope concept, using the supplied dog illustration as a likeness reference. The concept shows small dogs helping with an ivory, burgundy and gold invitation. Only printed lettering and the raster button were replaced with sampled paper texture; the dogs, envelope, lining, ribbon and seal remain intact. Four WebP layers support responsive blank-paper spacing without stretching the figures. The actual heading, signature, date, venue and form button are HTML. See `tests/fixtures/rsvp-artwork.json` for hashes and handling. Full concept PNGs and supplied references remain private. |
| `textile.svg` | Original low-opacity procedural fibre texture. The invitation uses a warm woven textile ground following visual feedback. |
| `audio/ishq-wala-love-instrumental-v3.m4a` | Current user-supplied instrumental labelled "Ishq Wala Love". The user confirmed permission to publish this supplied recording on the public website on 19 November 2026. Removed 2.6106875 seconds of digital silence, retaining every nonzero source sample and a short preroll. The delivery uses a 50ms fade-in, two-second fade-out and the existing quiet gain. Its duration is 254.722625 seconds. `tests/fixtures/music.json` binds provenance and timing to the exact output hash. The full source MP3 remains unchanged and private. No broader redistribution licence is asserted. |
| `audio/vaaroon-forever.m4a` | Retained earlier, inactive 61-second excerpt of the user-supplied "Vaaroon Forever" recording. The couple confirmed its public website permission on 28 October 2026. It is not the active soundtrack. |

The October reference informed the continuous floral-paper composition. The 11 November reference informed the ruby glitter, velvet opening, spotlight and sequential typography. Neither recording, its audio, extracted frames, phone interface or creator artwork is included in the website or repository.

The active Timo77 couple uses the approved 150-to-225-degree sweep. Across all 162 poses it retains at least 61.67514% upper clearance and 4.06195% lower clearance. Both partners remain readable, with grounded feet/hem and contact-preserving hands. It is a generic couple, not a likeness of Shubh and Suchita.

The retained scan-authoring helpers concern the earlier [3dklon colour scan](https://sketchfab.com/3d-models/the-groom-and-bride-7e4b1e8d7bed46fbae6cba904455936b), whose CC BY 4.0 licence was verified during that experiment. That scan is not used in the active movies and its raw source is not published.

## Impact

Fonts, illustrations and music are local. The approximately 2.57 MB current soundtrack loads only after activation and movie preparation. The user-approved Google Forms embed loads near the RSVP section; the directions link opens Google Maps on request. Neither receives the private reference media.

## Risks and open questions

The user approved publishing the current invitation and confirmed public-use permission for the supplied soundtrack on 19 November 2026. That approval does not grant a general licence for other people to redistribute the recording, logo or supplied references.

## Ask / Next steps

| Action | Owner | Date |
|---|---|---|
| Retain `OFL.txt` with any redistributed font files | Implementer | Whenever assets are distributed |
| Confirm permission again if a different recording or personal source asset is introduced | Owner and implementer | Before future publication |
