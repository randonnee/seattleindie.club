import type { Showtime } from "../scrapers/models/showtime"
import { outImageFilename } from "../scrapers/mocks/mock-utils"
import {
  groupShowtimesByMovie,
  type ShowtimesByMovieTheater,
  type MovieGroup
} from "./showtime_utils"

// HTML generation for the now-playing movie grid view.

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
