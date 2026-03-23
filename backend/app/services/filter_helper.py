from __future__ import annotations

from collections.abc import Sequence

import asyncpg

from app.models.schemas import FilterParams


def _split_multi_value(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(',') if item.strip()]


async def resolve_part_ids(conn: asyncpg.Connection, filters: FilterParams) -> list[str] | None:
    """
    Returns list of part_ids to filter on, or None meaning no part filter.
    Priority: part_id > assembly_id > product_id.
    Supplier filtering is handled separately on fact queries.
    """
    part_ids = _split_multi_value(filters.part_id)
    if part_ids:
        return part_ids

    assembly_ids = _split_multi_value(filters.assembly_id)
    if assembly_ids:
        rows = await conn.fetch(
            """
            SELECT DISTINCT bpa.part_id
            FROM dt_bridge_part_assembly AS bpa
            WHERE bpa.assembly_id = ANY($1::text[])
            ORDER BY bpa.part_id
            """,
            assembly_ids
        )
        return [row['part_id'] for row in rows]

    product_ids = _split_multi_value(filters.product_id)
    if product_ids:
        rows = await conn.fetch(
            """
            SELECT DISTINCT bpa.part_id
            FROM dt_bridge_assembly_product AS bap
            JOIN dt_bridge_part_assembly AS bpa
              ON bpa.assembly_id = bap.assembly_id
            WHERE bap.product_id = ANY($1::text[])
            ORDER BY bpa.part_id
            """,
            product_ids
        )
        return [row['part_id'] for row in rows]

    return None


async def resolve_factory_ids(conn: asyncpg.Connection, filters: FilterParams) -> list[str] | None:
    """
    Returns list of factory_ids to filter on, or None meaning no factory filter.
    Handles location_id -> factory_id resolution.
    """
    if filters.factory_id:
        return [filters.factory_id]

    if filters.location_id:
        rows = await conn.fetch(
            """
            SELECT df.factory_id
            FROM dt_dim_factory AS df
            WHERE df.location_id = $1
            ORDER BY df.factory_id
            """,
            filters.location_id
        )
        return [row['factory_id'] for row in rows]

    return None


async def fetch_time_range_weeks(
    conn: asyncpg.Connection,
    time_range: str,
    *,
    is_forecast: bool
) -> list[asyncpg.Record]:
    rows = await conn.fetch(
        """
        SELECT dw.week_id, dw.week_number, dw.week_index, dw.year, dw.month, dw.is_forecast
        FROM dt_dim_week AS dw
        WHERE dw.is_forecast = $1
        ORDER BY dw.week_index ASC
        """,
        is_forecast
    )
    return list(rows)


async def fetch_historical_period_windows(
    conn: asyncpg.Connection,
    time_range: str
) -> tuple[list[str], list[str]]:
    limit = {'12w': 12, '6m': 26, '1y': 52, 'all': None}[time_range]
    rows = await conn.fetch(
        """
        SELECT dw.week_id
        FROM dt_dim_week AS dw
        WHERE dw.is_forecast = FALSE
        ORDER BY dw.week_index ASC
        """
    )
    week_ids = [row['week_id'] for row in rows]

    if not week_ids:
        return [], []

    if limit is None or limit >= len(week_ids):
        return week_ids, []

    current = week_ids[-limit:]
    previous = week_ids[max(0, len(week_ids) - (2 * limit)):len(week_ids) - limit]
    return current, previous


def to_python_list(rows: Sequence[asyncpg.Record], key: str) -> list[str]:
    return [row[key] for row in rows]
