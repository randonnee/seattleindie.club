# SeattleIndie.club

A static site generator that scrapes showtimes from independent movie theaters in Seattle and produces a single-page website at **[seattleindie.club](https://seattleindie.club/)**.

All scraping happens at build time. The output is a static `out/` directory deployed via Cloudflare Pages.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) (not Node)
- **Language**: TypeScript (strict mode)
- **Key libs**: Cheerio, Effect, sharp

## Commands

```bash
bun install                    # Install dependencies
bun run generate               # Generate site (mock mode, uses local HTML fixtures)
bun run generate:prod          # Generate site (prod mode, fetches live sites)
bun run generate:update-mocks  # Fetch live sites + save HTML to scrapers/mocks/html/
bun run start                  # Serve out/ locally for preview
bun test                       # Run tests
bun run deploy                 # Generate prod + deploy to Cloudflare Pages
```

## Project Structure

```
├── generator/                 # Site generation pipeline
│   ├── generate.ts            # Entry point
│   ├── html_generators.ts     # HTML output (calendar, movie grid, JSON-LD)
│   ├── scraper_registry.ts    # Maps theater IDs -> scrapers
│   └── template.html          # HTML skeleton
├── scrapers/
│   ├── models/                # Domain types (Movie, Theater, Showtime)
│   ├── theaters/              # Theater definitions
│   ├── theater_scrapers/      # Per-theater scraper implementations
│   ├── network/               # HTTP client, image processing, caching
│   ├── mocks/html/            # Saved HTML responses for mock mode
│   └── utils/                 # Date utilities
├── static/                    # Client-side assets (CSS, JS, favicon)
├── out/                       # Generated output (gitignored)
└── config.ts                  # Runtime config
```

## How It Works

1. Scrapers fetch calendar/showtime pages from each theater site (or read from local mocks)
2. HTML is parsed with Cheerio to extract movie + showtime data
3. Poster images are fetched, resized to WebP, and cached
4. A static HTML page is generated with calendar view, movie grid, and theater info
5. Output is written to `out/` and deployed

## Theaters

Currently scraping: The Beacon, SIFF (Uptown, Downtown, Film Center), NW Film Forum, Grand Illusion Cinema.
