async function getRecommendations() {
    try {
        const movie = document.getElementById("movieInput").value;

        const response = await fetch("http://127.0.0.1:5000/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movie: movie })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const resultsDiv = document.getElementById("recommendations");
        resultsDiv.innerHTML = "";

        if (data.recommended_movies) {
            data.recommended_movies.forEach(movie => {
                const p = document.createElement("p");
                p.textContent = movie;
                resultsDiv.appendChild(p);
            });
        } else {
            resultsDiv.innerHTML = `<p style="color:red;">${data.error}</p>`;
        }
    } catch (error) {
        console.error("Error in getRecommendations:", error);
        const resultsDiv = document.getElementById("recommendations");
        if(resultsDiv) {
            resultsDiv.innerHTML = `<p style="color:red;">Error fetching recommendations.</p>`;
        }
    }
}
