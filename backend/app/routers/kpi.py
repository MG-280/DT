from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import FilterParams, KpiResponse
from app.services.kpi_service import get_kpi_data

router = APIRouter(tags=['kpi'])


@router.get('/kpi', response_model=KpiResponse)
async def read_kpis(
    filters: FilterParams = Depends(),
    conn: asyncpg.Connection = Depends(get_db)
) -> KpiResponse:
    """Return aggregated requirement, EDI, and inventory KPIs for the selected filter window."""
    try:
        return await get_kpi_data(conn, filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch KPI data: {exc}') from exc
