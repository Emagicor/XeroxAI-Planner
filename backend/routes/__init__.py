from routes.analyze import analyze_bp
from routes.health import health_bp


def register_routes(app) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(analyze_bp)
