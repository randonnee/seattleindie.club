import type { Showtime } from "../scrapers/models/showtime"
import type { Theater } from "../scrapers/models/theater"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"

// JSON-LD structured data generation for SEO.

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

/** Build JSON-LD for the theaters page. */
export function buildTheatersPageJsonLd(): object {
  const theatersJsonLd = ALL_THEATERS.map(theaterToJsonLd)

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": "About Seattle's Independent Theaters",
        "url": "https://seattleindie.club/theaters/",
        "description": "Information about Seattle's independent movie theaters"
      },
      ...theatersJsonLd
    ]
  }
}
