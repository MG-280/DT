from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import ImpactAnalysisResponse
from app.services.impact_service import get_impact_analysis

router = APIRouter(tags=['impact'])


@router.get('/anomalies/{part_id}/{week_id}/impact', response_model=ImpactAnalysisResponse)
async def read_impact_analysis(
    part_id: str,
    week_id: str,
    conn: asyncpg.Connection = Depends(get_db),
) -> ImpactAnalysisResponse:
    """Return a full impact analysis for the given anomalous part and week.

    Includes the anomaly detail, the upstream assembly-to-product impact chain,
    sibling parts sharing the same assemblies, a ±4-week trend window, and an
    AI-generated plain-English summary.  Returns HTTP 404 if no anomaly record
    exists for the supplied part_id + week_id combination.
    """
    try:
        result = await get_impact_analysis(conn, part_id, week_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to fetch impact analysis: {exc}') from exc

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f'No anomaly found for part {part_id!r} in week {week_id!r}',
        )

    return result
