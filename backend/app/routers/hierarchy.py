from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import HierarchyNetworkResponse, HierarchyResponse
from app.services.hierarchy_service import get_hierarchy, get_hierarchy_network

router = APIRouter(tags=['hierarchy'])


@router.get('/hierarchy', response_model=HierarchyResponse)
async def read_hierarchy(
    conn: asyncpg.Connection = Depends(get_db)
) -> HierarchyResponse:
    """Return the full product -> assembly -> part hierarchy used by the frontend tree and network views."""
    try:
        return await get_hierarchy(conn)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch hierarchy: {exc}') from exc


@router.get('/hierarchy/network', response_model=HierarchyNetworkResponse)
async def read_hierarchy_network(
    conn: asyncpg.Connection = Depends(get_db)
) -> HierarchyNetworkResponse:
    """Return full supplier -> part -> assembly -> product relationship graph for network visualization."""
    try:
        return await get_hierarchy_network(conn)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch hierarchy network: {exc}') from exc
