from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import FilterParams, GridResponse
from app.services.grid_service import get_grid_data

router = APIRouter(tags=['grid'])


@router.get('/grid', response_model=GridResponse)
async def read_grid(
    filters: FilterParams = Depends(),
    conn: asyncpg.Connection = Depends(get_db)
) -> GridResponse:
    """Return part-by-week requirement, EDI, and inventory values for the selected filter window."""
    try:
        return await get_grid_data(conn, filters)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch grid data: {exc}') from exc
