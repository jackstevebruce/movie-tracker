const API_URL = 'http://localhost:3000';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- UI Element References ---
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const resultsGrid = document.getElementById('resultsGrid');
const emptyState = document.getElementById('emptyState');
const loadingRow = document.getElementById('loadingRow');

// --- Main Pages/Grids ---
const watchlistGrid = document.getElementById('watchlistGrid');
const watchedGrid = document.getElementById('watchedGrid');
const watchlistEmpty = document.getElementById('emptyWatchlist');
const watchedEmpty = document.getElementById('emptyWatched');

// --- Global State & Data Cache ---
const state = {
    searchQuery: '',
    searchDebounceTimer: null,
    searchResultsCache: [],
};

// --- Helper Functions ---
const showToast = (msg = 'Saved!') => {
    // We will create a simple toast notification instead of using alert()
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        color: white;
        padding: 10px 20px;
        border-radius: 9999px;
        font-size: 14px;
        z-index: 1000;
        transition: opacity 0.3s ease-in-out;
        opacity: 0;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
};

// --- HTML Rendering ---
const renderMovieCard = (movie, context) => {
    const posterUrl = movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : 'https://placehold.co/500x750/1e293b/FFFFFF?text=Poster+Unavailable';
    const year = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';
    
    // Determine the action buttons based on context
    let buttons = '';
    if (context === 'search') {
        buttons = `
            <button class="btn btn-secondary" data-action="add-to-watchlist" data-id="${movie.id}">
                <i class="fa-regular fa-bookmark mr-1"></i> Watchlist
            </button>
            <button class="btn btn-primary" data-action="add-to-watched" data-id="${movie.id}">
                <i class="fa-regular fa-circle-check mr-1"></i> Watched
            </button>
        `;
    } else {
        buttons = `
            <button class="btn clear-btn" data-action="remove-movie" data-db-id="${movie.id}">
                <i class="fa-regular fa-trash-can mr-1"></i> Remove
            </button>
        `;
    }

    return `
        <article class="movie-card">
            <a href="film.html?tmdb_id=${movie.id}" class="movie-poster-link">
                <div class="poster-hover">
                    <img src="${posterUrl}" alt="${movie.title}" class="movie-card-poster">
                </div>
            </a>
            <div class="movie-card-content">
                <h3 class="movie-card-title">${movie.title}</h3>
                <p class="movie-card-year">${year}</p>
                <div class="mt-3 grid grid-cols-2 gap-2">
                    ${buttons}
                </div>
            </div>
        </article>
    `;
};

const renderSearchResults = (movies) => {
    resultsGrid.innerHTML = movies.map(movie => renderMovieCard(movie, 'search')).join('');
    emptyState.classList.toggle('hidden', movies.length > 0);
};

const renderUserList = (movies, gridEl, emptyEl) => {
    gridEl.innerHTML = movies.map(movie => renderMovieCard(movie, 'list')).join('');
    emptyEl.classList.toggle('hidden', movies.length > 0);
};

