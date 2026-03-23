from __future__ import annotations

import asyncpg

from app.models.schemas import DailyPoint, FilterParams, TimeSeriesPoint
from app.services.filter_helper import fetch_time_range_weeks, resolve_factory_ids, resolve_part_ids


async def get_timeseries(conn: asyncpg.Connection, filters: FilterParams) -> list[TimeSeriesPoint]:
    week_rows = await fetch_time_range_weeks(conn, filters.time_range, is_forecast=filters.is_forecast)
    part_ids = await resolve_part_ids(conn, filters)
    factory_ids = await resolve_factory_ids(conn, filters)

    if part_ids == [] or factory_ids == [] or not week_rows:
        return []

    week_ids = [row['week_id'] for row in week_rows]

    if filters.granularity == 'monthly':
        rows = await _fetch_monthly_series(conn, week_ids, part_ids, factory_ids, filters.supplier_id)
    else:
        rows = await _fetch_weekly_series(conn, week_ids, part_ids, factory_ids, filters.supplier_id)

    return [TimeSeriesPoint(**dict(row)) for row in rows]


async def get_daily_timeseries(
    conn: asyncpg.Connection,
    week_id: str,
    filters: FilterParams
) -> list[DailyPoint]:
    part_ids = await resolve_part_ids(conn, filters)
    factory_ids = await resolve_factory_ids(conn, filters)

    if part_ids == [] or factory_ids == []:
        return [
            DailyPoint(day_id=f'{week_id}-D{index}', day_label=label, requirements=0.0, edi=0.0, inventory=0.0)
            for index, label in enumerate(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], start=1)
        ]

    rows = await conn.fetch(
        """
        WITH day_slots AS (
            SELECT
                slot.day_num,
                CASE slot.day_num
                    WHEN 1 THEN 'Mon'
                    WHEN 2 THEN 'Tue'
                    WHEN 3 THEN 'Wed'
                    WHEN 4 THEN 'Thu'
                    WHEN 5 THEN 'Fri'
                    WHEN 6 THEN 'Sat'
                    ELSE 'Sun'
                END AS day_label
            FROM generate_series(1, 7) AS slot(day_num)
        ),
        calendar_days AS (
            SELECT
                day_slots.day_num,
                COALESCE(dd.day_id, $1 || '-D' || day_slots.day_num::text) AS day_id,
                COALESCE(SUBSTRING(dd.day_of_week_name FROM 1 FOR 3), day_slots.day_label) AS day_label
            FROM day_slots
            LEFT JOIN dt_dim_date AS dd
              ON dd.week_id = $1
             AND dd.day_of_week_num = day_slots.day_num
        ),
        req AS (
            SELECT frd.day_id, COALESCE(SUM(frd.requirement_qty), 0) AS total
            FROM dt_fact_requirements_daily AS frd
            WHERE frd.week_id = $1
              AND ($2::text[] IS NULL OR frd.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR frd.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR frd.supplier_id = $4)
            GROUP BY frd.day_id
        ),
        edi AS (
            SELECT fed.day_id, COALESCE(SUM(fed.edi_qty), 0) AS total
            FROM dt_fact_edi_orders_daily AS fed
            WHERE fed.week_id = $1
              AND ($2::text[] IS NULL OR fed.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fed.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fed.supplier_id = $4)
            GROUP BY fed.day_id
        ),
        inv AS (
                        SELECT fid.day_id, COALESCE(SUM(fid.inventory_qty), 0) AS total
            FROM dt_fact_inventory_daily AS fid
            WHERE fid.week_id = $1
              AND ($2::text[] IS NULL OR fid.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fid.factory_id = ANY($3::text[]))
              AND (
                $4::text IS NULL OR EXISTS (
                    SELECT 1
                    FROM dt_bridge_part_supplier AS bps
                    WHERE bps.part_id = fid.part_id
                      AND bps.supplier_id = $4
                )
              )
            GROUP BY fid.day_id
        )
        SELECT
            cd.day_id,
            cd.day_label,
            COALESCE(req.total, 0)::float AS requirements,
            COALESCE(edi.total, 0)::float AS edi,
            COALESCE(inv.total, 0)::float AS inventory
        FROM calendar_days AS cd
        LEFT JOIN req ON req.day_id = cd.day_id
        LEFT JOIN edi ON edi.day_id = cd.day_id
        LEFT JOIN inv ON inv.day_id = cd.day_id
        ORDER BY cd.day_num ASC
        """,
        week_id,
        part_ids,
        factory_ids,
        filters.supplier_id
    )

    return [DailyPoint(**dict(row)) for row in rows]


