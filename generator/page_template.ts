// Shared page template builder for multi-page site generation.
// Each page gets its own HTML file with unique meta tags, canonical URL, and JSON-LD.

const SITE_URL = "https://seattleindie.club"
const SITE_NAME = "SeattleIndie.club"

export interface PageMeta {
  title: string
  description: string
  canonicalPath: string  // e.g. "/" or "/calendar/" or "/theaters/beacon/"
  ogTitle?: string       // defaults to title
  jsonLd?: object        // page-specific structured data
}

export interface PageOptions {
  meta: PageMeta
  activeNav: "now-playing" | "calendar" | "theaters" | null
  bodyContent: string
  cssHash: string
  jsHash: string
  includeScript?: boolean  // whether to include script.js (for theater filtering)
}

export function buildPage(options: PageOptions): string {
  const { meta, activeNav, bodyContent, cssHash, jsHash, includeScript = false } = options
  const canonicalUrl = `${SITE_URL}${meta.canonicalPath}`
  const ogTitle = meta.ogTitle || meta.title

  const jsonLdBlock = meta.jsonLd
    ? `<script type="application/ld+json">\n${JSON.stringify(meta.jsonLd, null, 2)}\n  </script>`
    : ""

  const scriptTag = includeScript ? `<script src="/script.js?v=${jsHash}"></script>` : ""

  const navLink = (href: string, id: string, label: string) => {
    const isActive = id === activeNav ? ' class="view-mode active"' : ' class="view-mode"'
    return `<a${isActive} href="${href}">${label}</a>`
  }

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO Meta Tags -->
  <meta name="description"
    content="${escapeAttr(meta.description)}">
  <meta name="keywords"
    content="Seattle indie theaters, independent cinema Seattle, Seattle movie showtimes, arthouse films Seattle, indie movies Seattle">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#121010" media="(prefers-color-scheme: dark)">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeAttr(ogTitle)}">
  <meta property="og:description"
    content="${escapeAttr(meta.description)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="en_US">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeAttr(ogTitle)}">
  <meta name="twitter:description"
    content="${escapeAttr(meta.description)}">

  <!-- Structured Data -->
  ${jsonLdBlock}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,200..900;1,200..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Noto+Serif:ital,wght@0,100..900;1,100..900&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssHash}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${escapeHtml(meta.title)}</title>
</head>

<body>
  <header>
    <div class="header-inner">
      <h1><a href="/">SeattleIndie.club</a></h1>
      <nav class="view-modes">
        ${navLink("/", "now-playing", "Now playing")}
        ${navLink("/calendar/", "calendar", "Calendar")}
        ${navLink("/theaters/", "theaters", "Theaters")}
      </nav>
    </div>
  </header>

  <div class="container">
    <main>
      ${bodyContent}
    </main>
  </div>
  ${scriptTag}
</body>

</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
