# Invitation asset sources

Owner: Shubh & Suchita  
Date: 14 November 2026

## TL;DR

- The supplied pink monogram retains its colour, proportions and meaningful details.
- All scenery, textile and ceremony SVGs were authored for this invitation.
- Cormorant fonts retain their existing SIL Open Font License.
- Reference photographs and video frames are not shipped.
- The soundtrack is a user-supplied "Vaaroon Forever" excerpt, with public website permission confirmed by the couple.

## Why this matters

The visual references guide the composition, not the reuse or tracing of another invitation's artwork. The original website and supplied source assets remain unchanged.

## What we are doing

| Asset | Source and handling |
|---|---|
| `monogram.jpg` | User-supplied `WhatsApp Image 2026-09-24 at 17.18.28.jpeg`. Resampled from 1254 square to 400 square for its 44-110px display sizes, using macOS `sips` and an optimised progressive JPEG at quality 87. No recolouring, distortion or meaningful-detail cropping. The original file was not modified. |
| `cormorant-garamond-medium.woff`, `cormorant-garamond-italic.woff` | Derived from the old project's existing local TTF fonts using installed FontTools. WOFF compression retains Latin and extended Latin characters, punctuation, arrows and layout features, with no change to the invitation's glyph appearance. Copyright 2015 the Cormorant Project Authors. See `assets/fonts/OFL.txt` for the complete SIL Open Font License 1.1. The source fonts remain unchanged in the old project. |
| `evara-garden.svg` | Original illustration informed by the supplied read-only venue photographs: cream cottages, dark sloping roofs, terraces, lawn, pool and wooded hills. No photo is included. Not a rendering of booked wedding decor. |
| `curtain-closed.jpg`, `curtain-open.jpg`, their `-wide` variants, and both `video/curtain-reveal*.mp4` files | Original 3D scene authored in `tools/render_opening.py`: modeled cloth folds, a visibly turning bride and groom, silk skirt, sheer veil, jewellery, suit, directional lighting and a theatre stage. Portrait 720x1440 and landscape 1600x900 renders share a 6.75-second timeline. The 75-degree turn runs from 2 to 6 seconds; curtains fully clear at 2.5 seconds. Posters are decoded from each finished movie at native dimensions. Rendered with verified official Blender 4.5.16 LTS. No template, downloaded character, third-party scene or source-video frame was used. |
| Glitter on the curtain surface | Included in the original rendered material so it follows the same cloth movement. No detached canvas particle layer, microphone or downloaded texture. |
| `butterfly.svg` | Original scalable pearl-and-gold butterfly with veined wings, fine gilt edges, wing spots, body and antennae. CSS wingbeats and flight are synchronised to the opening movie's frame time where supported. No downloaded butterfly artwork. |
| Butterfly trail and scene glints | Original soft gold-dust trail drawn along the butterfly's actual path, with random position spread, drift, size, brightness and lifetime. Capped at 120 particles and stopped after the reveal. Small four-point scene glints use finite CSS animation. No particle library or external effect assets. |
| `toran.svg` | Original marigold garlands joining the programme days. |
| `botanical.svg`, `flower.svg`, `vine-border.svg`, `embroidery.svg` | Original curved botanical stems, veined leaves, roses, layered marigold petals and decorative stitching. |
| `ceremonies.svg` | Original matching Haldi bowl, rings and dhol, decorated horse, Jai Mala flower garlands, Phere fire and candlelit Gala Dinner table illustrations. No downloaded icons or illustration libraries. |
| `floral-bridge.svg` | Original rose, marigold, foliage and hanging-flower border above the countdown. |
| `textile.svg` | Original low-opacity procedural fibre texture. The invitation uses a warm woven textile ground following visual feedback. |
| `audio/vaaroon-forever.m4a` | User-supplied "Vaaroon Forever" by Anand Bhaskar, Romy, Shreya Ghoshal and Ginny Diwan. The couple confirmed permission for public website use on 28 October 2026 and selected 00:18 to 01:19. `tools/prepare_music.py` extracts that 61-second section, applies two-second fades and matches background volume before AAC encoding. The supplied full recording is unchanged and is not included in the repository. No broader redistribution licence is asserted. |

The October reference informed the continuous floral-paper composition. The 11 November reference informed the ruby glitter, velvet opening, spotlight and sequential typography. Neither recording, its audio, extracted frames, phone interface or creator artwork is included in the website or repository.

The character refinement reduces both figures uniformly by 10% around the stage-contact pivot, not by resizing the finished video. The bride's design remains unchanged. The groom has a short tapered, swept haircut and a continuous tailored-trouser mesh with a slightly staggered, grounded stance. Camera framing, curtain timing, the 75-degree turn and stage lighting are preserved.

## Impact

Fonts, illustrations and music are local. The 611 KB soundtrack loads only after opening the invitation. The user-approved Google Forms embed loads near the RSVP section; the directions link opens Google Maps on request. Neither receives the private reference media.

## Risks and open questions

The supplied logo includes personal details. Public sharing requires the couple's separate approval. This file records sources, not permission to publish.

## Ask / Next steps

| Action | Owner | Date |
|---|---|---|
| Retain `OFL.txt` with any redistributed font files | Implementer | Whenever assets are distributed |
| Approve public sharing of personal assets and family details | Shubh & Suchita | Before public hosting |