const renderFilmDetails = async (tmdbId) => {
    const detailsContainer = document.getElementById('movieDetails');
    detailsContainer.innerHTML = '<h2>Loading...</h2>';

    const movieData = await getMovieDetailsAndCredits(tmdbId);
    
    if (!movieData) {
        showToast('Failed to load movie details. Please try again.');
        return;
    }
    
    const posterUrl = movieData.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieData.poster_path}` : 'https://placehold.co/500x750/1e293b/FFFFFF?text=Poster+Unavailable';
    const year = movieData.release_date ? movieData.release_date.substring(0, 4) : 'N/A';
    
    const genresHtml = movieData.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('');
    
    detailsContainer.innerHTML = `
        <div class="movie-details-grid">
            <div>
                <img id="film-poster" src="${posterUrl}" alt="Movie Poster" class="rounded-xl w-full object-cover aspect-[2/3]">
            </div>
            <div class="details-info">
                <h1 class="details-title">${movieData.title}</h1>
                <p class="details-year">${year}</p>
                
                <h3 class="details-plot-title">Plot</h3>
                <p class="details-plot">${movieData.overview || 'No plot summary available.'}</p>
                
                <div class="details-director-actors">
                    <div>
                        <h3>Director</h3>
                        <p>${movieData.director}</p>
                    </div>
                    <div>
                        <h3>Actors</h3>
                        <p>${movieData.actors}</p>
                    </div>
                </div>
                
                <div class="details-genres">${genresHtml}</div>

                <div class="mt-6 border-t border-white/10 pt-4">
                    <form id="add-movie-form">
                        <h3 class="text-2xl font-extrabold mb-4">Manage this film</h3>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="list-select" class="text-sm font-semibold">Add to List</label>
                                <select id="list-select" class="w-full px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/10 focus:ring-1 focus:ring-emerald-400/50 mt-2">
                                    <option value="">-- Select --</option>
                                    <option value="watchlist">Watchlist</option>
                                    <option value="watched">Watched</option>
                                </select>
                            </div>
                            <div>
                                <label for="user-rating" class="text-sm font-semibold">Your Rating (out of 5)</label>
                                <select id="user-rating" class="w-full px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/10 focus:ring-1 focus:ring-emerald-400/50 mt-2">
                                    <option value="">-- Rate --</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                </select>
                            </div>
                        </div>

                        <div class="mt-4">
                            <label for="user-review" class="text-sm font-semibold">Your Review / Notes</label>
                            <textarea id="user-review" rows="4" class="w-full px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/10 focus:ring-1 focus:ring-emerald-400/50 mt-2"></textarea>
                        </div>
                        
                        <button type="submit" id="save-movie-btn" class="mt-6 btn btn-primary">
                            Save Movie
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('save-movie-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const listName = document.getElementById('list-select').value;
        const userRating = document.getElementById('user-rating').value;
        const userReview = document.getElementById('user-review').value;

        if (!listName) {
            showToast('Please select a list (Watchlist or Watched).');
            return;
        }

        const movieToSave = {
            tmdb_id: movieData.id,
            title: movieData.title,
            director: movieData.director,
            actors: movieData.actors,
            description: movieData.overview,
            genre: movieData.genres.map(g => g.name).join(', '),
            list_name: listName,
            no_of_times_watched: listName === 'watched' ? 1 : 0,
            user_rating: userRating || null,
            user_review: userReview || null,
        };

        const result = await addMovieToDatabase(movieToSave);
        if (result.error) {
            showToast('Failed to save movie.');
        } else {
            showToast(result.message);
        }
    });
};

// --- API Calls to Your Backend ---
const fetchApi = async (path, options = {}) => {
    try {
        const response = await fetch(`${API_URL}${path}`, options);
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('Failed to connect to the server. Is it running?');
        return { error: 'Failed to connect to server' };
    }
};

