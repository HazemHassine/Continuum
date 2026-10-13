from fastapi import APIRouter

from app.api.v1.endpoints import auth, goals, health, projects, workspace

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(goals.router, prefix="/goals", tags=["goals"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(workspace.router, tags=["workspace"])
