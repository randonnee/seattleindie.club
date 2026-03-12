const server = Bun.serve({
  routes: {
    // Landing page (now playing)
    "/": Bun.file("./out/index.html"),

    // Multi-page routes
    "/calendar/": Bun.file("./out/calendar/index.html"),
    "/calendar": Bun.file("./out/calendar/index.html"),
    "/about/": Bun.file("./out/about/index.html"),
    "/about": Bun.file("./out/about/index.html"),

    // Theater pages
    "/theaters/:id/": (req) => {
      const id = req.params.id;
      return new Response(Bun.file(`./out/theaters/${id}/index.html`));
    },
    "/theaters/:id": (req) => {
      const id = req.params.id;
      return new Response(Bun.file(`./out/theaters/${id}/index.html`));
    },

    // Serve static files
    "/style.css": Bun.file("./static/style.css"),
    "/script.js": Bun.file("./static/script.js"),
    "/favicon.svg": Bun.file("./static/favicon.svg"),
    "/robots.txt": Bun.file("./static/robots.txt"),
    "/sitemap.xml": Bun.file("./out/sitemap.xml"),

    // Serve images from out/images
    "/images/:filename": (req) => {
      const filename = req.params.filename;
      return new Response(Bun.file(`./out/images/${filename}`));
    },
  },

  // Custom error handler
  async error() {
    const html = await Bun.file("./static/error.html").text();
    return new Response(html, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Server running at ${server.url}`);
