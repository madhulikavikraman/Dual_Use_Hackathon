# ArcGIS Online: the Second Key feeds in a web map and a dashboard

Path A from PRD section 12 (backlog item 63, decision D-13): ArcGIS Online reads our GeoJSON feeds **by URL** and refreshes them on an interval, so the EOC's map updates on its own. No Esri write credentials are needed. Path B (pushing rows into a hosted feature layer with `applyEdits`, item 64) is P2 and not built.

## 1. The feeds

| Feed | What each feature is | Geometry |
| --- | --- | --- |
| `/api/feeds/zones.geojson` | A zone: `zone_id`, `name`, `state`, `state_label`, `color`, `directive`, `move_text`, `evac_point`, `population_est`, `area_sq_mi`, `approved_by`, `approved_at`, `age_min`, `open_proposal` | Polygon |
| `/api/feeds/clusters.geojson` | A pattern-watch cluster: `kind` (hazard, help, silence, volume), `count`, `baseline`, `score`, `corroborated` (1/0), `sentinel_reads`, `label` ("corroborated", "not confirmed", "possible tower or power loss"), `status`, `first_at`, `last_at`, `age_min` | Polygon (hex cell, about 0.7 km²; the zone polygon for a volume cluster) |
| `/api/feeds/help.geojson` | A help-registry row: `priority` (1 life safety, 2 needs help leaving, 3 check later), `priority_label`, `needs`, `people`, `device_battery_hours`, `status`, `open` (1/0), `zone_id`, `location_source`, `precision`, `location_age_min`, `fresh` (1/0, under 15 min), `age_min`, `synthetic` (1/0) | Point |
| `/api/feeds/reports.geojson` | A geo-tagged report: `type` (smoke, fire, shaking, damage, injury...), `source` (call, seeded, inbound, sentinel), `zone_id`, `cell`, `synthetic` (1/0), `age_min` | Point |

Every URL needs the token: `?token=<FEED_TOKEN>` (the env var; `demo` if unset). A wrong or missing token returns 401. The feeds send `Content-Type: application/geo+json`, `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`, and answer the CORS preflight (`OPTIONS`).

**Privacy (PRD 11 and 20).** The feeds carry no phone numbers, no names, no household ids and no caller free text. A help row whose person did not consent to sharing their location is placed at its hex-cell center (`precision` says so). The QRT's exact list with phones is the CSV export (`/api/export/csv?kind=registry`), not the feed.

**Field types.** Booleans are sent as integers 1 and 0 so ArcGIS can filter and count them. Times are ISO 8601 UTC strings; use the numeric `age_min` fields for filters and symbols ("updated in the last 15 minutes").

The `/demo` console lists all four URLs with the token filled in and a Copy button for each.

## 2. A public URL first

ArcGIS Online is a web app on `https://*.arcgis.com`. It cannot read `http://localhost:3000`, a LAN address, or an `http://` URL from an `https://` map. The feed URL must be public HTTPS:

- **Deployed app (Vercel):** `https://<your-app>.vercel.app/api/feeds/zones.geojson?token=...`. On Vercel the app must use Supabase as its store (the local file store lives in one process and does not survive serverless instances).
- **The demo laptop, through a tunnel** (the local store and the live demo data):
  - Cloudflare quick tunnel: `cloudflared tunnel --url http://localhost:3000` prints `https://<random>.trycloudflare.com`. No account needed, no interstitial page.
  - ngrok works too (`ngrok http 3000`), but the free plan shows a browser warning page that breaks a GeoJSON layer unless the request carries `ngrok-skip-browser-warning`; prefer cloudflared.
- Paste the public base URL into the "Public base URL" box on `/demo`; the copy buttons then produce ready-to-paste URLs.
- Set a non-default `FEED_TOKEN` before you open a tunnel, and restart the dev server so it is read.

Check a URL before the demo: `curl -s "https://<public>/api/feeds/zones.geojson?token=<token>" | head -c 300` should print a FeatureCollection, and opening it in a browser should show JSON.

## 3. Add the feeds to a web map (Map Viewer)

