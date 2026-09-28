from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Basic service health check."""
    return {"status": "ok", "service": "tracker-backend"}


@router.get("/health/db", status_code=status.HTTP_200_OK)
def db_health_check(db: Session = Depends(get_db)):
    """Database connectivity health check."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except SQLAlchemyError as e:
        return {"status": "error", "database": str(e)}
