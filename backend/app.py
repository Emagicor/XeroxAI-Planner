from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from routes import register_routes

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    register_routes(app)
    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
