from __future__ import annotations

import os

import asyncpg

from app.models.schemas import (
    AnomalyDetail,
    ImpactAnalysisResponse,
    ImpactChainItem,
    ImpactProduct,
    ImpactSiblingPart,
    ImpactTrendPoint,
)


async def get_impact_analysis(
    conn: asyncpg.Connection, part_id: str, week_id: str
) -> ImpactAnalysisResponse | None:
    """Assemble the full impact analysis for a given anomalous part and week."""

    # --- Query 1: anomaly + part info ---
    anomaly_row = await conn.fetchrow(
        """
        SELECT
            a.part_id, p.part_name, p.part_category,
            a.week_id, w.week_number,
            a.metric_type, a.reason_code,
            a.expected_value, a.actual_value, a.anomaly_flag
        FROM dt_fact_anomalies a
        JOIN dt_dim_part p ON p.part_id = a.part_id
        JOIN dt_dim_week w ON w.week_id = a.week_id
        WHERE a.part_id = $1 AND a.week_id = $2
        """,
        part_id,
        week_id,
    )

    if anomaly_row is None:
        return None

    expected = float(anomaly_row['expected_value'])
    actual = float(anomaly_row['actual_value'])
    pct_diff = ((actual - expected) / expected * 100) if expected != 0 else 0.0
    severity = 'critical' if abs(pct_diff) > 35 else 'warning'
    week_label = f"W{int(anomaly_row['week_number']):02d}"

    anomaly = AnomalyDetail(
        part_id=anomaly_row['part_id'],
        part_name=anomaly_row['part_name'],
        part_category=anomaly_row['part_category'],
        week_id=anomaly_row['week_id'],
        week_label=week_label,
        metric_type=anomaly_row['metric_type'],
        reason_code=anomaly_row['reason_code'],
        expected_value=expected,
        actual_value=actual,
        pct_diff=round(pct_diff, 1),
        severity=severity,
    )

    # --- Query 2: impact chain (assemblies → products) ---
    chain_rows = await conn.fetch(
        """
        SELECT
            bpa.assembly_id, asm.assembly_name,
            bap.product_id, prod.product_name
        FROM dt_bridge_part_assembly bpa
        JOIN dt_dim_assembly asm ON asm.assembly_id = bpa.assembly_id
        JOIN dt_bridge_assembly_product bap ON bap.assembly_id = bpa.assembly_id
        JOIN dt_dim_product prod ON prod.product_id = bap.product_id
        WHERE bpa.part_id = $1
        ORDER BY bpa.assembly_id, bap.product_id
        """,
        part_id,
    )

    assembly_map: dict[str, ImpactChainItem] = {}
    for row in chain_rows:
        asm_id = row['assembly_id']
        if asm_id not in assembly_map:
            assembly_map[asm_id] = ImpactChainItem(
                assembly_id=asm_id,
                assembly_name=row['assembly_name'],
                products=[],
            )
        assembly_map[asm_id].products.append(
            ImpactProduct(
                product_id=row['product_id'],
                product_name=row['product_name'],
            )
        )
    impact_chain = list(assembly_map.values())

    # --- Query 3: sibling parts with metrics for the anomaly week ---
    sibling_rows = await conn.fetch(
        """
        SELECT
            p.part_id, p.part_name, p.part_category,
            bpa.assembly_id, asm.assembly_name,
            COALESCE(SUM(r.requirement_qty), 0) AS requirement_qty,
            COALESCE(SUM(e.edi_qty), 0) AS edi_qty,
            COALESCE(SUM(i.inventory_qty), 0) AS inventory_qty,
            EXISTS (
                SELECT 1 FROM dt_fact_anomalies sa
                WHERE sa.part_id = p.part_id AND sa.week_id = $2
            ) AS has_anomaly
        FROM dt_bridge_part_assembly bpa
        JOIN dt_dim_part p ON p.part_id = bpa.part_id
        JOIN dt_dim_assembly asm ON asm.assembly_id = bpa.assembly_id
        LEFT JOIN dt_fact_requirements r
            ON r.part_id = p.part_id AND r.week_id = $2
        LEFT JOIN dt_fact_edi_orders e
            ON e.part_id = p.part_id AND e.week_id = $2
        LEFT JOIN dt_fact_inventory i
            ON i.part_id = p.part_id AND i.week_id = $2
        WHERE bpa.assembly_id IN (
            SELECT assembly_id FROM dt_bridge_part_assembly WHERE part_id = $1
        )
        AND bpa.part_id != $1
        GROUP BY p.part_id, p.part_name, p.part_category,
                 bpa.assembly_id, asm.assembly_name
        ORDER BY p.part_id
        """,
        part_id,
        week_id,
    )

    sibling_parts = [
        ImpactSiblingPart(
            part_id=row['part_id'],
            part_name=row['part_name'],
            part_category=row['part_category'],
            assembly_id=row['assembly_id'],
            assembly_name=row['assembly_name'],
            requirement_qty=float(row['requirement_qty']),
            edi_qty=float(row['edi_qty']),
            inventory_qty=float(row['inventory_qty']),
            has_anomaly=bool(row['has_anomaly']),
        )
        for row in sibling_rows
    ]

    # --- Query 4: trend data ±4 weeks around anomaly week ---
    trend_rows = await conn.fetch(
        """
        WITH anomaly_week AS (
            SELECT week_index FROM dt_dim_week WHERE week_id = $2
        )
        SELECT
            w.week_id, w.week_number,
            COALESCE(SUM(r.requirement_qty), 0) AS requirements,
            COALESCE(SUM(e.edi_qty), 0) AS edi,
            COALESCE(SUM(i.inventory_qty), 0) AS inventory
        FROM dt_dim_week w
        CROSS JOIN anomaly_week aw
        LEFT JOIN dt_fact_requirements r
            ON r.part_id = $1 AND r.week_id = w.week_id
        LEFT JOIN dt_fact_edi_orders e
            ON e.part_id = $1 AND e.week_id = w.week_id
        LEFT JOIN dt_fact_inventory i
            ON i.part_id = $1 AND i.week_id = w.week_id
        WHERE w.week_index BETWEEN aw.week_index - 4 AND aw.week_index + 4
        GROUP BY w.week_id, w.week_number, w.week_index
        ORDER BY w.week_index
        """,
        part_id,
        week_id,
    )

    trend = [
        ImpactTrendPoint(
            week_id=row['week_id'],
            week_label=f"W{int(row['week_number']):02d}",
            requirements=float(row['requirements']),
            edi=float(row['edi']),
            inventory=float(row['inventory']),
            is_anomaly_week=(row['week_id'] == week_id),
        )
        for row in trend_rows
    ]

    # --- AI summary ---
    ai_summary = await _generate_ai_summary(anomaly, impact_chain, sibling_parts)

    return ImpactAnalysisResponse(
        anomaly=anomaly,
        impact_chain=impact_chain,
        sibling_parts=sibling_parts,
        trend=trend,
        ai_summary=ai_summary,
    )


