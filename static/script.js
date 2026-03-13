document.addEventListener('DOMContentLoaded', function() {
  // Theater filtering (for calendar page)
  const theaterFilters = document.querySelectorAll('.theater-filter');
  const movieItems = document.querySelectorAll('.movie-item');

  // Only run filtering logic if we're on a page with filters
  if (theaterFilters.length === 0) return;

  function updateDayVisibility() {
    const dayItems = document.querySelectorAll('.day-item');
    
    dayItems.forEach(dayItem => {
      const visibleMovieItems = dayItem.querySelectorAll('.movie-item[style="display: block;"], .movie-item:not([style])');
      const hasVisibleMovies = visibleMovieItems.length > 0;
      
      dayItem.style.display = hasVisibleMovies ? 'block' : 'none';
    });
  }

  theaterFilters.forEach(filter => {
    filter.addEventListener('click', function() {
      const selectedTheater = this.getAttribute('data-theater');
      
      // Update active state
      theaterFilters.forEach(f => f.classList.remove('active'));
      this.classList.add('active');
      
      // Filter movies
      movieItems.forEach(item => {
        const theaterId = item.getAttribute('data-theater-id');
        const shouldShow = selectedTheater === 'all' || theaterId === selectedTheater;
        
        item.style.display = shouldShow ? 'block' : 'none';
      });
      
      // Update day visibility after filtering
      updateDayVisibility();

      // Scroll day-grid back to top
      const dayGrid = document.getElementById('day-grid');
      if (dayGrid) dayGrid.scrollTop = 0;
    });
  });

  // Initialize day visibility on page load
  updateDayVisibility();
});
