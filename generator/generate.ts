import { Effect, Either } from "effect"
import type { Showtime } from "../scrapers/models/showtime"
import { getAllScrapers, getScrapersForTheaters } from "./scraper_registry"
import {
  sortShowtimesChronologically,
  filterShowtimesFromToday,
  filterShowtimesForNextDays,
  groupShowtimesByDate,
  groupShowtimesByMovieAndTheater
} from "./showtime_utils"
import { generateTheaterFiltersHtml, generateCalendarHtml } from "./calendar_html"
import { generateMovieGridHtml } from "./movie_grid_html"
import { generateTheatersAboutHtml } from "./theaters_html"
import {
  buildHomepageJsonLd,
  buildCalendarPageJsonLd,
  buildTheatersPageJsonLd,
  buildTheaterPageJsonLd
} from "./json_ld"
import { buildPage } from "./page_template"
import { cleanupUnusedImages } from "../scrapers/network/scrape-client"
import { MOCK_HTML_DIR, MOCK_IMAGES_DIR } from "../scrapers/mocks/mock-utils"
import { NOW_PLAYING_DAYS } from "../config"
import { RUN_MODE } from "../scrapers/config/run-mode"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import { readdir, copyFile, rm, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createHash } from "node:crypto"

const STATIC_DIR = "./static"
const OUTPUT_DIR = "./out"

function parseTheatersArg(): string[] | null {
  const theatersArgIndex = process.argv.findIndex(arg => arg === "--theaters")
  if (theatersArgIndex === -1 || theatersArgIndex === process.argv.length - 1) {
    return null
  }
  const theatersValue = process.argv[theatersArgIndex + 1]
  if (!theatersValue || theatersValue.startsWith("--")) {
    return null
  }
  return theatersValue.split(",").map(t => t.trim().toLowerCase())
}

async function hashFile(path: string): Promise<string> {
  const content = await Bun.file(path).arrayBuffer()
  return createHash("sha256").update(Buffer.from(content)).digest("hex").slice(0, 10)
}

async function writePage(outputPath: string, html: string): Promise<void> {
  // Ensure the directory exists
  const dir = outputPath.substring(0, outputPath.lastIndexOf("/"))
  await mkdir(dir, { recursive: true })
  await Bun.write(outputPath, html)
}