async def _generate_ai_summary(
    anomaly: AnomalyDetail,
    impact_chain: list[ImpactChainItem],
    sibling_parts: list[ImpactSiblingPart],
) -> str:
    """Call OpenAI to generate a one-paragraph plain-English summary.
    Returns an empty string on any failure so the endpoint is never broken."""
    try:
        from openai import AsyncOpenAI  # imported lazily to avoid hard crash if not installed

        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return ''

        client = AsyncOpenAI(api_key=api_key)

        assembly_names = ', '.join(c.assembly_name for c in impact_chain)
        product_names = ', '.join(
            {p.product_name for c in impact_chain for p in c.products}
        )
        sibling_count = len(sibling_parts)
        flagged_count = sum(1 for s in sibling_parts if s.has_anomaly)

        system_prompt = (
            'You are a supply chain analyst assistant for a manufacturing company. '
            'You write concise, professional one-paragraph summaries of supply chain anomalies. '
            'Your audience is a non-technical JD (John Deere) planning manager. '
            'Focus on: what happened, which products are affected, and what the planner should watch. '
            'Do not use bullet points. Do not use technical jargon. Write exactly one paragraph. '
            'Keep it under 80 words.'
        )

        user_prompt = (
            f'Anomaly detected for {anomaly.part_name} ({anomaly.part_category}) in {anomaly.week_label}.\n'
            f'Metric affected: {anomaly.metric_type}.\n'
            f'Reason: {anomaly.reason_code}.\n'
            f'Expected value: {anomaly.expected_value}, Actual value: {anomaly.actual_value} ({anomaly.pct_diff:+.1f}%).\n'
            f'Severity: {anomaly.severity}.\n'
            f'Affected assemblies: {assembly_names}.\n'
            f'Affected products: {product_names}.\n'
            f'Number of sibling parts in same assembly: {sibling_count}.\n'
            f'Sibling parts also flagged with anomalies this week: {flagged_count}.\n'
            'Write a one-paragraph summary a supply chain planner would find immediately useful.'
        )

        response = await client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
            max_tokens=150,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    except Exception:  # noqa: BLE001
        return ''
