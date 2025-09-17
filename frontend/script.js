const movieInput = document.getElementById("movieInput");
const suggestionsBox = document.getElementById("suggestions");
let currentSuggestions = [];
const BASE_URL = 'https://movie-recommendation-system-akoz.onrender.com';


// Add loading state management
function showLoading(button) {
    const originalText = button.textContent;
    button.innerHTML = '<span class="loading"></span> Loading...';
    button.disabled = true;
    return originalText;
}

function hideLoading(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
}

// Enhanced input handling with debouncing
let searchTimeout;
movieInput.addEventListener("keyup", async function () {
    const query = movieInput.value.trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    if (query.length === 0) {
        suggestionsBox.innerHTML = "";
        suggestionsBox.style.display = "none";
        return;
    }

    // Add debouncing for better performance
    searchTimeout = setTimeout(async () => {
        try {
            // Show loading state in suggestions
            suggestionsBox.innerHTML = '<div class="suggestion">Searching...</div>';
            suggestionsBox.style.display = "block";
            
            const response = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            suggestionsBox.innerHTML = "";

            if (data.matches && data.matches.length > 0) {
                currentSuggestions = data.matches;
            
                data.matches.forEach((movie, index) => {
                    const div = document.createElement("div");
                    div.className = "suggestion";
                    div.textContent = movie;
                    div.style.animationDelay = `${index * 0.1}s`;

                    div.onclick = () => {
                        movieInput.value = movie;
                        suggestionsBox.innerHTML = "";
                        suggestionsBox.style.display = "none";
                        getRecommendations();
                    };

                    div.onmouseenter = () => {
                        div.style.transform = "translateX(8px)";
                    };

                    div.onmouseleave = () => {
                        div.style.transform = "translateX(0)";
                    };

                    suggestionsBox.appendChild(div);
                });
            } else {
                suggestionsBox.innerHTML = '<div class="suggestion" style="color: #a0aec0;">No movies found</div>';
            }
        } catch (error) {
            console.error("Error fetching suggestions:", error);
            suggestionsBox.innerHTML = '<div class="suggestion" style="color: #e53e3e;">Error loading suggestions</div>';
        }
    }, 300); // 300ms debounce
});

// Close suggestions when clicking outside
document.addEventListener('click', function(event) {
    if (!movieInput.contains(event.target) && !suggestionsBox.contains(event.target)) {
        suggestionsBox.style.display = "none";
    }
});

// Enhanced recommendations function with better image handling
async function getRecommendations() {
    const movie = movieInput.value.trim();
    if (!movie) {
        showNotification("Please enter a movie name", "error");
        return;
    }

    const button = document.querySelector('button');
    const originalText = showLoading(button);

    try {
        const response = await fetch(`${BASE_URL}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(movie)
        });

        const data = await response.json();
        const container = document.querySelector('.container');
        container.classList.add('expanded');
        
        const resultsDiv = document.getElementById("recommendations");
        resultsDiv.innerHTML = "";

        if (data.recommended_movies && data.recommended_movies.length > 0) {
            // Add success notification
            showNotification(`Found ${data.recommended_movies.length} recommendations!`, "success");
            
            data.recommended_movies.forEach((movie, index) => {
                const div = document.createElement("div");
                div.className = "recommendation-item";
                div.style.animationDelay = `${index * 0.1}s`;

                const img = document.createElement("img");
                img.src = movie.poster || "";
                img.alt = movie.name;
                img.loading = "lazy";
                img.style.opacity = "0";
                img.style.transition = "opacity 0.3s ease";
                
                // Enhanced error handling with multiple fallback options
                img.onerror = function() {
                    // Try multiple fallback options
                    if (this.src.includes("placeholder")) {
                        // If already using placeholder, use a different one
                        this.src = `https://via.placeholder.com/300x450/667eea/ffffff?text=${encodeURIComponent(movie.name)}`;
                    } else {
                        // First fallback - try a different placeholder
                        this.src = "https://via.placeholder.com/300x450/667eea/ffffff?text=No+Poster";
                    }
                    this.style.opacity = "1";
                };

                img.onload = function() {
                    this.style.opacity = "1";
                };

                // Add timeout for slow loading images
                setTimeout(() => {
                    if (img.style.opacity === "0") {
                        img.src = `https://via.placeholder.com/300x450/667eea/ffffff?text=${encodeURIComponent(movie.name)}`;
                        img.style.opacity = "1";
                    }
                }, 5000); // 5 second timeout

                const title = document.createElement("p");
                title.textContent = movie.name;
                title.style.marginTop = "12px";
                title.style.fontWeight = "600";

                // Add click to copy functionality
                div.onclick = () => {
                    navigator.clipboard.writeText(movie.name).then(() => {
                        showNotification(`Copied "${movie.name}" to clipboard!`, "success");
                    });
                };

                div.appendChild(img);
                div.appendChild(title);
                resultsDiv.appendChild(div);
            });
        } else {
            resultsDiv.innerHTML = `<p style="color: #e53e3e; font-weight: 600;">${data.error || 'No recommendations found'}</p>`;
            showNotification("No recommendations found", "error");
        }
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        document.getElementById("recommendations").innerHTML = 
            `<p style="color: #e53e3e; font-weight: 600;">Error fetching recommendations. Please try again.</p>`;
        showNotification("Error fetching recommendations", "error");
    } finally {
        hideLoading(button, originalText);
    }
}

// Notification system
function showNotification(message, type = "info") {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    // Set background color based on type
    if (type === "success") {
        notification.style.backgroundColor = "#48bb78";
    } else if (type === "error") {
        notification.style.backgroundColor = "#e53e3e";
    } else {
        notification.style.backgroundColor = "#667eea";
    }

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = "slideOutRight 0.3s ease-out";
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add keyboard navigation for suggestions
movieInput.addEventListener("keydown", function(e) {
    const suggestions = suggestionsBox.querySelectorAll('.suggestion');
    const currentIndex = Array.from(suggestions).findIndex(s => s.classList.contains('selected'));
    
    if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex < suggestions.length - 1 ? currentIndex + 1 : 0;
        selectSuggestion(nextIndex, suggestions);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : suggestions.length - 1;
        selectSuggestion(prevIndex, suggestions);
    } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentIndex >= 0 && suggestions[currentIndex]) {
            suggestions[currentIndex].click();
        } else {
            getRecommendations();
        }
    } else if (e.key === "Escape") {
        suggestionsBox.style.display = "none";
    }
});

function selectSuggestion(index, suggestions) {
    suggestions.forEach(s => s.classList.remove('selected'));
    if (suggestions[index]) {
        suggestions[index].classList.add('selected');
        suggestions[index].style.backgroundColor = "rgba(102, 126, 234, 0.2)";
    }
}

// Add smooth scrolling for better UX
function smoothScrollTo(element) {
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}
