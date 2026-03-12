import type { Showtime } from "../scrapers/models/showtime"
import type { Theater } from "../scrapers/models/theater"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import { outImageFilename } from "../scrapers/mocks/mock-utils"
import {
  groupDayShowtimesByMovieTheater,
  groupShowtimesByMovie,
  type ShowtimesByDate,
  type ShowtimesByMovieTheater,
  type MovieGroup
} from "./showtime_utils"

// HTML generation functions for the site.
// All functions return HTML strings; no Cheerio dependency.

// --- Theater Filters (calendar view) ---

export function generateTheaterFiltersHtml(): string {
  return `
    <button class="theater-filter active" data-theater="all">All Theaters</button>
    ${ALL_THEATERS.map(theater =>
    `<button class="theater-filter" data-theater="${theater.id}">${theater.name}</button>`
  ).join('')}
  `
}

// --- Calendar View ---

function generateMovieItemHtml(
  movie: Showtime['movie'],
  theater: Showtime['theater'],
  times: string[]
): string {
  const timesStr = times.join(', ')
  const theaterId = ALL_THEATERS.find(t => t.name === theater.name)?.id || 'unknown'
  return `
    <li class="movie-item" data-theater-id="${theaterId}">
      <div class="movie-title"><a href="${movie.url}" target="_blank" rel="noopener noreferrer">${movie.title}</a></div>
      <div class="movie-times"><a href="/theaters/${theaterId}/">${theater.name}</a> @ ${timesStr}</div>
    </li>
  `
}

function generateDayItemHtml(dayKey: string, movieItemsHtml: string): string {
  return `
    <div class="day-item">
      <h3 class="day-header">${dayKey}</h3>
      <ul class="day-showtimes">
        ${movieItemsHtml}
      </ul>
    </div>
  `
}

export function generateCalendarHtml(showtimesByDay: ShowtimesByDate): string {
  const dayItems = Object.entries(showtimesByDay).map(([dayKey, dayShowtimes]) => {
    const movieTheaterGroups = groupDayShowtimesByMovieTheater(dayShowtimes)

    const movieItemsHtml = Object.values(movieTheaterGroups)
      .map(group => generateMovieItemHtml(group.movie, group.theater, group.times))
      .join('')

    return generateDayItemHtml(dayKey, movieItemsHtml)
  })

  return dayItems.join('')
}

// --- Movie Grid (Now Playing view) ---

function generateShowtimeDatesHtml(showtimes: Showtime[]): string {
  const showtimesByDate: Record<string, string[]> = {}

  showtimes.forEach(showtime => {
    const dateKey = showtime.datetime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
    if (!showtimesByDate[dateKey]) {
      showtimesByDate[dateKey] = []
    }
    const time = showtime.datetime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(' ', '')
    showtimesByDate[dateKey].push(time)
  })

  return Object.entries(showtimesByDate)
    .map(([date, times]) => {
      const timeSpans = times.map(t => `<span class="showtime-time">${t}</span>`).join('')
      return `<div class="showtime-date-row"><span class="showtime-date">${date}</span><span class="showtime-times">${timeSpans}</span></div>`
    })
    .join('')
}

function generateTheaterShowtimesHtml(
  theater: Showtime['theater'],
  showtimes: Showtime[]
): string {
  const dateTimesHtml = generateShowtimeDatesHtml(showtimes)
  return `
    <div class="theater-showtimes">
      <div class="theater-name"><a href="/theaters/${theater.id}/">${theater.name}</a></div>
      <div class="showtime-dates">${dateTimesHtml}</div>
    </div>
  `
}

function generateMovieMetaHtml(movie: MovieGroup['movie']): string {
  const parts: string[] = []
  if (movie.directors && movie.directors.length > 0) {
    parts.push(`<span class="movie-meta-director">${movie.directors.join(', ')}</span>`)
  }
  if (movie.releaseYear) {
    parts.push(`<span class="movie-meta-year">${movie.releaseYear}</span>`)
  }
  if (movie.runtime) {
    parts.push(`<span class="movie-meta-runtime">${movie.runtime} min</span>`)
  }
  if (parts.length === 0) return ''
  return `<div class="movie-meta">${parts.join('<span class="movie-meta-sep">/</span>')}</div>`
}

function generateMovieCardHtml(movieGroup: MovieGroup): string {
  const { movie, theaters } = movieGroup

  const theaterItemsHtml = Object.values(theaters)
    .map(({ theater, showtimes }) => generateTheaterShowtimesHtml(theater, showtimes))
    .join('')

  const movieImageHtml = movie.imageUrl
    ? `<img class="movie-poster" src="/images/${outImageFilename(movie.imageUrl)}" alt="${movie.title}">`
    : ''

  const movieMetaHtml = generateMovieMetaHtml(movie)

  return `
    <div class="movie-card">
      <div class="movie-card-header">
        <h3 class="movie-card-title"><a href="${movie.url}" target="_blank" rel="noopener noreferrer">${movie.title}</a></h3>
        ${movieMetaHtml}
      </div>
      <div class="movie-card-body">
        ${movieImageHtml}
        <div class="movie-theaters">
          ${theaterItemsHtml}
        </div>
      </div>
    </div>
  `
}

export function generateMovieGridHtml(
  showtimesByMovieAndTheater: ShowtimesByMovieTheater
): string {
  const movieGroups = groupShowtimesByMovie(showtimesByMovieAndTheater)

  return Object.values(movieGroups)
    .map(movieGroup => generateMovieCardHtml(movieGroup))
    .join('')
}