async function generateSite(showtimes: Showtime[]): Promise<string[]> {
  const cssHash = await hashFile(join(STATIC_DIR, "style.css"))
  const jsHash = await hashFile(join(STATIC_DIR, "script.js"))
  const sortedShowtimes = sortShowtimesChronologically(showtimes)

  // Track all generated page paths for sitemap
  const pagePaths: string[] = []

  // --- Homepage: Now Playing ---
  const nowPlayingShowtimes = filterShowtimesForNextDays(sortedShowtimes, NOW_PLAYING_DAYS)
  const showtimesByMovieAndTheater = groupShowtimesByMovieAndTheater(nowPlayingShowtimes)
  const movieGridHtml = generateMovieGridHtml(showtimesByMovieAndTheater)

  const homepageHtml = buildPage({
    meta: {
      title: "Seattle Independent Movie Theater Showtimes",
      description: "Find showtimes at Seattle's independent movie theaters. Browse now playing films and upcoming screenings at indie cinemas across Seattle.",
      canonicalPath: "/",
      jsonLd: buildHomepageJsonLd(sortedShowtimes)
    },
    activeNav: "now-playing",
    bodyContent: `
      <section aria-label="Now Playing Movies">
        <h2 class="sr-only">Now Playing</h2>
        <div class="movie-grid" role="list">
          ${movieGridHtml}
        </div>
      </section>
    `,
    cssHash,
    jsHash
  })
  await writePage(join(OUTPUT_DIR, "index.html"), homepageHtml)
  pagePaths.push("/")
  console.log("Generated: / (now playing)")

  // --- Calendar Page ---
  const upcomingShowtimes = filterShowtimesFromToday(sortedShowtimes)
  const showtimesByDay = groupShowtimesByDate(upcomingShowtimes)
  const calendarHtml = generateCalendarHtml(showtimesByDay)
  const theaterFiltersHtml = generateTheaterFiltersHtml()

  const calendarPageHtml = buildPage({
    meta: {
      title: "Showtime Calendar - Seattle Independent Theaters",
      description: "Day-by-day showtime calendar for Seattle's independent movie theaters. Browse upcoming screenings at The Beacon, SIFF, NW Film Forum, and more.",
      canonicalPath: "/calendar/",
      jsonLd: buildCalendarPageJsonLd(upcomingShowtimes)
    },
    activeNav: "calendar",
    bodyContent: `
      <section class="calendar-section" aria-label="Showtime Calendar">
        <h2 class="sr-only">Showtime Calendar</h2>
        <div class="theater-filters">
            ${theaterFiltersHtml}
          </div>
        <div class="day-grid" id="day-grid">
          ${calendarHtml}
        </div>
      </section>
    `,
    cssHash,
    jsHash,
    includeScript: true
  })
  await writePage(join(OUTPUT_DIR, "calendar/index.html"), calendarPageHtml)
  pagePaths.push("/calendar/")
  console.log("Generated: /calendar/")

  // --- About Page ---
  const theatersAboutHtml = generateTheatersAboutHtml()

  const aboutPageHtml = buildPage({
    meta: {
      title: "About Seattle's Independent Theaters - SeattleIndie.club",
      description: "Learn about Seattle's independent movie theaters including The Beacon, SIFF Cinema, NW Film Forum, The Grand Illusion, and more.",
      canonicalPath: "/theaters/",
      jsonLd: buildTheatersPageJsonLd()
    },
    activeNav: "theaters",
    bodyContent: `
      <section aria-label="About the Theaters">
        <h2 class="sr-only">About the Theaters</h2>
        <article class="about-content">
          <div class="theaters-about">
            ${theatersAboutHtml}
          </div>
        </article>
      </section>
    `,
    cssHash,
    jsHash
  })
  await writePage(join(OUTPUT_DIR, "theaters/index.html"), aboutPageHtml)
  pagePaths.push("/theaters/")
  console.log("Generated: /theaters/")

  // --- Per-Theater Pages ---
  for (const theater of ALL_THEATERS) {
    const theaterShowtimes = sortedShowtimes.filter(s => s.theater.id === theater.id)
    const theaterUpcoming = filterShowtimesFromToday(theaterShowtimes)
    const theaterByDay = groupShowtimesByDate(theaterUpcoming)
    const theaterCalendarHtml = generateCalendarHtml(theaterByDay)

    const theaterNowPlaying = filterShowtimesForNextDays(theaterShowtimes, NOW_PLAYING_DAYS)
    const theaterMovieTheater = groupShowtimesByMovieAndTheater(theaterNowPlaying)
    const theaterMovieGridHtml = generateMovieGridHtml(theaterMovieTheater)

    const hasNowPlaying = theaterNowPlaying.length > 0
    const hasCalendar = theaterUpcoming.length > 0

    const addressHtml = theater.addressLink
      ? `<a href="${theater.addressLink}" target="_blank" rel="noopener noreferrer">${theater.address}</a>`
      : theater.address

    const theaterPageHtml = buildPage({
      meta: {
        title: `${theater.name} Showtimes - Seattle Independent Theater`,
        description: `Showtimes and schedule for ${theater.name}. ${theater.about.substring(0, 120)}`,
        canonicalPath: `/theaters/${theater.id}/`,
        ogTitle: `${theater.name} Showtimes`,
        jsonLd: buildTheaterPageJsonLd(theater, theaterUpcoming)
      },
      activeNav: null,
      bodyContent: `
        <section class="theater-page" aria-label="${theater.name}">
          <div class="theater-page-header">
            <h2 class="theater-page-name"><a href="${theater.url}" target="_blank" rel="noopener noreferrer">${theater.name}</a></h2>
            <div class="theater-page-address">${addressHtml}</div>
            <blockquote class="theater-about-description">"${theater.about}"</blockquote>
          </div>

          ${hasNowPlaying ? `
          <div class="theater-page-section">
            <h3 class="theater-page-section-title">Now Playing</h3>
            <div class="movie-grid" role="list">
              ${theaterMovieGridHtml}
            </div>
          </div>
          ` : ''}

          ${hasCalendar ? `
          <div class="theater-page-section">
            <h3 class="theater-page-section-title">Full Schedule</h3>
            <div class="day-grid">
              ${theaterCalendarHtml}
            </div>
          </div>
          ` : `
          <p class="theater-page-empty">No upcoming showtimes found.</p>
          `}
        </section>
      `,
      cssHash,
      jsHash
    })
    await writePage(join(OUTPUT_DIR, `theaters/${theater.id}/index.html`), theaterPageHtml)
    pagePaths.push(`/theaters/${theater.id}/`)
    console.log(`Generated: /theaters/${theater.id}/`)
  }

  return pagePaths
}

