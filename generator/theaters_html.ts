import { ALL_THEATERS } from "../scrapers/theaters/theaters"

// HTML generation for the theaters (about) view.

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