// --- About View ---

function generateTheaterAboutCardHtml(theater: typeof ALL_THEATERS[number]): string {
  const addressHtml = theater.addressLink
    ? `<a href="${theater.addressLink}" target="_blank" rel="noopener noreferrer">${theater.address}</a>`
    : theater.address

  return `
    <div class="theater-about-card">
      <h3 class="theater-about-name"><a href="/theaters/${theater.id}/">${theater.name}</a></h3>
      <div class="theater-about-address">${addressHtml}</div>
      <blockquote class="theater-about-description">"${theater.about}"</blockquote>
    </div>
  `
}

export function generateTheatersAboutHtml(): string {
  return ALL_THEATERS.map(theater => generateTheaterAboutCardHtml(theater)).join('')
}

// --- Structured Data (JSON-LD) ---

function theaterToJsonLd(theater: Theater): object {
  const jsonLd: Record<string, unknown> = {
    "@type": "MovieTheater",
    "name": theater.name,
    "url": `https://seattleindie.club/theaters/${theater.id}/`,
    "description": theater.about
  }
  if (theater.address && theater.address !== "Searching for a new home") {
    jsonLd["address"] = {
      "@type": "PostalAddress",
      "streetAddress": theater.address.split(",")[0]?.trim(),
      "addressLocality": "Seattle",
      "addressRegion": "WA",
      "addressCountry": "US"
    }
  }
  return jsonLd
}

function showtimeToScreeningEvent(showtime: Showtime): object {
  const event: Record<string, unknown> = {
    "@type": "ScreeningEvent",
    "name": showtime.movie.title,
    "startDate": showtime.datetime.toISOString(),
    "location": theaterToJsonLd(showtime.theater),
    "workPresented": {
      "@type": "Movie",
      "name": showtime.movie.title,
      ...(showtime.movie.url ? { "url": showtime.movie.url } : {}),
      ...(showtime.movie.imageUrl ? { "image": showtime.movie.imageUrl } : {}),
      ...(showtime.movie.directors && showtime.movie.directors.length > 0 ? {
        "director": showtime.movie.directors.map(d => ({ "@type": "Person", "name": d }))
      } : {}),
      ...(showtime.movie.description ? { "description": showtime.movie.description } : {}),
      ...(showtime.movie.runtime ? { "duration": `PT${showtime.movie.runtime}M` } : {}),
      ...(showtime.movie.releaseYear ? { "dateCreated": String(showtime.movie.releaseYear) } : {})
    }
  }
  if (showtime.movie.url) {
    event["url"] = showtime.movie.url
  }
  return event
}

/** Build JSON-LD for the homepage (WebSite + all theaters + up to 50 screening events). */
export function buildHomepageJsonLd(showtimes: Showtime[]): object {
  const theatersJsonLd = ALL_THEATERS.map(theaterToJsonLd)

  const seen = new Set<string>()
  const screeningEvents: object[] = []
  for (const showtime of showtimes) {
    const dateStr = showtime.datetime.toISOString().split('T')[0]
    const key = `${showtime.movie.title}~${showtime.theater.id}~${dateStr}`
    if (!seen.has(key)) {
      seen.add(key)
      screeningEvents.push(showtimeToScreeningEvent(showtime))
    }
    if (screeningEvents.length >= 50) break
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "SeattleIndie.club",
        "url": "https://seattleindie.club/",
        "description": "Aggregates showtimes from independent movie theaters in Seattle"
      },
      ...theatersJsonLd,
      ...screeningEvents
    ]
  }
}

/** Build JSON-LD for a theater-specific page. */
export function buildTheaterPageJsonLd(theater: Theater, showtimes: Showtime[]): object {
  const theaterJsonLd = theaterToJsonLd(theater)

  const seen = new Set<string>()
  const screeningEvents: object[] = []
  for (const showtime of showtimes) {
    const dateStr = showtime.datetime.toISOString().split('T')[0]
    const key = `${showtime.movie.title}~${dateStr}`
    if (!seen.has(key)) {
      seen.add(key)
      screeningEvents.push(showtimeToScreeningEvent(showtime))
    }
    if (screeningEvents.length >= 30) break
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      theaterJsonLd,
      ...screeningEvents
    ]
  }
}

/** Build JSON-LD for the calendar page. */
export function buildCalendarPageJsonLd(showtimes: Showtime[]): object {
  const seen = new Set<string>()
  const screeningEvents: object[] = []
  for (const showtime of showtimes) {
    const dateStr = showtime.datetime.toISOString().split('T')[0]
    const key = `${showtime.movie.title}~${showtime.theater.id}~${dateStr}`
    if (!seen.has(key)) {
      seen.add(key)
      screeningEvents.push(showtimeToScreeningEvent(showtime))
    }
    if (screeningEvents.length >= 50) break
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": "Seattle Indie Film Calendar",
        "url": "https://seattleindie.club/calendar/",
        "description": "Day-by-day showtime calendar for Seattle's independent movie theaters"
      },
      ...screeningEvents
    ]
  }
}

/** Build JSON-LD for the about page. */
export function buildAboutPageJsonLd(): object {
  const theatersJsonLd = ALL_THEATERS.map(theaterToJsonLd)

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": "About Seattle's Independent Theaters",
        "url": "https://seattleindie.club/about/",
        "description": "Information about Seattle's independent movie theaters"
      },
      ...theatersJsonLd
    ]
  }
}
