# Media Title Regex Cleanup Playbook

This playbook explains how, why, and when to use custom regular-expression logic to clean messy media titles from M3U playlists, Archive.org-derived URLs, OCR/chyron feeds, and scene-style release filenames in this project. It documents the existing implementation (server/m3u-parser.ts, and the ThirdEye/Archive URL utilities reviewed alongside it) — it does not introduce a new title-cleaning utility, bulk-rename existing rows, or replace the ThirdEye headline remastering task.

Scope note: this playbook covers the title/URL cleanup logic (remasterHeadline, rescueUrlHeadline, parseThirdEyeToot, getSafeArchiveUrl, getArchiveExportUrl, chunkItem) and the M3U parsing logic in m3u-parser.ts. It does not cover Archive.org search/collection-enumeration functions (searchArchiveItems, fetchArchiveCollection, etc.) — those handle querying, not title cleanup, and weren't in scope for this document.

## 1. What this is
Custom title regex logic in this project is a set of targeted recognition and transformation rules — not one giant catch-all expression. Each pattern has a narrow job: recognize an episode code, strip a known release tag, extract an Archive.org identifier from a URL, or rescue a chyron that's nothing but a bare URL. They compose in a defined order rather than being merged into a single monster regex, because a single regex trying to do everything is unauditable and impossible to safely extend.

