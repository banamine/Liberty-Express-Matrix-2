# App Export Review

## 1. App Identity
- **Name**: "" (The name field in `metadata.json` is currently empty)
- **Description**: "" (The description field in `metadata.json` is currently empty)
- **AI Studio Applet ID**: `cdd0c23b-561c-4e6c-a515-a4df3def1c99`
- **Google Cloud Project ID**: `raoebohujuyks2vvwlantj-804326557407` (derived from Dev URL)
- **Google Cloud Project Number**: `804326557407`

## 2. GitHub Connection
No remote is currently connected. The command `git remote -v` fails, and there is no GitHub repository configured in `.git/config` for source sync.

## 3. Remix Lineage
I do not have access to internal AI Studio remix/fork lineage metadata to definitively state if this applet was created as a "Remix" via the AI Studio UI of another specific applet ID. However, architecturally and based on the codebase history, it is part of the Nexus TV-O / M3U Matrix Stripper family (detailed below).

## 4. Live Deployments
This app is currently deployed and serving traffic via Google Cloud Run:
- **Development App URL**: `https://ais-dev-raoebohujuyks2vvwlantj-804326557407.us-east1.run.app`
- **Shared App URL**: `https://ais-pre-raoebohujuyks2vvwlantj-804326557407.us-east1.run.app`

