import { Effect, Either } from "effect"
import * as cheerio from 'cheerio'
import type { Showtime } from "../scrapers/models/showtime"
import { getAllScrapers, getScrapersForTheaters } from "./scraper_registry"
import {
  sortShowtimesChronologically,
  filterShowtimesFromToday,
  filterShowtimesForNextDays,
  groupShowtimesByDate,
  groupShowtimesByMovieAndTheater
} from "./showtime_utils"
import {
  generateTheaterFilters,
  generateCalendar,
  generateMovieGrid,
  generateTheatersAbout,
  generateStructuredData
} from "./html_generators"
import { cleanupUnusedImages } from "../scrapers/network/scrape-client"
import { MOCK_HTML_DIR, MOCK_IMAGES_DIR } from "../scrapers/mocks/mock-utils"
import { NOW_PLAYING_DAYS } from "../config"
import { RUN_MODE } from "../scrapers/config/run-mode"
import { readdir, copyFile, rm, mkdir } from "node:fs/promises"
import { join } from "node:path"

const TEMPLATE_PATH = "./generator/template.html"
const OUTPUT_PATH = "./out/index.html"
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

async function generateSite(showtimes: Showtime[]): Promise<void> {
  const template = await Bun.file(TEMPLATE_PATH).text()
  const $ = cheerio.load(template)

  const sortedShowtimes = sortShowtimesChronologically(showtimes)

  // Generate theater filters for calendar view
  generateTheaterFilters($)

  // Generate calendar view content (from today onwards)
  const upcomingShowtimes = filterShowtimesFromToday(sortedShowtimes)
  const showtimesByDay = groupShowtimesByDate(upcomingShowtimes)
  generateCalendar($, showtimesByDay)

  // Generate now-playing view content (only next N days)
  const nowPlayingShowtimes = filterShowtimesForNextDays(sortedShowtimes, NOW_PLAYING_DAYS)
  const showtimesByMovieAndTheater = groupShowtimesByMovieAndTheater(nowPlayingShowtimes)
  generateMovieGrid($, showtimesByMovieAndTheater)

  // Generate about view content
  generateTheatersAbout($)

  // Generate rich structured data (JSON-LD) for SEO
  generateStructuredData($, sortedShowtimes)

  await Bun.write(OUTPUT_PATH, $.html())
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

async function generateSitemap(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://seattleindie.club/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`
  await Bun.write(join(OUTPUT_DIR, "sitemap.xml"), sitemap)
  console.log("Generated sitemap.xml")
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
  await generateSite(showtimes)

  // Copy static assets (CSS, JS, favicon, etc.) to output directory
  await copyStaticAssets()

  // Generate sitemap.xml
  await generateSitemap()

  // Clean up unused images from the cache
  await cleanupUnusedImages()

  // Update mockDate in config.json so mock mode uses the new mocks
  if (RUN_MODE === "update_mocks") {
    await updateMockDate()
  }
}

main()
