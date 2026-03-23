from __future__ import annotations

from collections import OrderedDict

import asyncpg

from app.models.schemas import (
    AssemblyNode,
    HierarchyNetworkLink,
    HierarchyNetworkResponse,
    HierarchyResponse,
    PartNode,
    ProductNode,
    SupplierNode,
)


async def get_hierarchy(conn: asyncpg.Connection) -> HierarchyResponse:
    rows = await conn.fetch(
        """
        SELECT
            p.product_id,
            p.product_name,
            a.assembly_id,
            a.assembly_name,
            part.part_id,
            part.part_name,
            part.part_category
        FROM dt_dim_product AS p
        JOIN dt_bridge_assembly_product AS bap ON bap.product_id = p.product_id
        JOIN dt_dim_assembly AS a ON a.assembly_id = bap.assembly_id
        JOIN dt_bridge_part_assembly AS bpa ON bpa.assembly_id = a.assembly_id
        JOIN dt_dim_part AS part ON part.part_id = bpa.part_id
        ORDER BY p.product_name ASC, a.assembly_name ASC, part.part_name ASC
        """
    )

    product_map: OrderedDict[str, dict] = OrderedDict()

    for row in rows:
        product = product_map.setdefault(
            row['product_id'],
            {
                'product_id': row['product_id'],
                'product_name': row['product_name'],
                'assemblies': OrderedDict()
            }
        )
        assemblies = product['assemblies']
        assembly = assemblies.setdefault(
            row['assembly_id'],
            {
                'assembly_id': row['assembly_id'],
                'assembly_name': row['assembly_name'],
                'parts': []
            }
        )
        assembly['parts'].append(
            PartNode(
                part_id=row['part_id'],
                part_name=row['part_name'],
                part_category=row['part_category'] or 'Unknown'
            )
        )

    products = [
        ProductNode(
            product_id=product['product_id'],
            product_name=product['product_name'],
            assemblies=[
                AssemblyNode(
                    assembly_id=assembly['assembly_id'],
                    assembly_name=assembly['assembly_name'],
                    parts=assembly['parts']
                )
                for assembly in product['assemblies'].values()
            ]
        )
        for product in product_map.values()
    ]

    return HierarchyResponse(products=products)


async def get_hierarchy_network(conn: asyncpg.Connection) -> HierarchyNetworkResponse:
    rows = await conn.fetch(
        """
        SELECT
            supp.supplier_id,
            supp.supplier_name,
            part.part_id,
            part.part_name,
            COALESCE(part.part_category, 'Unknown') AS part_category,
            asm.assembly_id,
            asm.assembly_name,
            prod.product_id,
            prod.product_name
        FROM dt_bridge_part_supplier AS bps
        JOIN dt_dim_supplier AS supp ON supp.supplier_id = bps.supplier_id
        JOIN dt_dim_part AS part ON part.part_id = bps.part_id
        JOIN dt_bridge_part_assembly AS bpa ON bpa.part_id = part.part_id
        JOIN dt_dim_assembly AS asm ON asm.assembly_id = bpa.assembly_id
        JOIN dt_bridge_assembly_product AS bap ON bap.assembly_id = asm.assembly_id
        JOIN dt_dim_product AS prod ON prod.product_id = bap.product_id
        ORDER BY supp.supplier_name ASC, part.part_name ASC, asm.assembly_name ASC, prod.product_name ASC
        """
    )

    supplier_map: OrderedDict[str, SupplierNode] = OrderedDict()
    part_map: OrderedDict[str, PartNode] = OrderedDict()
    assembly_map: OrderedDict[str, dict] = OrderedDict()
    product_map: OrderedDict[str, dict] = OrderedDict()

    link_keys: set[tuple[str, str, str, str]] = set()
    links: list[HierarchyNetworkLink] = []

    for row in rows:
        supplier_map.setdefault(
            row['supplier_id'],
            SupplierNode(supplier_id=row['supplier_id'], supplier_name=row['supplier_name']),
        )
        part_map.setdefault(
            row['part_id'],
            PartNode(part_id=row['part_id'], part_name=row['part_name'], part_category=row['part_category']),
        )

        assembly_entry = assembly_map.setdefault(
            row['assembly_id'],
            {'assembly_id': row['assembly_id'], 'assembly_name': row['assembly_name'], 'parts': OrderedDict()},
        )
        assembly_entry['parts'].setdefault(row['part_id'], part_map[row['part_id']])

        product_entry = product_map.setdefault(
            row['product_id'],
            {'product_id': row['product_id'], 'product_name': row['product_name'], 'assemblies': OrderedDict()},
        )
        product_entry['assemblies'].setdefault(row['assembly_id'], assembly_entry)

        supplier_part_key = (row['supplier_id'], 'supplier', row['part_id'], 'part')
        if supplier_part_key not in link_keys:
            links.append(
                HierarchyNetworkLink(
                    source_id=row['supplier_id'],
                    source_type='supplier',
                    target_id=row['part_id'],
                    target_type='part',
                )
            )
            link_keys.add(supplier_part_key)

        part_assembly_key = (row['part_id'], 'part', row['assembly_id'], 'assembly')
        if part_assembly_key not in link_keys:
            links.append(
                HierarchyNetworkLink(
                    source_id=row['part_id'],
                    source_type='part',
                    target_id=row['assembly_id'],
                    target_type='assembly',
                )
            )
            link_keys.add(part_assembly_key)

        assembly_product_key = (row['assembly_id'], 'assembly', row['product_id'], 'product')
        if assembly_product_key not in link_keys:
            links.append(
                HierarchyNetworkLink(
                    source_id=row['assembly_id'],
                    source_type='assembly',
                    target_id=row['product_id'],
                    target_type='product',
                )
            )
            link_keys.add(assembly_product_key)

    assemblies = [
        AssemblyNode(
            assembly_id=entry['assembly_id'],
            assembly_name=entry['assembly_name'],
            parts=list(entry['parts'].values()),
        )
        for entry in assembly_map.values()
    ]
    products = [
        ProductNode(
            product_id=entry['product_id'],
            product_name=entry['product_name'],
            assemblies=[
                AssemblyNode(
                    assembly_id=assembly['assembly_id'],
                    assembly_name=assembly['assembly_name'],
                    parts=list(assembly['parts'].values()),
                )
                for assembly in entry['assemblies'].values()
            ],
        )
        for entry in product_map.values()
    ]

    return HierarchyNetworkResponse(
        suppliers=list(supplier_map.values()),
        parts=list(part_map.values()),
        assemblies=assemblies,
        products=products,
        links=links,
    )
