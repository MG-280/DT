from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.models.schemas import DailyPoint, FilterParams, TimeSeriesPoint
from app.services.timeseries_service import get_daily_timeseries, get_timeseries

router = APIRouter(tags=['timeseries'])


@router.get('/timeseries', response_model=list[TimeSeriesPoint])
async def read_timeseries(
    filters: FilterParams = Depends(),
    conn: asyncpg.Connection = Depends(get_db)
) -> list[TimeSeriesPoint]:
    """Return weekly or monthly time-series aggregates for requirements, EDI orders, and inventory."""
    try:
        return await get_timeseries(conn, filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch time series data: {exc}') from exc


@router.get('/timeseries/daily', response_model=list[DailyPoint])
async def read_daily_timeseries(
    week_id: str = Query(..., min_length=1),
    filters: FilterParams = Depends(),
    conn: asyncpg.Connection = Depends(get_db)
) -> list[DailyPoint]:
    """Return a seven-day drill-down for the requested week with zero-filled missing values."""
    try:
        return await get_daily_timeseries(conn, week_id, filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch daily time series data: {exc}') from exc
