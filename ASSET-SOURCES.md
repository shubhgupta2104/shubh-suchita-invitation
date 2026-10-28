# Invitation asset sources

Owner: Shubh & Suchita  
Date: 28 October 2026

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
| `monogram.jpg` | User-supplied `WhatsApp Image 2026-09-24 at 17.18.28.jpeg`. Resampled from 1254 square to 640 square using macOS `sips`, JPEG quality 87. No recolouring, distortion or meaningful-detail cropping. The original file was not modified. |
| `cormorant-garamond-medium.ttf`, `cormorant-garamond-italic.ttf` | Copied from the old project's existing local fonts. Copyright 2015 the Cormorant Project Authors. See `assets/fonts/OFL.txt` for the complete SIL Open Font License 1.1. |
| `evara-garden.svg` | Original illustration informed by the supplied read-only venue photographs: cream cottages, dark sloping roofs, terraces, lawn, pool and wooded hills. No photo is included. Not a rendering of booked wedding decor. |
| `fabric.svg`, `valance.svg`, `side-drape.svg`, `toran.svg` | Original pleated-fabric shading, embroidered sprigs, scalloped drapes, tied side curtains, tassels and marigold garlands. |
| `botanical.svg`, `flower.svg`, `vine-border.svg`, `embroidery.svg` | Original curved botanical stems, veined leaves, roses, layered marigold petals and decorative stitching. |
| `ceremonies.svg` | Original matching Haldi bowl, rings and dhol, decorated horse, and Phere fire illustrations. No downloaded icons or illustration libraries. |
| `floral-bridge.svg` | Original continuous rose, marigold, foliage and hanging-flower border joining the garden and following scenes. |
| `textile.svg` | Original low-opacity procedural fibre texture. The invitation uses a warm woven textile ground following visual feedback. |
| `audio/vaaroon-forever.m4a` | User-supplied "Vaaroon Forever" by Anand Bhaskar, Romy, Shreya Ghoshal and Ginny Diwan. The couple confirmed permission for public website use on 28 October 2026 and selected 00:18 to 01:19. `tools/prepare_music.py` extracts that 61-second section, applies two-second fades and matches background volume before AAC encoding. The supplied full recording is unchanged and is not included in the repository. No broader redistribution licence is asserted. |

The private reference film and its contact sheet informed the curtain-to-hero flow and continuous floral paper composition only. They were not copied into the project or used as website images.

## Impact

Fonts, illustrations and music are local. The 611 KB soundtrack loads only after opening the invitation. The user-approved Google Forms embed loads near the RSVP section; the directions link opens Google Maps on request. Neither receives the private reference media.

## Risks and open questions

The supplied logo includes personal details. Public sharing requires the couple's separate approval. This file records sources, not permission to publish.

## Ask / Next steps

| Action | Owner | Date |
|---|---|---|
| Retain `OFL.txt` with any redistributed font files | Implementer | Whenever assets are distributed |
| Approve public sharing of personal assets and family details | Shubh & Suchita | Before public hosting |
