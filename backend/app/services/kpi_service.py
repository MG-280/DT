from __future__ import annotations

import asyncpg

from app.models.schemas import FilterParams, KpiResponse
from app.services.filter_helper import fetch_historical_period_windows, resolve_factory_ids, resolve_part_ids

_ZERO_KPI = KpiResponse(
    requirements_total=0.0,
    edi_total=0.0,
    inventory_current=0.0,
    req_trend_pct=0.0,
    edi_trend_pct=0.0,
    inv_trend_pct=0.0
)


async def get_kpi_data(conn: asyncpg.Connection, filters: FilterParams) -> KpiResponse:
    current_weeks, previous_weeks = await fetch_historical_period_windows(conn, filters.time_range)
    part_ids = await resolve_part_ids(conn, filters)
    factory_ids = await resolve_factory_ids(conn, filters)

    if part_ids == [] or factory_ids == [] or not current_weeks:
        return _ZERO_KPI

    current = await _fetch_metrics(conn, current_weeks, part_ids, factory_ids, filters.supplier_id)
    previous = await _fetch_metrics(conn, previous_weeks, part_ids, factory_ids, filters.supplier_id)

    return KpiResponse(
        requirements_total=float(current['requirements_total']),
        edi_total=float(current['edi_total']),
        inventory_current=float(current['inventory_current']),
        req_trend_pct=_pct_change(current['requirements_total'], previous['requirements_total']),
        edi_trend_pct=_pct_change(current['edi_total'], previous['edi_total']),
        inv_trend_pct=_pct_change(current['inventory_current'], previous['inventory_current'])
    )


async def _fetch_metrics(
    conn: asyncpg.Connection,
    week_ids: list[str],
    part_ids: list[str] | None,
    factory_ids: list[str] | None,
    supplier_id: str | None
) -> asyncpg.Record:
    if not week_ids:
        return {
            'requirements_total': 0.0,
            'edi_total': 0.0,
            'inventory_current': 0.0
        }

    return await conn.fetchrow(
        """
        WITH req AS (
            SELECT COALESCE(SUM(fr.requirement_qty), 0) AS total
            FROM dt_fact_requirements AS fr
            WHERE fr.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fr.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fr.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fr.supplier_id = $4)
        ),
        edi AS (
            SELECT COALESCE(SUM(fe.edi_qty), 0) AS total
            FROM dt_fact_edi_orders AS fe
            WHERE fe.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fe.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fe.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fe.supplier_id = $4)
        ),
        inv AS (
                        SELECT COALESCE(SUM(fi.inventory_qty), 0) AS total
            FROM dt_fact_inventory AS fi
            WHERE fi.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fi.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fi.factory_id = ANY($3::text[]))
              AND (
                $4::text IS NULL OR EXISTS (
                    SELECT 1
                    FROM dt_bridge_part_supplier AS bps
                    WHERE bps.part_id = fi.part_id
                      AND bps.supplier_id = $4
                )
              )
        )
        SELECT
            req.total AS requirements_total,
            edi.total AS edi_total,
            inv.total AS inventory_current
        FROM req, edi, inv
        """,
        week_ids,
        part_ids,
        factory_ids,
        supplier_id
    )


def _pct_change(current_value: float | int, previous_value: float | int) -> float:
    current = float(current_value or 0)
    previous = float(previous_value or 0)

    if previous == 0:
        return 0.0

    return round(((current - previous) / previous) * 100, 2)