## 5. File Tree
```text
.
./assets
./assets/.aistudio
./assets/.aistudio/.gitignore
./bbc_sample.json
./bun.lock
./check_archive.js
./check_format.cjs
./check_metadata.cjs
./check_routes.cjs
./cnn_sample.json
./components.json
./db
./db/archives
./db/archives/2026-08.json
./docs
./docs/media-title-regex-playbook.md
./drizzle
./drizzle/0000_sad_warbound.sql
./drizzle.config.ts
./drizzle/meta
./drizzle/meta/0000_snapshot.json
./drizzle/meta/_journal.json
./.env.example
./EXPORT_FOR_REVIEW.md
./file_tree.txt
./fix_archive_import.cjs
./fix_archive_routes.cjs
./fix_archive_shared.cjs
./fix_bumper.cjs
./fix_countdown.cjs
./fix_db.cjs
./fix_news_player.cjs
./fix_news_player_overlay.cjs
./fix_player2.cjs
./fix_player2_interaction.cjs
./fix_routes_async.cjs
./fix_routes.cjs
./fix_slideout.cjs
./fix_tv.cjs
./fix_tv_overlay.cjs
./fix_viewer2.cjs
./fix_viewer.cjs
./full-test.m3u
./get_logs.cjs
./get_proof.cjs
./.github
./.github/workflows
./.github/workflows/daily-update.yml
./.github/workflows/deploy.yml
./.gitignore
./index.html
./insert_probe.sh
./logs
./logs/agent-activity.json
./metadata.json
./migrations
./migrations/0000_tidy_nightmare.sql
./migrations/0001_stale_rumiko_fujikawa.sql
./migrations/0002_add_telemetry.sql
./migrations/0002_massive_nemesis.sql
./migrations/0003_curious_donald_blake.sql
./migrations/meta
./migrations/meta/0000_snapshot.json
./migrations/meta/0001_snapshot.json
./migrations/meta/0002_snapshot.json
./migrations/meta/0003_snapshot.json
./migrations/meta/_journal.json
./out.txt
./package.json
./package-lock.json
./patch2.cjs
./patch3.cjs
./patch4.cjs
./patch5.cjs
./patch6.js
./patch_archive.cjs
./patch_archive_import_dialog.cjs
./patch_archive_import_items.cjs
./patch_archive_inserts.cjs
./patch_archive_page.cjs
./patch_archive_queue_poll.cjs
./patch_archive_routes.cjs
./patch_archive_shared.cjs
./patch_batch_ingest.cjs
./patch_bulk_titles.cjs
./patch_bulk_titles.ts
./patch.cjs
./patch_countdown.cjs
./patch_crawl.cjs
./patch_dashboard.cjs
./patch_delete.cjs
./patch_episode_patch.cjs
./patch_episodes_player.cjs
./patch_fetch.cjs
./patch_guide_keys.cjs
./patch_harvester.cjs
./patch_import.cjs
./patch_import_items_telemetry.cjs
./patch_import.js
./patch.js
./patch_keys.cjs
./patch_log.cjs
./patch_main2.cjs
./patch_main.cjs
./patch_news_player2.cjs
./patch_news_player.cjs
./patch_onconflict.cjs
./patch_player1_advance.cjs
./patch_player1.cjs
./patch_player1_rebalance.cjs
./patch_player2_advance.cjs
./patch_player2.cjs
./patch_routes.cjs
./patch_routes.js
./patch_rumble.cjs
./patch_rundown.cjs
./patch_schema.cjs
./patch_schema_index.cjs
./patch_server.cjs
./patch_slideout.cjs
./patch_timetravel.cjs
./patch_toast.cjs
./patch_tv2.cjs
./patch_tv3.cjs
./patch_tv.cjs
./patch_ui.cjs
./patch_viewer.cjs
./patch_watchdog.cjs
./patch_workbench.cjs
./patch_workbench_payload.cjs
./public
./public/data
./public/data/daily-rundown.json
./public/placeholder-thumbnail.png
./public/placeholder-thumbnail.svg
./qa_answers.txt
./query_neon.cjs
./README.md
./rumble_live_resolver.py
./run_migrations.cjs
./run_pglite.cjs
./server
./server/aj-pool.ts
./server/archive-deep-crawler.ts
./server/archive-list-crawler.ts
./server/archive-routes.ts
./server/archive-utils.ts
./server/bumper-harvester.ts
./server/db
./server/db/index.ts
./server/dynamic-rundown.ts
./server/health-check.ts
./server/historical-bumpers.json
./server/hls-scraper.ts
./server/m3u-parser.ts
./server/matrix-guide.ts
./server/news-builder.ts
./server/ntd-playout-engine.ts
./server/ntd-schedule.ts
./server/playlist-filter.ts
./server/playlist-routes.ts
./server/routes.ts
./server/scheduler.ts
./server/time-series.ts
./server/transcript-parser.ts
./server.ts
./server/user-browse-routes.ts
./server/vite.ts
./server/watchdog.ts
./shared
./shared/news-registry.ts
./shared/schema.ts
./src
./src/App.tsx
./src/components
./src/components/ActionToolbar.tsx
./src/components/ArchiveImportDialog.tsx
./src/components/ArchiveNativePlayer.tsx
./src/components/ArchiveQueueManager.tsx
./src/components/archive-shared.tsx
./src/components/AutoTagDialog.tsx
./src/components/BrowseUserDialog.tsx
./src/components/BulkCleanTitlesDialog.tsx
./src/components/BulkGroupDialog.tsx
./src/components/BulkImportUrlsDialog.tsx
./src/components/BulkTitleDialog.tsx
./src/components/BulkUpdateDialog.tsx
./src/components/CalendarHeatmap.tsx
./src/components/CommandCenter.tsx
./src/components/ConfirmDeleteDialog.tsx
./src/components/ContextBar.tsx
./src/components/DailyGridView.tsx
./src/components/DuplicatesDialog.tsx
./src/components/EditEpisodeDialog.tsx
./src/components/EpisodeDetailSheet.tsx
./src/components/EpisodeTable.tsx
./src/components/FileUploadZone.tsx
./src/components/FilterDialog.tsx
./src/components/layout
./src/components/layout/Sidebar.tsx
./src/components/layout/WorkbenchLayout.tsx
./src/components/MatrixGuideCell.css
./src/components/MatrixGuideCell.tsx
./src/components/MinimalSlideOutGuide.tsx
./src/components/PlaylistUI.tsx
./src/components/playout
./src/components/playout/AffiliateClockSyncPanel.tsx
./src/components/playout/ContentDetectionPanel.tsx
./src/components/playout/ManualControlsPanel.tsx
./src/components/playout/PlayoutDashboard.css
./src/components/playout/PlayoutDashboard.tsx
./src/components/playout/PrimaryContentWindow.tsx
./src/components/playout/SevenDayChannelSelector.tsx
./src/components/SlideOutGuide.tsx
./src/components/TelemetryViewer.tsx
./src/components/TimeSeriesDetailSheet.tsx
./src/components/TimeSeriesTimeline.tsx
./src/components/TimeTravelPlayerDialog.tsx
./src/components/TVNewsResultsSheet.tsx
./src/components/ui
./src/components/ui/alert-dialog.tsx
./src/components/ui/badge.tsx
./src/components/ui/button.tsx
./src/components/ui/checkbox.tsx
./src/components/ui/dialog.tsx
./src/components/ui/dropdown-menu.tsx
./src/components/ui/input.tsx
./src/components/ui/label.tsx
./src/components/ui/popover.tsx
./src/components/ui/scroll-area.tsx
./src/components/ui/select.tsx
./src/components/ui/sheet.tsx
./src/components/ui/skeleton.tsx
./src/components/ui/switch.tsx
./src/components/ui/tabs.tsx
./src/components/ui/textarea.tsx
./src/components/ui/tooltip.tsx
./src/components/VirtualizedResultGrid.tsx
./src/hooks
./src/hooks/use-command-center.ts
./src/hooks/useStaticRundown.ts
./src/hooks/useSwipeToClose.ts
./src/hooks/useSystemCountdown.ts
./src/hooks/use-toast.ts
./src/hooks/useWebSocket.ts
./src/index.css
./src/lib
./src/lib/archive-parser.ts
./src/lib/archive-playback.ts
./src/lib/clientExport.ts
./src/lib/db.ts
./src/lib/live-loop.ts
./src/lib/queryClient.ts
./src/lib/schema.ts
./src/lib/telemetry.ts
./src/lib/thumbnail-matcher.ts
./src/lib/title-sanitizer.ts
./src/lib/utils.ts
./src/main.tsx
./src/pages
./src/pages/archive.tsx
./src/pages/dashboard.tsx
./src/pages/episodes.tsx
./src/pages/news-player.tsx
./src/pages/player1.tsx
./src/pages/player2.tsx
./src/pages/scheduler.tsx
./src/pages/series-workbench.tsx
./src/pages/settings.tsx
./src/pages/tv.tsx
./src/pages/upload.tsx
./src/utils
./src/utils/nexusStreamEngine.ts
./src/vite-env.d.ts
./telemetry.json
./test-alf.js
./test-error.js
./test-extract.js
./test_fetch.html
./test_insert.js
./test-insert-m3u.ts
./test.jpg
./test.m3u
./test-multer.cjs
./test-parse.ts
./test-probe-2.js
./test-probe.js
./test-puppeteer.cjs
./test-query.js
./test-ref.tsx
./test-route.js
./test-sanitizer.ts
./test-shutdown.js
./test-telemetry-insert.cjs
./test-telemetry-insert.ts
./test-telemetry.ts
./test-timeout.js
./tsconfig.json
./vercel.json
./verify-recovery.ts
./vite.config.ts
```
## 6. Verbatim package.json
```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "clean": "rm -rf dist server.js",
    "db:push": "drizzle-kit push",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@electric-sql/pglite": "^0.5.4",
    "@google/genai": "^2.4.0",
    "@neondatabase/serverless": "^1.1.0",
    "@octokit/rest": "^22.0.1",
    "@radix-ui/react-alert-dialog": "^1.1.23",
    "@radix-ui/react-checkbox": "^1.3.11",
    "@radix-ui/react-dialog": "^1.1.23",
    "@radix-ui/react-dropdown-menu": "^2.1.24",
    "@radix-ui/react-label": "^2.1.15",
    "@radix-ui/react-popover": "^1.1.23",
    "@radix-ui/react-scroll-area": "^1.2.18",
    "@radix-ui/react-select": "^2.3.7",
    "@radix-ui/react-slot": "^1.3.3",
    "@radix-ui/react-switch": "^1.3.7",
    "@radix-ui/react-tabs": "^1.1.21",
    "@radix-ui/react-tooltip": "^1.2.16",
    "@tailwindcss/vite": "^4.1.14",
    "@tanstack/react-query": "^5.101.4",
    "@types/ws": "^8.18.1",
    "@vitejs/plugin-react": "^5.0.4",
    "cheerio": "^1.2.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cors": "^2.8.6",
    "dotenv": "^17.2.3",
    "drizzle-orm": "^0.45.2",
    "drizzle-zod": "^0.8.3",
    "express": "^4.21.2",
    "hls.js": "^1.6.17",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "multer": "^2.2.0",
    "node-cron": "^4.6.0",
    "postgres": "^3.4.9",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "react-virtuoso": "^4.18.11",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "uuid": "^14.0.1",
    "vite": "^6.2.3",
    "wouter": "^3.10.0",
    "ws": "^8.21.3",
    "zod": "^4.4.3",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^4.17.21",
    "@types/multer": "^2.2.0",
    "@types/node": "^22.14.0",
    "@types/node-cron": "^3.0.11",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@types/uuid": "^10.0.0",
    "autoprefixer": "^10.4.21",
    "drizzle-kit": "^0.31.10",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2"
  }
}
```