const CONFIG_PATH = "./config.json"

async function clearMockData(): Promise<void> {
  for (const dir of [MOCK_HTML_DIR, MOCK_IMAGES_DIR]) {
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
  }
  console.log("Cleared old mock data")
}

async function updateMockDate(): Promise<void> {
  const config = await Bun.file(CONFIG_PATH).json()
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  config.mockDate = `${year}-${month}-${day}T12:00:00`
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n")
  console.log(`Updated mockDate to ${config.mockDate}`)
}

async function generateSitemap(pagePaths: string[]): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const urlEntries = pagePaths.map((path, index) => {
    const priority = path === "/" ? "1.0" : path.startsWith("/theaters/") ? "0.7" : "0.8"
    const changefreq = path === "/" ? "daily" : "daily"
    return `  <url>
    <loc>https://seattleindie.club${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  })

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`
  await Bun.write(join(OUTPUT_DIR, "sitemap.xml"), sitemap)
  console.log(`Generated sitemap.xml with ${pagePaths.length} URLs`)
}

async function copyStaticAssets(): Promise<void> {
  const files = await readdir(STATIC_DIR)
  await Promise.all(
    files.map(file => copyFile(join(STATIC_DIR, file), join(OUTPUT_DIR, file)))
  )
  console.log(`Copied ${files.length} static assets to ${OUTPUT_DIR}`)
}

async function main(): Promise<void> {
  // Clear old mock data before fetching new mocks
  if (RUN_MODE === "update_mocks") {
    await clearMockData()
  }

  const requestedTheaters = parseTheatersArg()

  const scrapers = requestedTheaters
    ? getScrapersForTheaters(requestedTheaters)
    : getAllScrapers()

  if (requestedTheaters) {
    console.log(`Running scrapers for theaters: ${requestedTheaters.join(", ")}`)
  }

  const getAllShowtimes = Effect.all(
    scrapers.map(s => s.getShowtimes()),
    { mode: "either" }
  )

  const theaterShowtimeResult = await Effect.runPromise(getAllShowtimes)
  const showtimes = theaterShowtimeResult
    .filter(Either.isRight)
    .flatMap(result => result.right)

  console.log(`Total showtimes: ${showtimes.length}`)
  const pagePaths = await generateSite(showtimes)

  // Copy static assets (CSS, JS, favicon, etc.) to output directory
  await copyStaticAssets()

  // Generate sitemap.xml with all page paths
  await generateSitemap(pagePaths)

  // Clean up unused images from the cache
  await cleanupUnusedImages()

  // Update mockDate in config.json so mock mode uses the new mocks
  if (RUN_MODE === "update_mocks") {
    await updateMockDate()
  }
}

main()