## 2. Why it's needed
Titles in this project arrive from several structurally different, uncontrolled sources:
- M3U `#EXTINF` labels with inconsistent attribute formatting (group-title, tvg-id, tvg-name, tvg-logo).
- Scene-release-style filenames with separators, quality/source tags, and container extensions (Columbo.S01E01.1080p.HEVC.x265.mkv).
- Archive.org URL-encoded filenames and identifiers, in both redirect form (archive.org/download/{id}/...) and direct CDN-node form (ia######.us.archive.org/N/items/{id}/...).
- OCR-derived chyron text (ThirdEye headlines) — often mixed-language, sometimes pure Cyrillic, sometimes a bare URL, sometimes genuinely broken.

None of these can be cleaned with one rule, and blind global substitution risks destroying exactly the structured information (episode numbers, dates, timestamps) that downstream code depends on.

## 3. When to use regex vs. alternatives
| Situation | Use |
| :--- | :--- |
| Recognizing a known structural pattern (S01E02, [YYYY-MM-DD HH:MM], a URL's path segments) | Regex |
| Extracting a specific field already in a structured format (URL query params) | URL / URLSearchParams (see getSafeArchiveUrl) — not manual string splitting |
| Looking up the real value of something (actual duration, actual title) | Metadata API call (e.g. /metadata/{identifier}), not regex guessing |
| A title that repeatedly breaks every pattern | Manual/operator override — don't keep adding one-off regex branches for a single bad title |
| Simple, non-ambiguous string cleanup (trim, collapse whitespace) | Ordinary string methods — regex is overkill and harder to read |

## 4. The staged pipeline
Every cleanup path in this codebase follows the same implicit shape, and new cleanup logic should too:
1. **Preserve raw input** — parseThirdEyeToot keeps rawText intact through sanitization; never mutate the original in place.
2. **Extract structured attributes** — M3U attribute regexes (group-title="...", etc.) run first, independent of title cleanup.
3. **Recognize episode/date/time patterns** — season/episode and TV-news bracket patterns are matched before any generic noise-stripping, so a date or episode number is never mistaken for noise.
4. **Remove only known noise** — explicit token lists (quality tags, container extensions), never a broad "strip anything that looks technical" rule.
5. **Normalize separators and whitespace** — `.replace(/[._]/g, " ").replace(/\s+/g, " ").trim()` — applied last, after content-bearing tokens are already safe.
6. **Validate the result** — e.g. parseThirdEyeToot rejects anything under 5 characters after cleanup rather than saving garbage.
7. **Retain a fallback when confidence is low** — Cyrillic-strip fallback in remasterHeadline when no Archive.org URL is present to mine; rescueUrlHeadline's domain-extraction fallback when stripping a URL leaves nothing useful.

## 5. Catalog of current patterns

**M3U attributes (m3u-parser.ts, parseExtInfAttributes)**
- `group-title="([^"]*)"`
- `tvg-id="([^"]*)"`
- `tvg-name="([^"]*)"`
- `tvg-logo="([^"]*)"`
- `tvg-object-position="([^"]*)"`
Simple, anchored attribute-value extraction. Case-insensitive (i flag) since M3U producers vary in casing.

**Episode number forms (m3u-parser.ts, seasonEpisodePatterns)**
- `S(\d{1,2})E(\d{1,3})\s*-\s*(.+)`
- `S(\d{1,2})E(\d{1,3})\s+(.+)`
- `Season\s*(\d+)\s*Episode\s*(\d+)\s*-\s*(.+)`
- `(\d+)x(\d{1,3})\s*-\s*(.+)`
Tried in order; first match wins. The NxNN form (1x01) is deliberately last since it's the most ambiguous (could false-positive on other numeric patterns) — specific patterns are ordered before generic ones.

**TV news bracket + trailing-duration forms (m3u-parser.ts, parseEpisodeInfo)**
- `^(.+?)\s+\[(\d{4})-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s+\d{2}:\d{2}\s*$`   (segment, with trailing clock time)
- `^(.+?)\s+\[(\d{4})-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*$`                  (whole show)
Must be matched before the generic trailing-number fallback, or the clock digits (12:00) get mistaken for an episode number. This is a documented, deliberate ordering constraint — moving the trailing-number check earlier would silently corrupt every TV news title.
Same date-protection principle appears in parseThirdEyeToot's identifier date extraction: `_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_|$)` anchored to the known CALLSIGN_YYYYMMDD_HHMMSS identifier shape, not a loose digit scan.

**Archive.org URL extraction and normalization**
Two identifier forms, both handled:
- `archive\.org\/download\/([^/]+)/`                                    (redirect form)
- `ia\d+\.us\.archive\.org\/\d+\/items\/([^/]+)/`                       (CDN-direct form)
`getSafeArchiveUrl` / `getArchiveExportUrl` normalize CDN-direct URLs back to the redirect form (`archive.org/download/...`) — deliberately, since the redirect form works without session cookies and the CDN-direct form can 403 when hit directly. Both also strip `?start=`/`?end=`/`?ignore=` params via URLSearchParams (structured extraction, not regex, for query strings) and append a `.mp4` extension when the path's last segment has no extension.

`chunkItem` confirms the project's real segment-chunking default: maxChunk = 300 seconds — matching the confirmed-working 300s pattern used elsewhere in this project's playback logic, with explicit bypass rules for local files, VHS/Long Play/Movie-tagged items, and anything already under the chunk size.

**Scene-release noise tokens (remasterHeadline / remasterHeadlineHardened)**
- `/(720p|1080p|WEB|H264|H265|HEVC|BluRay|x264|x265|HDTV|WEBRip|EZTV|\[.*?\]|\.mp4|\.mkv|\.avi)/gi`
An explicit whitelist of known noise tokens — not a generic "strip anything alphanumeric-looking" rule. remasterHeadlineHardened extends the bare-episode-code check to also recognize 1x01-style codes (not just S01E01) before deciding whether to prepend the parent folder name.

**Cyrillic / OCR cleanup and ASCII-only boundaries**
- `[\u0400-\u04FF\u0500-\u052F]`   — Cyrillic block + supplement, stripped
- `Канал\s*\d*`                     — explicit guard, redundant after the block strip but kept intentionally
parseThirdEyeToot applies a final ASCII-safety-net regex (`[^\w\s.,!?'":;()\-–—]` → space) after the Cyrillic strip — this is a deliberate boundary: full Unicode is preserved through the OCR-cleanup stage, and only non-ASCII noise that survives is caught by the final safety net. Pure-Cyrillic entries (e.g. "Канал 24" → "24") are rejected upstream by the 5-character minimum-length check, not by a special-case rule.

**Bare-URL rescue (rescueUrlHeadline)**
Distinguishes three cases explicitly, in order: a pure URL with nothing else (→ bare domain), a www.-only form (→ bare domain), and a URL mixed with surrounding text (→ strip just the URL, keep the words). Falls back to surfacing the domain if stripping leaves too little text — never returns an empty title silently.

## 6. Before/after examples
| Input | Output | Why |
| :--- | :--- | :--- |
| Канал https://archive.org/download/get-smart/Get.Smart.S01E01.mp4 | Get Smart S01E01 | Archive.org URL mined first (highest priority), noise tokens stripped, separators normalized |
| https://archive.org/download/columbo/Columbo.S01E01.1080p.HEVC.x265.mkv | Columbo S01E01 | Quality/codec/container tokens stripped by the explicit noise regex |
| Канал 24 | 24 → rejected upstream (< 5 chars) | Cyrillic-strip fallback with no Archive.org URL to mine |
| BREAKING: Москва объявляет — details at 9 | BREAKING: — details at 9 | Cyrillic stripped, ASCII content preserved as-is |
| https://cnn.com/story/2026 | cnn.com | Pure-URL rescue → bare domain |
| Go to rt.com/latest tonight | Go to tonight | Mixed URL+text → URL portion stripped, words kept |
| ALF - S01E01 - A.L.F SDTV | ALF - S01E01 - ALF (after playbook-recommended SDTV + duplicate-acronym rules) | Broadcast-format suffix and redundant spelled-out acronym both need explicit, catalogued rules — confirmed necessary from real crawl data in this project |
| Fox Friends Weekend [2026-03-14 12:00] 00:05 | season=2026, episode=fallback, title=Fox Friends Weekend | TV-news segment pattern matched before generic trailing-number fallback protects the clock digits from misparse |

## 7. Regex design rules
1. **Anchor patterns where possible** (`^...$`, or bounded groups) — unanchored patterns risk matching substrings inside unrelated text.
2. **Use capture groups deliberately** — every capture group in this codebase's patterns is consumed; don't add groups "just in case."
3. **Order specific patterns before generic ones** — demonstrated directly by the TV-news-bracket-before-trailing-number ordering, and the NxNN episode form being tried last.
4. **Case-insensitive matching only where safe** — M3U attribute names and file extensions vary in casing legitimately; content that could collide across cases (e.g. distinguishing a real word from a coincidental match) should not blindly use `i`.
5. **Avoid greedy URL matching** — getSafeArchiveUrl and friends parse with the URL/URLSearchParams APIs rather than regex-matching an entire URL string, specifically to avoid greedy-match bugs on query strings.
6. **Protect S01E01 and dates from generic number stripping** — the single most important rule in this codebase, enforced by ordering (see §5/§6).
7. **Document every destructive replacement** — every noise-stripping regex above ships with an inline comment explaining exactly what it targets and why; new patterns should match this standard.

## 8. Failure modes and safeguards
- **False positives / over-cleaning** — a too-broad noise token could strip real title words. Mitigated by using explicit token whitelists (remasterHeadline's noise regex lists exact strings, not a character class).
- **Duplicate separators / whitespace debt** — always finish with `.replace(/\s+/g, " ").trim()`, applied once, at the end of the pipeline — not scattered mid-pipeline where it can mask a bug in an earlier step.
- **Encoded characters** — always `decodeURIComponent` filenames pulled from URL paths before running text regexes against them (as remasterHeadline does), or percent-encoding artifacts will pollute the output.
- **Punctuation loss** — the ASCII safety-net regex in parseThirdEyeToot explicitly preserves a punctuation whitelist (`.,!?'":;()-–—`) rather than stripping to bare alphanumerics.
- **Partial matches / catastrophic backtracking** — prefer bounded quantifiers and anchored groups over unbounded greedy patterns on untrusted input length; TSV rows are truncated to 500 chars before heavier regex processing in parseThirdEyeToot, specifically to bound worst-case processing cost.
- **Regex escaping in TypeScript strings** — `GET_SAFE_ARCHIVE_URL_JS` is a second, client-side JavaScript copy of getSafeArchiveUrl's logic embedded as a template string, with manually double-escaped backslashes. This is a real, currently-existing duplication risk: the server (getSafeArchiveUrl) and this embedded client copy can drift out of sync silently, since nothing enforces they stay identical. Any future change to the URL-normalization logic must update both, or the two will diverge without a build error.
- **Ambiguous trailing numbers** — the plain trailing-number episode fallback (`\s(\d+)\s*$`) is deliberately the last resort, tried only after every more specific pattern (season/episode forms, TV-news bracket forms, parenthetical episode numbers) has failed to match.
- **Near-duplicate function drift** — `remasterHeadline` and `remasterHeadlineHardened` currently contain nearly identical logic (the latter additionally recognizes NxNN codes), with `remasterHeadlineFromUrl` re-exported as an alias of the former. This is a real, existing consolidation opportunity — flagged here for awareness; implementing the consolidation is out of scope for this document.

## 9. Testing guidance
- **Table-driven examples** — one row per input/expected-output pair, covering ordinary series, scene releases, Archive.org filenames, live/news titles, bare and mixed URLs, multilingual/Cyrillic text, and malformed/empty input. The examples in §6 above are a starting fixture set.
- **Idempotence** — running cleanup twice on an already-cleaned title must produce the same result. Verify this explicitly for any new pattern.
- **Preservation checks** — assert that episode numbers, dates, and clock times in the before/after pairs are never altered or dropped.
- **Malformed/empty input** — parseThirdEyeToot returns null (not a thrown error, not an empty-string episode) for malformed rows; new cleanup functions should follow this fail-closed convention rather than producing a garbage title.
- **Regression fixtures** — real playlist and release-title variants captured from actual project data (as in tests/thirdEyeRemaster.test.ts) are more valuable than synthetic examples, since real sources produce edge cases synthetic data won't anticipate.

## 10. Provenance and confidence policy
Every cleaned title should be traceable back to its inputs. Recommended fields, consistent with what InsertEpisode already carries in this schema:
| Field | Purpose |
| :--- | :--- |
| Raw title | The untouched original — never overwritten |
| Cleaned display title | The output of the staged pipeline |
| Parsed season / episode | Structured fields extracted during recognition, independent of the display title |
| Source filename / identifier | The Archive.org identifier or original filename the title was derived from, for re-derivation if cleanup logic changes |
| Confidence / provenance | Which stage produced the final title (URL-mined, Cyrillic-fallback, rescued-from-URL, manual override) — so low-confidence results can be audited or reverted later |

## 11. Source-aware trust
An Archive.org filename, an M3U display label, and an OCR chyron do not have identical trust or parsing rules. An Archive.org filename is machine-generated and structurally reliable — safe to mine aggressively (as remasterHeadline does, prioritizing it above all else). An OCR chyron is inherently noisy and may be partially garbled — cleanup should be conservative and fail closed (reject rather than guess) when confidence is low, exactly as the 5-character minimum-length rejection does. A user-supplied M3U title should be respected as intentional unless it matches a very specific, well-understood noise pattern — cleanup logic should never assume a human-authored title is "wrong" just because it doesn't match an expected shape.
