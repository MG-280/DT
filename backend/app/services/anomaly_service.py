from __future__ import annotations

import asyncpg

from app.models.schemas import AnomalyItem, FilterParams
from app.services.filter_helper import resolve_factory_ids, resolve_part_ids


async def get_anomalies(conn: asyncpg.Connection, filters: FilterParams) -> list[AnomalyItem]:
    part_ids = await resolve_part_ids(conn, filters)
    factory_ids = await resolve_factory_ids(conn, filters)

    if part_ids == [] or factory_ids == []:
        return []

    scoped_part_ids = await _resolve_anomaly_part_ids(conn, part_ids, factory_ids, filters.supplier_id)
    if scoped_part_ids == []:
        return []

    rows = await conn.fetch(
        """
        SELECT
            fa.part_id,
            dp.part_name,
            fa.week_id,
            'W' || LPAD(dw.week_number::text, 2, '0') AS week_label,
            CASE
                WHEN LOWER(fa.metric_type) IN ('demand', 'requirement', 'requirements') THEN 'requirements'
                WHEN LOWER(fa.metric_type) = 'edi' THEN 'edi'
                ELSE 'inventory'
            END AS metric_type,
            fa.reason_code,
            fa.expected_value::float AS expected_value,
            fa.actual_value::float AS actual_value,
            CASE
                WHEN fa.expected_value = 0 THEN 0
                ELSE ROUND((((fa.actual_value - fa.expected_value) / fa.expected_value) * 100)::numeric, 2)
            END::float AS pct_diff,
            fa.anomaly_flag,
            CASE
                WHEN ABS(
                    CASE
                        WHEN fa.expected_value = 0 THEN 0
                        ELSE ((fa.actual_value - fa.expected_value) / fa.expected_value) * 100
                    END
                ) > 35 THEN 'critical'
                ELSE 'warning'
            END AS severity
        FROM dt_fact_anomalies AS fa
        JOIN dt_dim_part AS dp ON dp.part_id = fa.part_id
        JOIN dt_dim_week AS dw ON dw.week_id = fa.week_id
        WHERE ($1::text[] IS NULL OR fa.part_id = ANY($1::text[]))
        ORDER BY dw.week_index DESC, fa.part_id ASC
        """,
        scoped_part_ids
    )

    return [AnomalyItem(**dict(row)) for row in rows]


async def _resolve_anomaly_part_ids(
    conn: asyncpg.Connection,
    part_ids: list[str] | None,
    factory_ids: list[str] | None,
    supplier_id: str | None
) -> list[str] | None:
    if factory_ids is None and supplier_id is None:
        return part_ids

    rows = await conn.fetch(
        """
        WITH candidate_parts AS (
            SELECT DISTINCT fr.part_id
            FROM dt_fact_requirements AS fr
            WHERE ($1::text[] IS NULL OR fr.part_id = ANY($1::text[]))
              AND ($2::text[] IS NULL OR fr.factory_id = ANY($2::text[]))
              AND ($3::text IS NULL OR fr.supplier_id = $3)
            UNION
            SELECT DISTINCT fe.part_id
            FROM dt_fact_edi_orders AS fe
            WHERE ($1::text[] IS NULL OR fe.part_id = ANY($1::text[]))
              AND ($2::text[] IS NULL OR fe.factory_id = ANY($2::text[]))
              AND ($3::text IS NULL OR fe.supplier_id = $3)
            UNION
            SELECT DISTINCT fi.part_id
            FROM dt_fact_inventory AS fi
            WHERE ($1::text[] IS NULL OR fi.part_id = ANY($1::text[]))
              AND ($2::text[] IS NULL OR fi.factory_id = ANY($2::text[]))
              AND (
                $3::text IS NULL OR EXISTS (
                    SELECT 1
                    FROM dt_bridge_part_supplier AS bps
                    WHERE bps.part_id = fi.part_id
                      AND bps.supplier_id = $3
                )
              )
        )
        SELECT cp.part_id
        FROM candidate_parts AS cp
        ORDER BY cp.part_id
        """,
        part_ids,
        factory_ids,
        supplier_id
    )
    return [row['part_id'] for row in rows]
