# Roadmap Item: Archive.org Per-Minute Filmstrip Thumbnails (Future / Not Current Bug)

**Status:** Proposed future feature — explicitly NOT part of the current Live Matrix Guide blank-cell bug fix. Do not merge this into that work. The current bug fix (SlideOutGuide.tsx / seg.thumbBase) must be confirmed working and deployed first, independently of this item.

## What prompted this

Archive.org's own TV News Archive detail pages (e.g. `archive.org/details/{identifier}/start/{sec}/end/{sec}?q=...`) render a real per-minute experience: a timeline of minute markers, a thumbnail under each marker showing that minute's frame, a closed-caption transcript block per minute, and click-to-seek from any thumbnail/transcript into that exact timestamp.

This is a genuinely different (and much richer) capability than what the current Live Matrix Guide grid needs or has. The guide grid shows one static thumbnail per channel/time-block cell; this is a full per-second scrubbing UI within a single broadcast.

## What is NOT yet known — investigate before building anything

1. **Is there a public, documented Archive.org API for this data**, or does the details page assemble it via internal/undocumented frontend calls? If the latter, treat this as fragile — Archive.org can change or block it without notice, and hotlinking internal endpoints may violate their terms of use.
2. **What is the actual image URL pattern** the details page uses for each minute thumbnail? Confirm by inspecting real network requests on an actual Archive.org details page (not guessed/assumed, per the earlier fabricated `/frame_0001.jpg` pattern that turned out not to exist).
3. **Is the transcript data (closed captions) available via a stable endpoint**, separate from the thumbnails? Needed if transcript display is in scope.
4. **Rate limits / ToS**: does pulling per-minute thumbnails at scale (across a 48-channel x 24-hour grid, i.e. potentially thousands of image requests) violate Archive.org's acceptable use, or risk IP-level throttling/blocking?

## Scope questions to resolve before committing engineering time

- Is this meant to replace the single static thumbnail in the guide grid cells, or is it a *separate* feature — e.g. a detail/expanded view that opens when a user clicks into a specific segment (closer to how Archive.org itself presents it)?
- If it's grid-wide, the request volume (one image per minute × many channels × 24 hours) may be impractical — confirm expected image count and whether a lower-frequency sampling (e.g. one thumbnail per 5 or 15 minutes) is sufficient instead of true per-minute.
- Does this need transcript/caption display, or is it purely visual scrubbing?

## Recommended next step

Before any implementation: have someone manually inspect the Network tab on a real Archive.org details page (like the Will Cain Show example) and paste the actual thumbnail image request URL(s) as they really fire — not a reconstructed guess. That single piece of evidence determines whether this feature is realistically buildable on a stable, public URL pattern, or whether it would require reverse-engineering an internal API not intended for third-party use.
