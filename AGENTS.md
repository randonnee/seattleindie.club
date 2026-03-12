# AGENTS.md

Guidelines for agentic coding agents working in this repository.

## Project Overview

**misogi** is a static site generator that scrapes showtimes from independent movie theaters in Seattle and produces a single-page website deployed to **https://seattleindie.club/**. All scraping happens at build time; the output is a static `out/` directory served via Cloudflare Pages (and GitHub Pages as a secondary target).

- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript with strict mode
- **Key dependencies**: Cheerio (HTML parsing), Effect (typed error handling), sharp (image processing)
- **Architecture**: Build-time scraper pipeline -> static HTML generator -> deployment

## Directory Structure

```
misogi/
├── config.json / config.ts       # Runtime config (nowPlayingDays, mockDate)
├── index.ts                      # Local dev server (serves out/ as static files)
├── deploy.sh                     # Local deploy script (generate + wrangler)
├── generator/
│   ├── generate.ts               # Main entry point for site generation
│   ├── html_generators.ts        # HTML generation (calendar, movie grid, about, JSON-LD)
│   ├── scraper_registry.ts       # Maps theater IDs -> scraper instances
│   ├── showtime_utils.ts         # Grouping, filtering, sorting utilities
│   └── template.html             # HTML skeleton for the output page
├── scrapers/
│   ├── models/                   # Domain interfaces (Movie, Theater, Showtime, TheaterScraper)
│   ├── theaters/theaters.ts      # Theater constant definitions (all 7 venues)
│   ├── theater_scrapers/         # Scraper implementations per theater
│   │   ├── base_scraper.ts       # Abstract base with shared scraping pipeline
│   │   ├── beacon_scraper.ts     # The Beacon
│   │   ├── siff_scraper.ts       # SIFF (3 venues)
│   │   ├── nwff_scraper.ts       # NW Film Forum
│   │   ├── grand_illusion_scraper.ts  # Grand Illusion Cinema
│   │   └── central_cinema_scraper.ts  # Central Cinema (exists but NOT registered)
│   ├── network/
│   │   ├── scrape-client.ts      # ScrapeClient interface, real impl, factory
│   │   ├── image-processor.ts    # Resize to 600px wide WebP via sharp
│   │   └── image-cache.ts        # Tracks used images, cleans up stale ones
│   ├── mocks/
│   │   ├── html/                 # ~100+ saved HTML responses from real sites
│   │   ├── mock-scrape-client.ts # Mock HTTP client (reads from local files)
│   │   └── mock-utils.ts         # URL-to-filename mapping
│   ├── config/run-mode.ts        # RUN_MODE env var (mock | prod | update_mocks)
│   └── utils/date-manager.ts     # Date utilities (mock-aware "now", date parsing)
├── static/                       # Client-side assets (CSS, JS, favicon, CNAME, etc.)
├── out/                          # Generated output (gitignored)
└── .github/workflows/            # CI/CD (daily cron, deploys to GH Pages + Cloudflare)
```

## Build & Development Commands

```bash
# Package management
bun install                    # Install dependencies

# Site generation
bun run generate               # Generate site in MOCK mode (reads local HTML files)
bun run generate:prod          # Generate site in PROD mode (fetches live websites)
bun run generate:update-mocks  # Fetch live sites AND save responses to scrapers/mocks/html/

# Local dev server
bun run start                  # Serve out/ on localhost for previewing

# Type checking
bun tsc --noEmit               # Run TypeScript compiler without emitting

# Testing
bun test                       # Run tests (bun:test framework)

# Deployment
bun run deploy                 # Generate prod + deploy to Cloudflare Pages
```

## How the System Works

### Data Flow

