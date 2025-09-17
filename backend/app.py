from flask import Flask, request, jsonify
import pickle
from flask_cors import CORS
import requests
import traceback
import logging
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import urllib3

# Disable SSL warnings for production (optional)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(_name_)

TMDB_API_KEY = 'ee11b35464a0049626a7684f706d0398'

app = Flask(_name_)
CORS(app)

# Create a session with retry strategy and connection pooling
session = requests.Session()
session.headers.update({
    'User-Agent': 'Movie-Recommender/1.0'
})

retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD", "GET", "OPTIONS"]
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Load data with error handling
try:
    movies = pickle.load(open('movie_latest.pkl', 'rb'))
    similarity = pickle.load(open('similarity.pkl', 'rb'))
    logger.info(f"Data loaded successfully. Movies: {len(movies)}, Similarity shape: {similarity.shape}")
except Exception as e:
    logger.error(f"Error loading data: {e}")
    raise

def fetch_poster(movie_id):
    max_retries = 3
    placeholder_url = "https://via.placeholder.com/300x450/cccccc/666666?text=No+Poster"
    
    for attempt in range(max_retries):
        try:
            # Check if movie_id is an IMDb ID (starts with 'tt')
            if str(movie_id).startswith('tt'):
                # Use TMDB's find by IMDb ID endpoint
                url = f"https://api.themoviedb.org/3/find/{movie_id}?api_key={TMDB_API_KEY}&external_source=imdb_id"
                response = session.get(url, timeout=30, verify=True)
                
                if response.status_code == 200:
                    data = response.json()
                    movie_results = data.get('movie_results', [])
                    if movie_results:
                        poster_path = movie_results[0].get('poster_path')
                        if poster_path:
                            poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                            # Verify the image URL is accessible
                            try:
                                img_response = session.head(poster_url, timeout=15, verify=True)
                                if img_response.status_code == 200:
                                    return poster_url
                                else:
                                    logger.warning(f"Poster URL not accessible: {poster_url}")
                            except Exception as img_e:
                                logger.warning(f"Error verifying poster URL {poster_url}: {img_e}")
                else:
                    logger.warning(f"TMDB API returned status {response.status_code} for IMDb ID {movie_id}")
            else:
                # Try direct TMDB movie ID
                url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={TMDB_API_KEY}"
                response = session.get(url, timeout=30, verify=True)
                
                if response.status_code == 200:
                    data = response.json()
                    poster_path = data.get('poster_path')
                    if poster_path:
                        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                        # Verify the image URL is accessible
                        try:
                            img_response = session.head(poster_url, timeout=15, verify=True)
                            if img_response.status_code == 200:
                                return poster_url
                            else:
                                logger.warning(f"Poster URL not accessible: {poster_url}")
                        except Exception as img_e:
                            logger.warning(f"Error verifying poster URL {poster_url}: {img_e}")
                else:
                    logger.warning(f"TMDB API returned status {response.status_code} for movie_id {movie_id}")
                    
        except (requests.exceptions.SSLError, 
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.RequestException) as e:
            logger.warning(f"Attempt {attempt + 1}/{max_retries} failed for movie_id {movie_id}: {type(e)._name_}: {e}")
            
            if attempt < max_retries - 1:
                # Exponential backoff: 2^attempt seconds
                sleep_time = 2 ** attempt
                logger.info(f"Waiting {sleep_time} seconds before retry...")
                time.sleep(sleep_time)
                continue
            else:
                logger.error(f"All {max_retries} attempts failed for movie_id {movie_id}")
                break
                
        except Exception as e:
            logger.error(f"Unexpected error fetching poster for movie_id {movie_id}: {e}")
            break
    
    # Return placeholder if all attempts failed
    return placeholder_url

@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        movie = data.get('movie')
        if not movie:
            return jsonify({'error': 'Movie name not provided'}), 400

        logger.info(f"Received recommendation request for movie: {movie}")

        if movie not in movies['movie_name'].values:
            logger.warning(f"Movie '{movie}' not found in dataset")
            return jsonify({'error': 'Movie not found'}), 404

        idx = movies[movies['movie_name'] == movie].index[0]
        logger.info(f"Found movie '{movie}' at index {idx}")
        
        distances = similarity[idx]
        movie_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:6]

        recommendations = []
        for i, (movie_idx, distance) in enumerate(movie_list):
            try:
                movie_data = movies.iloc[movie_idx]
                movie_id = movie_data['movie_id']
                movie_name = movie_data['movie_name']
                logger.info(f"Processing recommendation {i+1}: {movie_name} (ID: {movie_id}, Type: {type(movie_id)})")
                
                poster_url = fetch_poster(movie_id)
                logger.info(f"Poster URL for {movie_name}: {poster_url}")
                
                recommendations.append({
                    'name': movie_name,
                    'poster': poster_url
                })
            except Exception as e:
                logger.error(f"Error processing movie at index {movie_idx}: {e}")
                continue

        logger.info(f"Returning {len(recommendations)} recommendations")
        return jsonify({'recommended_movies': recommendations})

    except Exception as e:
        logger.error(f"Error in recommend endpoint: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/search', methods=['GET'])
def search():
    try:
        query = request.args.get('q', '').lower()
        logger.info(f"Received search request for query: {query}")
        
        matched_movies = movies[movies['movie_name'].str.lower().str.contains(query)]
        matches = matched_movies['movie_name'].tolist()
        
        logger.info(f"Found {len(matches)} matches for query '{query}'")
        return jsonify({'matches': matches})
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/test_poster/<movie_id>', methods=['GET'])
def test_poster(movie_id):
    try:
        poster_url = fetch_poster(movie_id)
        return jsonify({
            'movie_id': movie_id,
            'poster_url': poster_url,
            'success': poster_url != "https://via.placeholder.com/300x450/cccccc/666666?text=No+Poster"
        })
    except Exception as e:
        logger.error(f"Error testing poster for movie_id {movie_id}: {e}")
        return jsonify({'error': str(e)}), 500

if _name_ == '_main_':
    app.run(debug=True, host='0.0.0.0', port=5000)