## 7. Plain-Language Description & Lineage Comparison
**What this app does today:**
This app is the "AJN Chronicle PlayoutEngine". It is a full-stack broadcasting, streaming management, and playlist curation application. It maintains an active "schedule" and "playout engine" for a news network (Alex Jones Network - AJN) by parsing external streams (via custom HLS scrapers, M3U processing, and RSS checks), maintaining fallback archive buffers (PGlite database), and displaying them through a dedicated dual-player interface (`player1.tsx`, `player2.tsx`). It also records extensive telemetry events into a database.

**Comparison to Related Projects:**
- **M3U Matrix Stripper (AI Studio, ID 4c177eb2...)**: Unlike the purely static, in-memory M3U Matrix Stripper, *this* application utilizes a full Postgres database (via Neon Serverless/PGlite and Drizzle ORM) for durable storage of telemetry, schedules, and scraped data. It features complex server-side data fetching and cron-like capabilities absent in the static app.
- **M3U Matrix Stripper (Replit-hosted)**: This app shares identical backend structure with the Replit-hosted version, including the `server/m3u-parser.ts` logic and Drizzle/PG schema handling. However, while the Replit app is built explicitly around stripping/modifying M3U lists generically, this app has evolved or specialized specifically for "AJN" playback (evidenced by `aj-pool.ts` and `news-builder.ts`), becoming a fully branded TV playout engine rather than a generic parser tool.
- **Nexus-TV-O (GitHub Ancestor)**: This app retains architectural markers from Nexus-TV-O (e.g., `server/news-builder.ts` directly mentions generating JSON "as per Nexus TV-O architecture"). 

