from __future__ import annotations

from collections import OrderedDict

import asyncpg

from app.models.schemas import FilterParams, GridCellValue, GridResponse, GridRow
from app.services.filter_helper import fetch_time_range_weeks, resolve_factory_ids, resolve_part_ids


async def get_grid_data(conn: asyncpg.Connection, filters: FilterParams) -> GridResponse:
    week_rows = await fetch_time_range_weeks(conn, filters.time_range, is_forecast=filters.is_forecast)
    weeks = [row['week_id'] for row in week_rows]
    week_labels = [f"W{int(row['week_number']):02d}" for row in week_rows]

    if not weeks:
        return GridResponse(weeks=[], week_labels=[], rows=[])

    part_ids = await resolve_part_ids(conn, filters)
    factory_ids = await resolve_factory_ids(conn, filters)

    if part_ids == [] or factory_ids == []:
        return GridResponse(weeks=weeks, week_labels=week_labels, rows=[])

    records = await conn.fetch(
        """
        WITH req AS (
            SELECT
                fr.part_id,
                fr.week_id,
                COALESCE(SUM(fr.requirement_qty), 0) AS requirement_qty
            FROM dt_fact_requirements AS fr
            WHERE fr.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fr.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fr.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fr.supplier_id = $4)
            GROUP BY fr.part_id, fr.week_id
        ),
        edi AS (
            SELECT
                fe.part_id,
                fe.week_id,
                COALESCE(SUM(fe.edi_qty), 0) AS edi_qty
            FROM dt_fact_edi_orders AS fe
            WHERE fe.week_id = ANY($1::text[])
              AND ($2::text[] IS NULL OR fe.part_id = ANY($2::text[]))
              AND ($3::text[] IS NULL OR fe.factory_id = ANY($3::text[]))
              AND ($4::text IS NULL OR fe.supplier_id = $4)
            GROUP BY fe.part_id, fe.week_id
        ),
        inv AS (
            SELECT
                fi.part_id,
                fi.week_id,
                COALESCE(SUM(fi.inventory_qty), 0) AS inventory_qty
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
            GROUP BY fi.part_id, fi.week_id
        ),
        merged AS (
            SELECT
                COALESCE(req.part_id, edi.part_id, inv.part_id) AS part_id,
                COALESCE(req.week_id, edi.week_id, inv.week_id) AS week_id,
                COALESCE(req.requirement_qty, 0) AS requirement_qty,
                COALESCE(edi.edi_qty, 0) AS edi_qty,
                COALESCE(inv.inventory_qty, 0) AS inventory_qty
            FROM req
            FULL OUTER JOIN edi
              ON req.part_id = edi.part_id
             AND req.week_id = edi.week_id
            FULL OUTER JOIN inv
              ON COALESCE(req.part_id, edi.part_id) = inv.part_id
             AND COALESCE(req.week_id, edi.week_id) = inv.week_id
        )
        SELECT
            m.part_id,
            dp.part_name,
            COALESCE(dp.part_category, 'Unknown') AS part_category,
            m.week_id,
            m.requirement_qty::float AS requirement_qty,
            m.edi_qty::float AS edi_qty,
            m.inventory_qty::float AS inventory_qty,
            dw.week_index
        FROM merged AS m
        JOIN dt_dim_part AS dp ON dp.part_id = m.part_id
        JOIN dt_dim_week AS dw ON dw.week_id = m.week_id
        WHERE m.week_id = ANY($1::text[])
        ORDER BY m.part_id ASC, dw.week_index ASC
        """,
        weeks,
        part_ids,
        factory_ids,
        filters.supplier_id
    )

    row_map: OrderedDict[str, GridRow] = OrderedDict()

    for record in records:
        part_id = record['part_id']
        if part_id not in row_map:
            row_map[part_id] = GridRow(
                part_id=part_id,
                part_name=record['part_name'],
                part_category=record['part_category'],
                values={}
            )

        row_map[part_id].values[record['week_id']] = GridCellValue(
            requirement_qty=float(record['requirement_qty']),
            edi_qty=float(record['edi_qty']),
            inventory_qty=float(record['inventory_qty'])
        )

    return GridResponse(weeks=weeks, week_labels=week_labels, rows=list(row_map.values()))
