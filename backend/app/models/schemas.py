from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FilterParams(BaseModel):
    product_id: str | None = None
    assembly_id: str | None = None
    part_id: str | None = None
    supplier_id: str | None = None
    factory_id: str | None = None
    location_id: str | None = None
    time_range: Literal['12w', '6m', '1y', 'all', 'custom'] = '12w'
    granularity: Literal['weekly', 'monthly'] = 'weekly'
    is_forecast: bool = False

    @field_validator('time_range', mode='before')
    @classmethod
    def normalize_time_range(cls, value: str) -> str:
        if value == 'custom':
            return 'all'
        return value


class KpiResponse(BaseModel):
    requirements_total: float
    edi_total: float
    inventory_current: float
    req_trend_pct: float
    edi_trend_pct: float
    inv_trend_pct: float


class TimeSeriesPoint(BaseModel):
    week_id: str
    week_label: str
    requirements: float
    edi: float
    inventory: float
    is_forecast: bool


class DailyPoint(BaseModel):
    day_id: str
    day_label: str
    requirements: float
    edi: float
    inventory: float


class AnomalyItem(BaseModel):
    part_id: str
    part_name: str
    week_id: str
    week_label: str
    metric_type: str
    reason_code: str
    expected_value: float
    actual_value: float
    pct_diff: float
    anomaly_flag: bool
    severity: str


class PartNode(BaseModel):
    part_id: str
    part_name: str
    part_category: str = Field(default='Unknown')


class AssemblyNode(BaseModel):
    assembly_id: str
    assembly_name: str
    parts: list[PartNode]


class ProductNode(BaseModel):
    product_id: str
    product_name: str
    assemblies: list[AssemblyNode]


class HierarchyResponse(BaseModel):
    products: list[ProductNode]


class SupplierNode(BaseModel):
    supplier_id: str
    supplier_name: str


class HierarchyNetworkLink(BaseModel):
    source_id: str
    source_type: Literal['supplier', 'part', 'assembly']
    target_id: str
    target_type: Literal['part', 'assembly', 'product']


class HierarchyNetworkResponse(BaseModel):
    suppliers: list[SupplierNode]
    parts: list[PartNode]
    assemblies: list[AssemblyNode]
    products: list[ProductNode]
    links: list[HierarchyNetworkLink]


class GridCellValue(BaseModel):
    requirement_qty: float
    edi_qty: float
    inventory_qty: float


class GridRow(BaseModel):
    part_id: str
    part_name: str
    part_category: str
    values: dict[str, GridCellValue]


class GridResponse(BaseModel):
    weeks: list[str]
    week_labels: list[str]
    rows: list[GridRow]


# --- Impact Analysis ---

class AnomalyDetail(BaseModel):
    part_id: str
    part_name: str
    part_category: str
    week_id: str
    week_label: str
    metric_type: str
    reason_code: str
    expected_value: float
    actual_value: float
    pct_diff: float
    severity: str


class ImpactProduct(BaseModel):
    product_id: str
    product_name: str


class ImpactChainItem(BaseModel):
    assembly_id: str
    assembly_name: str
    products: list[ImpactProduct]


class ImpactSiblingPart(BaseModel):
    part_id: str
    part_name: str
    part_category: str
    assembly_id: str
    assembly_name: str
    requirement_qty: float
    edi_qty: float
    inventory_qty: float
    has_anomaly: bool


class ImpactTrendPoint(BaseModel):
    week_id: str
    week_label: str
    requirements: float
    edi: float
    inventory: float
    is_anomaly_week: bool


class ImpactAnalysisResponse(BaseModel):
    anomaly: AnomalyDetail
    impact_chain: list[ImpactChainItem]
    sibling_parts: list[ImpactSiblingPart]
    trend: list[ImpactTrendPoint]
    ai_summary: str
