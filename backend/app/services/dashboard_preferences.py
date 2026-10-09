from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dashboard_preference import DashboardPreference


def get_preferences(db: Session, client_id: int) -> DashboardPreference | None:
    return db.execute(
        select(DashboardPreference).where(DashboardPreference.cliente_id == client_id)
    ).scalar_one_or_none()


def upsert_preferences(
    db: Session, client_id: int, cards: list[str]
) -> DashboardPreference:
    row = get_preferences(db, client_id)
    if row is None:
        row = DashboardPreference(cliente_id=client_id, tarjetas=list(cards))
        db.add(row)
    else:
        row.tarjetas = list(cards)
    db.commit()
    db.refresh(row)
    return row
