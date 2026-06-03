from routes.analyze import analyze_router
from routes.health import health_router
from routes.export import export_router


def register_routes(app) -> None:
    app.include_router(health_router)
    app.include_router(analyze_router)
    app.include_router(export_router)
