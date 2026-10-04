---
name: guide-content-and-sources
description: Use when revising consumer-facing copy in index.html or home-theater.html, speaker/router comparisons, setup, Wi-Fi, or smart-home advice, source notes under docs/sources, or the conversation transcript.
---

# Guide content and sources

The reader is an everyday person, not an installer. Keep it practical, plain-spoken, and budget-aware.

## Where the research lives

| File | Covers |
| --- | --- |
| `docs/sources/alexa-home-theater-amazon-help.md` | Amazon setup steps, prerequisites, HDMI ARC, troubleshooting |
| `docs/sources/eero-built-in-echo-speakers.md` | eero Built-in coverage, speed and client limits, supported models, app steps |
| `docs/sources/echo-studio-wifi-smart-home.md` | Studio coverage claim, Zigbee/Matter/Thread, smart-home hub caveats |
| `docs/sources/echo-dot-max-vs-echo-studio.md` | Image-transcribed speaker specifications and the "3× bass" footnote |
| `docs/sources/home-theater-shopping-costs.md` | Cart examples, starter arithmetic, eero and Fire TV listing prices |
| `docs/sources/amazon-live-pricing-architecture.md` | Proposed compliant offer endpoint and caching rules |

Keep one topic per file, cross-link related notes, and state where each claim came from: supplied material, a screenshot transcription, or independent verification. Update the directly related note whenever a page, price, or capability changes.

## Rules

- Keep compatibility conditional and scoped. Model generation, region, and app-version limits belong next to the claim. Never write "guaranteed" for something that is merely compatible.
- Preserve the separation between the three capabilities: Alexa Home Theater audio, eero mesh networking, and eero Built-in Echo extension. They need separate devices and separate setup.
- Label every amount as a user-supplied snapshot from October 4, 2026, not a live quote. Never invent a specification or price, and never silently correct a supplied one.
- Do not imply an Echo temperature sensor or routine creates HVAC zones; independent room control depends on the home's HVAC equipment and compatible thermostats.
- `home-theater.html` diagrams are illustrative layouts, not channel maps. Speaker models cannot be mixed, and some Fire TV devices support only two speakers plus a Sub.
- The transcript at `docs/conversations/2026-10-04-home-theater-planning.md` is append-only and chronological. The user asks for each pasted exchange to be recorded after every interaction, not batched at the end, until they say "done". Match the existing `### User` / `### Assistant` shape and never include secrets or account/delivery details from the cart screenshots.

## Verification

Prose-only edits need no build, but copy inside a priced element still needs `npm run test:coverage` because the suite asserts specific wording. Assert new wording with a matching test so the guarantee is explicit. For visual or responsive changes, preview with `python3 -m http.server 8000` and check contrast and overflow at desktop, tablet, and mobile widths.
