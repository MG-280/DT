from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import AnomalyItem, FilterParams
from app.services.anomaly_service import get_anomalies

router = APIRouter(tags=['anomalies'])


@router.get('/anomalies', response_model=list[AnomalyItem])
async def read_anomalies(
    filters: FilterParams = Depends(),
    conn: asyncpg.Connection = Depends(get_db)
) -> list[AnomalyItem]:
    """Return anomaly rows enriched with part names, week labels, percentage deltas, and severity."""
    try:
        return await get_anomalies(conn, filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch anomalies: {exc}') from exc