1. Sign in to ArcGIS Online, open **Map Viewer**, and start a new map. Set the basemap (Light Gray Canvas reads well on a projector).
2. **Add** (layers pane) → **Add layer from URL** → paste the zones URL → type **GeoJSON** (Map Viewer usually detects it) → **Add to map**.
3. Repeat for `clusters.geojson`, `help.geojson` and `reports.geojson`. Order the layers: help on top, then reports, clusters, zones.
4. For **each** layer: **Properties** (right panel) → **Refresh interval** → on, **1 minute** (PRD success metric: a seeded cluster visible within one refresh interval). This is what makes the map update on its own.
5. Style:
   - zones: **Types (unique symbols)** on `state_label`, colors as on the board (Monitor grey, Watch yellow, Near-Crisis orange, Crisis red, Shelter in Place purple, Lifted green; the `color` field carries the hex value), 40% fill transparency.
   - clusters: **Types** on `label` (corroborated red, not confirmed amber, possible tower or power loss purple); label with `count`.
   - help: **Types** on `priority_label` (1 red, 2 orange, 3 blue); filter `open = 1` if the map should show only open rows.
   - reports: small points, **Types** on `type`; optional filter `age_min <= 60`.
6. Pop-ups: zones show `name`, `state_label`, `directive`, `move_text`, `evac_point`, `population_est`; help shows `priority_label`, `needs`, `people`, `status`, `location_age_min`, `precision`.
7. **Save** the map (title "Second Key: Westside (simulated)"), and share it with the EOC group, or publicly for the demo.

Alternative: **Content → New item → URL** with each feed URL creates a GeoJSON-by-URL item you can reuse in several maps; set its refresh interval in the item's settings.

## 4. The dashboard (ArcGIS Dashboards), three indicators

1. **Create app → Dashboards**, title "Second Key: EOC view (simulated)".
2. Add a **Map** element: the saved web map. Turn on its legend and layer visibility.
3. Add three **Indicator** elements (data from the web map's layers):
   1. **Open help rows by priority.** Layer help; filter `open = 1` and `priority = 1`; value: **Count**; title "Life safety (priority 1), open"; color red. Duplicate it for `priority = 2` ("Needs help leaving") and `priority = 3` ("Check later / unreached"), or use one **Serial chart** with category field `priority_label`, statistic Count, filter `open = 1`.
   2. **Clusters.** Layer clusters; filter `kind <> 'silence'`; value: Count; reference: Count with filter `corroborated = 1`, shown as "of which corroborated"; a second indicator with `kind = 'silence'` reads "Silent blocks (door-knock teams)".
   3. **Zones by state.** Layer zones; a **Serial chart** (or pie) with category field `state_label`, statistic Count; or an indicator with filter `state = 'order' OR state = 'shelter_in_place'` titled "Zones at Crisis or Shelter in Place".
4. Optional: a **List** element on help (filter `open = 1`, sorted by `priority` then `age_min` descending) showing `priority_label`, `needs`, `people`, `location_age_min`.
5. The dashboard refreshes with its layers, so every element updates on the 1-minute refresh interval set in the map. Save and share.

## 5. Demo beat and checks

- On `/demo`, fire **Earthquake** (USGS M5.9, simulated, and 20 reports in two Mid-City cells): within a minute the map shows two red hex cells and the proposal; the dashboard's cluster indicator ticks up.
- Fire **Hoax flood**: two amber "not confirmed" cells and a Koreatown volume cluster with `sentinel_reads = 0`. The hoax mirror, on the EOC's own map.
- Fire **Tower down**: a purple silence cluster over the Palms block.
- If ArcGIS cannot reach the URL in the room, the fallbacks are the CSV exports (`/api/export/csv?kind=registry|households|ledger`) and CAP 1.2 (`/api/export/cap?zone_id=LA-CC`), both linked from `/demo`.

Sources: Esri, "Auto-update CSV and GeoJSON layers by URL" (https://www.esri.com/arcgis-blog/products/arcgis-online/mapping/auto-update-csv-geojson-georss); PRD sections 11, 12 and 20; decisions D-12, D-13 and D-16.
