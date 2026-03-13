import type { Showtime } from "../scrapers/models/showtime"
import { ALL_THEATERS } from "../scrapers/theaters/theaters"
import {
  groupDayShowtimesByMovieTheater,
  type ShowtimesByDate
} from "./showtime_utils"

// HTML generation for theater filter buttons and the calendar view.

export function generateTheaterFiltersHtml(): string {
  return `
    <button class="theater-filter active" data-theater="all">All Theaters</button>
    ${ALL_THEATERS.map(theater =>
    `<button class="theater-filter" data-theater="${theater.id}">${theater.name}</button>`
  ).join('')}
  `
}

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