1. **`generator/generate.ts`** is the entry point (run via `bun run generate`)
2. Parses optional `--theaters beacon,siff` CLI arg to run specific scrapers
3. Gets scraper instances from `generator/scraper_registry.ts`
4. Runs all scrapers **in parallel** via `Effect.all(..., { mode: "either" })` (failures don't abort other scrapers)
5. Collects all `Showtime[]` results, filters out failed scrapers
6. Passes showtimes to `generateSite()` which:
   - Loads `generator/template.html` with Cheerio
   - Generates theater filter buttons, calendar view, now-playing movie grid, about section, and JSON-LD structured data
   - Writes final HTML to `out/index.html`
7. Copies static assets from `static/` to `out/`
8. Generates `out/sitemap.xml`
9. Cleans up unused images in `out/images/`

### Scraper Pipeline (BaseScraper)

Most scrapers extend `BaseScraper<TContext>` which provides a standard pipeline:

1. `getCalendarPages()` -> list of URLs to scrape (with optional context per page)
2. For each page: fetch HTML, parse with Cheerio, find events via `getEventSelector()`, call `parseEvent()` on each
3. Flatten results, run `filterShowtimes()` hook
4. For movies in the "now playing" window (next 7 days): fetch each movie's detail page to extract poster images (with URL deduplication)
5. Return `Showtime[]`

**Subclasses must implement**: `getCalendarPages()`, `getEventSelector()`, `parseEvent()`
**Overridable hooks**: `extractImageUrl()`, `filterShowtimes()`

### Three Run Modes

Controlled by `RUN_MODE` env var (default: `mock`):
- **`mock`**: Reads HTML from `scrapers/mocks/html/` files. Uses fixed `MOCK_DATE` from config for deterministic results.
- **`prod`**: Fetches live websites via HTTP. Uses real current date.
- **`update_mocks`**: Fetches live websites AND saves responses to `scrapers/mocks/html/` for future mock runs.

### Active Scrapers

| Scraper | Theater(s) | Strategy |
|---|---|---|
| `BeaconScraper` | The Beacon | Single calendar page, microdata parsing |
| `SiffScraper` | SIFF Uptown, Downtown, Film Center | 21 daily calendar pages, multi-venue |
| `NWFFScraper` | NW Film Forum | 4 weekly calendar pages, schema.org microdata |
| `GrandIllusionScraper` | Grand Illusion Cinema | Homepage scrape, richest inline metadata |

**Note**: `CentralCinemaScraper` exists but is NOT registered in `scraper_registry.ts` and `CentralCinema` is NOT in `ALL_THEATERS`.

### Network Layer

- `ScrapeClient` interface with `get(url)` (HTML) and `getImage(url)` (fetch + resize + WebP)
- `getScrapeClient()` factory returns mock or real client based on `RUN_MODE`
- Real client enforces 1-second rate limiting between requests
- Images are resized to 600px wide WebP at quality 80, cached in `out/images/`

### Local Dev Server (`index.ts`)

A minimal `Bun.serve()` that serves static files from `out/` and `static/`. No scraping or API endpoints. Only for previewing the generated site locally.

### Deployment

- **GitHub Actions**: Daily cron at 3am PST, generates in prod mode, deploys to both GitHub Pages and Cloudflare Pages
- **Local**: `deploy.sh` runs generate:prod + wrangler deploy (loads credentials from `~/.config/misogi/.env`)
- Image caching between CI runs avoids re-downloading unchanged posters

## Domain Models

```typescript
interface Movie {
  title: string; url?: string; imageUrl?: string;
  directors?: string[]; actors?: string[]; runtime?: number;
  description?: string; releaseYear?: number;
}

interface Theater {
  name: string; url: string; id: TheaterId;
  about: string; address: string; addressLink?: string;
}
// TheaterId = "beacon" | "siff-uptown" | "siff-downtown" | "siff-center" | "nwff" | "grand-illusion" | "central-cinema"

interface Showtime {
  movie: Movie; theater: Theater; datetime: Date;
}

interface TheaterScraper {
  getShowtimes(): Effect.Effect<Showtime[], Error>
}
```

## Code Style Guidelines

### Imports
- Use `import type` for type-only imports
- Order: external libraries -> internal type imports -> internal value imports
- Use relative paths

### TypeScript
- Strict mode with `noUncheckedIndexedAccess` and `noImplicitOverride`
- ESNext target, bundler module resolution
- No build step (Bun runs TypeScript directly)

### Naming
- **Classes/Interfaces**: PascalCase (`BeaconScraper`, `TheaterScraper`)
- **Methods/Variables**: camelCase (`getShowtimes`, `showtimes`)
- **Files**: snake_case (`beacon_scraper.ts`, `theater_scraper.ts`)

### Patterns
- Effect library for async operations with typed errors (`Effect.Effect<A, E>`)
- Cheerio for HTML parsing (`.load()`, CSS selectors, `.text().trim()`, `.attr()`)
- Null returns from `parseEvent()` to filter invalid data
- `BaseScraper<TContext>` for shared pipeline; implement directly for non-standard scrapers

### Testing
- Uses `bun:test` framework
- Existing tests in `scrapers/network/scrape-client.test.ts`
- Mock `global.fetch` for HTTP client tests

## Development Workflow

### Adding a New Theater
1. Define a `Theater` constant in `scrapers/theaters/theaters.ts`
2. Add the theater ID to the `TheaterId` type in `scrapers/models/theater.ts`
3. Create a scraper class in `scrapers/theater_scrapers/` (extend `BaseScraper` or implement `TheaterScraper` directly)
4. Register it in `generator/scraper_registry.ts`
5. Add it to `ALL_THEATERS` in `scrapers/theaters/theaters.ts` (needed for UI filter buttons and about section)
6. Save mock HTML to `scrapers/mocks/html/` (run `bun run generate:update-mocks` or save manually)

### Modifying Models
- Update interfaces in `scrapers/models/`
- Update all scraper implementations and `generator/html_generators.ts` as needed

### Updating Mock Data
Run `bun run generate:update-mocks` to fetch live HTML from all theater sites and save to `scrapers/mocks/html/`. This keeps mock mode in sync with real site structures.
