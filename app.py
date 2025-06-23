from flask import Flask, request, jsonify
import pickle
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

movies = pickle.load(open('movies.pkl', 'rb'))
similarity = pickle.load(open('similarity.pkl', 'rb'))

@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    movie = data.get('movie')

    if movie not in movies['movie_name'].values:
        return jsonify({'error': 'Movie not found'})

    idx = movies[movies['movie_name'] == movie].index[0]
    distances = similarity[idx]
    movie_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:6]
    recommended = [movies.iloc[i[0]].movie_name for i in movie_list]
    return jsonify({'recommended_movies': recommended})

if __name__ == '__main__':
    app.run(debug=True)