**Conclusion on Branch Lineage:**
This is a **fourth independent branch**. It is likely a direct fork or evolution of the Replit-hosted Postgres version of "M3U Matrix Stripper", which was itself derived from "Nexus-TV-O". It has shed the generic M3U stripper UI and adopted the "AJN Liberty Design System", serving as a specialized deployment for a specific network (AJN).

## 8. Specific Lineage References in Code
- **"AJN"**: Found globally. Highlights include `src/index.css` line 60 (`/* #ff6a33 AJN Accent */`) and line 81 (`/* AJN Liberty Design System */`). Code files like `server/aj-pool.ts` fetch specifically from `https://rss.alexjones.media/AJNHourlyVideo.html`. The User-Agent in `server/news-builder.ts` line 192 is `AJN-Chronicle-PlayoutEngine/3.0`.
- **"Nexus TV-O"**: `server/news-builder.ts` line 351 states: `// Generate Audio Briefings JSON as per Nexus TV-O architecture`.
- **"M3U Matrix Stripper"**: Found indirectly via the persistence of the exact `server/m3u-parser.ts` parsing engine, `docs/media-title-regex-playbook.md`, and its test suites (`test-parse.ts`, `test.m3u`).
- **"Liberty Express"**: `src/index.css` line 81 defines the `/* AJN Liberty Design System */`.

## 9. Known Bugs, TODOs, and Unfinished Features
- No explicit `TODO` or `FIXME` comments exist in the primary source files.
- Recent agent logs (`logs/agent-activity.json`) describe fixing a frontend `<video>` format error caused by offset calculation misalignments in `player2.tsx` and mitigating 404 insertion constraints in the `/api/telemetry` Drizzle routes.
- **Error logs**: Earlier telemetry logs indicated standard 404s for network probe requests (handled and inserted into telemetry now) and `MEDIA_ELEMENT_ERROR: Format error` for unreleased .m4v videos, which has just been patched.

## 10. Expected Environment Variables
The application expects the following variables (referenced in `.env.example` and code):
- `GEMINI_API_KEY`
- `APP_URL`
- `DATABASE_URL`
- `GITHUB_TOKEN`