async def _fetch_weekly_series(
    conn: asyncpg.Connection,
    week_ids: list[str],
    part_ids: list[str] | None,
    factory_ids: list[str] | None,
    supplier_id: str | None
) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        WITH selected_weeks AS (
            SELECT dw.week_id, dw.week_number, dw.week_index, dw.is_forecast
            FROM dt_dim_week AS dw
            WHERE dw.week_id = ANY($1::text[])
        ),
        req AS (
            SELECT fr.week_id, COALESCE(SUM(fr.requirement_qty), 0) AS total
            FROM dt_fact_requirements AS fr
            WHERE fr.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fr.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fr.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fr.supplier_id = $4)
            GROUP BY fr.week_id
        ),
        edi AS (
            SELECT fe.week_id, COALESCE(SUM(fe.edi_qty), 0) AS total
            FROM dt_fact_edi_orders AS fe
            WHERE fe.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fe.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fe.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fe.supplier_id = $4)
            GROUP BY fe.week_id
        ),
        inv AS (
                        SELECT fi.week_id, COALESCE(SUM(fi.inventory_qty), 0) AS total
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
            GROUP BY fi.week_id
        )
        SELECT
            sw.week_id,
            'W' || LPAD(sw.week_number::text, 2, '0') AS week_label,
            COALESCE(req.total, 0)::float AS requirements,
            COALESCE(edi.total, 0)::float AS edi,
            COALESCE(inv.total, 0)::float AS inventory,
            sw.is_forecast
        FROM selected_weeks AS sw
        LEFT JOIN req ON req.week_id = sw.week_id
        LEFT JOIN edi ON edi.week_id = sw.week_id
        LEFT JOIN inv ON inv.week_id = sw.week_id
        ORDER BY sw.week_index ASC
        """,
        week_ids,
        part_ids,
        factory_ids,
        supplier_id
    )


async def _fetch_monthly_series(
    conn: asyncpg.Connection,
    week_ids: list[str],
    part_ids: list[str] | None,
    factory_ids: list[str] | None,
    supplier_id: str | None
) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        WITH selected_weeks AS (
            SELECT dw.week_id, dw.week_index, dw.year, dw.month, dw.is_forecast
            FROM dt_dim_week AS dw
            WHERE dw.week_id = ANY($1::text[])
        ),
        month_slots AS (
            SELECT
                sw.year,
                sw.month,
                MIN(sw.week_index) AS min_week_index,
                BOOL_OR(sw.is_forecast) AS is_forecast
            FROM selected_weeks AS sw
            GROUP BY sw.year, sw.month
        ),
        req AS (
            SELECT sw.year, sw.month, COALESCE(SUM(fr.requirement_qty), 0) AS total
            FROM dt_fact_requirements AS fr
            JOIN selected_weeks AS sw ON sw.week_id = fr.week_id
            WHERE ($2::text[] IS NULL OR fr.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fr.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fr.supplier_id = $4)
            GROUP BY sw.year, sw.month
        ),
        edi AS (
            SELECT sw.year, sw.month, COALESCE(SUM(fe.edi_qty), 0) AS total
            FROM dt_fact_edi_orders AS fe
            JOIN selected_weeks AS sw ON sw.week_id = fe.week_id
            WHERE ($2::text[] IS NULL OR fe.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fe.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fe.supplier_id = $4)
            GROUP BY sw.year, sw.month
        ),
        inv AS (
            SELECT sw.year, sw.month, COALESCE(SUM(fi.inventory_qty), 0) AS total
            FROM dt_fact_inventory AS fi
            JOIN selected_weeks AS sw ON sw.week_id = fi.week_id
            WHERE ($2::text[] IS NULL OR fi.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fi.factory_id = ANY($3::text[]))
              AND (
                $4::text IS NULL OR EXISTS (
                    SELECT 1
                    FROM dt_bridge_part_supplier AS bps
                    WHERE bps.part_id = fi.part_id
                      AND bps.supplier_id = $4
                )
              )
            GROUP BY sw.year, sw.month
        )
        SELECT
            month_slots.year::text || '-M' || LPAD(month_slots.month::text, 2, '0') AS week_id,
            'M' || LPAD(month_slots.month::text, 2, '0') AS week_label,
            COALESCE(req.total, 0)::float AS requirements,
            COALESCE(edi.total, 0)::float AS edi,
            COALESCE(inv.total, 0)::float AS inventory,
            month_slots.is_forecast
        FROM month_slots
        LEFT JOIN req ON req.year = month_slots.year AND req.month = month_slots.month
        LEFT JOIN edi ON edi.year = month_slots.year AND edi.month = month_slots.month
        LEFT JOIN inv ON inv.year = month_slots.year AND inv.month = month_slots.month
        ORDER BY month_slots.min_week_index ASC
        """,
        week_ids,
        part_ids,
        factory_ids,
        supplier_id
    )