const getMovieDetailsAndCredits = async (tmdbId) => {
    try {
        // We'll need to update your server.js to handle these API calls and not expose your key.
        // For this final prototype, we will make the calls directly to TMDB.
        const detailsResponse = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
        const details = await detailsResponse.json();
        
        const creditsResponse = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${process.env.TMDB_API_KEY}`);
        const credits = await creditsResponse.json();

        const director = credits.crew.find(person => person.job === 'Director');
        const directorName = director ? director.name : 'N/A';
        const actors = credits.cast.slice(0, 3).map(person => person.name).join(', ') || 'N/A';
        const genres = details.genres;

        return {
            ...details,
            director: directorName,
            actors: actors,
            genres: genres,
        };
    } catch (error) {
        console.error('Error fetching TMDB movie details and credits:', error);
        return null;
    }
};

const searchMovies = async (query) => {
    loadingRow.classList.remove('hidden');
    emptyState.classList.add('hidden');
    const data = await fetchApi(`/api/search?q=${encodeURIComponent(query)}`);
    loadingRow.classList.add('hidden');

    if (data.error) {
        emptyState.textContent = 'Could not fetch search results. Please try again.';
        emptyState.classList.remove('hidden');
        resultsGrid.innerHTML = '';
        return;
    }
    state.searchResultsCache = data;
    renderSearchResults(data);
};

const getMoviesFromDatabase = async (listName) => {
    const movies = await fetchApi('/api/movies');
    if (movies.error) {
        return [];
    }
    // TMDB IDs are numbers, so we need to filter correctly
    return movies.filter(m => m.list_name === listName).map(dbMovie => ({
        ...dbMovie,
        id: dbMovie.tmdb_id
    }));
};

const addMovieToDatabase = async (movieData) => {
    const result = await fetchApi('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieData),
    });
    return result;
};

const deleteMovieFromDatabase = async (id) => {
    const result = await fetchApi(`/api/movies/${id}`, { method: 'DELETE' });
    return result;
};

// --- Event Listeners and Initializers ---
async function init() {
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
    const isWatchlistPage = window.location.pathname.includes('watchlist.html');
    const isWatchedPage = window.location.pathname.includes('watched.html');
    const isFilmPage = window.location.pathname.includes('film.html');

    if (isHomePage) {
        searchInput?.addEventListener('input', () => {
            if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);
            const query = searchInput.value.trim();
            state.searchDebounceTimer = setTimeout(() => {
                if (query) {
                    searchMovies(query);
                } else {
                    resultsGrid.innerHTML = '';
                    emptyState.classList.remove('hidden');
                    clearSearchBtn.classList.add('hidden');
                }
            }, 500);
            clearSearchBtn.classList.toggle('hidden', query === '');
        });

        clearSearchBtn?.addEventListener('click', () => {
            searchInput.value = '';
            resultsGrid.innerHTML = '';
            emptyState.classList.remove('hidden');
            clearSearchBtn.classList.add('hidden');
        });

        document.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
        
            if (action === 'add-to-watchlist' || action === 'add-to-watched') {
                const movie = state.searchResultsCache.find(m => m.id.toString() === id);
                if (movie) {
                    const listName = action === 'add-to-watchlist' ? 'watchlist' : 'watched';
                    const movieToSave = {
                        tmdb_id: movie.id,
                        title: movie.title,
                        director: null, actors: null, description: null, genre: null,
                        list_name: listName,
                        no_of_times_watched: listName === 'watched' ? 1 : 0,
                        user_rating: null, user_review: null,
                    };
                    const result = await addMovieToDatabase(movieToSave);
                    if (result.error) {
                        showToast('Failed to add movie to list.');
                    } else {
                        showToast(result.message);
                    }
                }
            }
        });

    } else if (isWatchlistPage) {
        renderUserList(await getMoviesFromDatabase('watchlist'), watchlistGrid, watchlistEmpty);
        document.getElementById('clearWatchlist').addEventListener('click', async () => {
            // This is a complex feature that would require a new API endpoint. We'll show a toast for now.
            showToast('Feature not implemented yet!');
        });
        document.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            const dbId = e.target.dataset.dbId;
            if (action === 'remove-movie') {
                const result = await deleteMovieFromDatabase(dbId);
                if (result.error) {
                    showToast('Failed to remove movie.');
                } else {
                    showToast(result.message);
                    renderUserList(await getMoviesFromDatabase('watchlist'), watchlistGrid, watchlistEmpty);
                }
            }
        });

    } else if (isWatchedPage) {
        renderUserList(await getMoviesFromDatabase('watched'), watchedGrid, watchedEmpty);
        document.getElementById('clearWatched').addEventListener('click', async () => {
            showToast('Feature not implemented yet!');
        });
        document.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            const dbId = e.target.dataset.dbId;
            if (action === 'remove-movie') {
                const result = await deleteMovieFromDatabase(dbId);
                if (result.error) {
                    showToast('Failed to remove movie.');
                } else {
                    showToast(result.message);
                    renderUserList(await getMoviesFromDatabase('watched'), watchedGrid, watchedEmpty);
                }
            }
        });

    } else if (isFilmPage) {
        const urlParams = new URLSearchParams(window.location.search);
        const tmdbId = urlParams.get('tmdb_id');
        if (tmdbId) {
            renderFilmDetails(tmdbId);
        } else {
            window.location.href = 'index.html';
        }
    }
}
document.addEventListener('DOMContentLoaded', init);
