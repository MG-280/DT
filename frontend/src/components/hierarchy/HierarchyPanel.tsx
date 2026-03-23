import { useMemo, useState } from 'react';
import { useHierarchy, useHierarchyNetwork } from '../../hooks/useDashboardData';
import { useFilters } from '../../context/FilterContext';
import type { Assembly, Filter, HierarchyNetworkLink, Part, Product, SupplierNode } from '../../types';
import Panel from '../shared/Panel';
import { isSelected, toggleSelection } from '../../utils/helpers';

type NetworkNodeType = 'supplier' | 'part' | 'assembly' | 'product';
type HierarchyLevel = 'product' | 'assembly' | 'part';
type HierarchySelection = Pick<Filter, 'product_id' | 'assembly_id' | 'part_id'>;

interface GraphNode {
  id: string;
  name: string;
  type: NetworkNodeType;
  subtitle?: string;
  y: number;
}

const columnOrder: NetworkNodeType[] = ['supplier', 'part', 'assembly', 'product'];
const columnColor: Record<NetworkNodeType, string> = {
  supplier: 'var(--anomaly-warning)',
  part: 'var(--chart-req)',
  assembly: '#26c6da',
  product: 'var(--chart-inv)'
};
const columnX: Record<NetworkNodeType, number> = {
  supplier: 110,
  part: 360,
  assembly: 610,
  product: 860
};

const emptyHierarchySelection = (): HierarchySelection => ({
  product_id: [],
  assembly_id: [],
  part_id: []
});

const getSelectionLevel = (selection: HierarchySelection): HierarchyLevel | null => {
  if (selection.part_id.length > 0) {
    return 'part';
  }
  if (selection.assembly_id.length > 0) {
    return 'assembly';
  }
  if (selection.product_id.length > 0) {
    return 'product';
  }
  return null;
};

const getSelectionCount = (selection: HierarchySelection): number => {
  const level = getSelectionLevel(selection);
  if (level === 'part') {
    return selection.part_id.length;
  }
  if (level === 'assembly') {
    return selection.assembly_id.length;
  }
  if (level === 'product') {
    return selection.product_id.length;
  }
  return 0;
};

const toggleHierarchyLevel = (selection: HierarchySelection, level: HierarchyLevel, id: string): HierarchySelection => {
  if (level === 'product') {
    return {
      product_id: toggleSelection(selection.product_id, id),
      assembly_id: [],
      part_id: []
    };
  }

  if (level === 'assembly') {
    return {
      product_id: [],
      assembly_id: toggleSelection(selection.assembly_id, id),
      part_id: []
    };
  }

  return {
    product_id: [],
    assembly_id: [],
    part_id: toggleSelection(selection.part_id, id)
  };
};

const buildHighlightedKeys = (
  selection: HierarchySelection,
  adjacency: Map<string, Set<string>>
): Set<string> | null => {
  const activeSeeds = [
    ...selection.product_id.map((id) => `product:${id}`),
    ...selection.assembly_id.map((id) => `assembly:${id}`),
    ...selection.part_id.map((id) => `part:${id}`)
  ];

  if (activeSeeds.length === 0) {
    return null;
  }

  const visited = new Set<string>();
  const queue = [...activeSeeds];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const next = adjacency.get(current);
    if (!next) {
      continue;
    }

    for (const key of next) {
      if (!visited.has(key)) {
        queue.push(key);
      }
    }
  }

  return visited;
};

const ProductTree = ({
  product,
  activeProducts,
  activeAssemblies,
  activeParts,
  onProductToggle,
  onAssemblyToggle,
  onPartToggle
}: {
  product: Product;
  activeProducts: string[];
  activeAssemblies: string[];
  activeParts: string[];
  onProductToggle: (productId: string) => void;
  onAssemblyToggle: (assemblyId: string) => void;
  onPartToggle: (partId: string) => void;
}) => {
  const [expandedProduct, setExpandedProduct] = useState(isSelected(activeProducts, product.product_id));
  const [expandedAssemblies, setExpandedAssemblies] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded-[22px] border border-app-border bg-dt-panel px-4 py-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <label className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected(activeProducts, product.product_id)}
            onChange={() => onProductToggle(product.product_id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-app-border bg-transparent accent-req"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-app-text">{product.product_name}</span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-app-muted">
              {product.product_id} • {product.assemblies.length} assemblies
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => setExpandedProduct((current) => !current)}
          className="rounded-lg border border-app-border bg-dt-elevated px-2.5 py-1 text-xs text-app-soft transition hover:border-req hover:text-app-text"
          aria-label={expandedProduct ? 'Collapse product' : 'Expand product'}
        >
          {expandedProduct ? 'Hide' : 'Show'}
        </button>
      </div>

      {expandedProduct ? (
        <div className="ml-[9px] mt-4 space-y-3 border-l border-app-border/80 pl-5">
          {product.assemblies.map((assembly) => {
            const expanded = expandedAssemblies[assembly.assembly_id] ?? isSelected(activeAssemblies, assembly.assembly_id);

            return (
              <div key={assembly.assembly_id} className="rounded-2xl border border-app-border/70 bg-dt-elevated px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected(activeAssemblies, assembly.assembly_id)}
                      onChange={() => onAssemblyToggle(assembly.assembly_id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-app-border bg-transparent accent-req"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-app-text">{assembly.assembly_name}</span>
                      <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-app-muted">
                        {assembly.assembly_id} • {assembly.parts.length} parts
                      </span>
                    </span>
                  </label>

                  <button
                    type="button"
                    className="rounded-full border border-app-border bg-dt-panel px-2.5 py-1 text-[11px] text-app-muted transition hover:border-req hover:text-app-text"
                    onClick={() => setExpandedAssemblies((current) => ({
                      ...current,
                      [assembly.assembly_id]: !expanded
                    }))}
                  >
                    {expanded ? 'Hide parts' : 'View parts'}
                  </button>
                </div>

                {expanded ? (
                  <div className="ml-[9px] mt-3 space-y-2 border-l border-app-border/70 pl-5">
                    {assembly.parts.map((part) => (
                      <label key={part.part_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-dt-panel-hover">
                        <input
                          type="checkbox"
                          checked={isSelected(activeParts, part.part_id)}
                          onChange={() => onPartToggle(part.part_id)}
                          className="h-4 w-4 rounded border-app-border bg-transparent accent-req"
                        />
                        <span className="min-w-0 truncate text-sm text-app-soft">{part.part_name}</span>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-app-muted">{part.part_id}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const NetworkSelectionDialog = ({
  graph,
  selection,
  onToggleNode,
  onClose,
  onApply
}: {
  graph: {
    nodesByType: Record<NetworkNodeType, GraphNode[]>;
    links: HierarchyNetworkLink[];
    adjacency: Map<string, Set<string>>;
    height: number;
  };
  selection: HierarchySelection;
  onToggleNode: (nodeType: NetworkNodeType, id: string) => void;
  onClose: () => void;
  onApply: () => void;
}) => {
  const [hovered, setHovered] = useState<{ x: number; y: number; title: string; subtitle?: string } | null>(null);

  const highlightedKeys = useMemo(() => buildHighlightedKeys(selection, graph.adjacency), [selection, graph.adjacency]);
  const selectionLevel = getSelectionLevel(selection);
  const selectionCount = getSelectionCount(selection);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="panel relative flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[28px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-dt-panel text-app-muted transition hover:border-req hover:bg-dt-panel-hover hover:text-app-text"
          aria-label="Close network selector"
        >
          X
        </button>

        <div className="border-b border-app-border px-6 py-5">
          <div className="text-lg font-semibold text-app-text">Network Selector</div>
          <div className="mt-1 text-sm text-app-muted">
            Select multiple products, assemblies, or parts. Switching levels clears the previous level so filters stay unambiguous.
          </div>
          <div className="mt-3 inline-flex rounded-full border border-app-border bg-dt-elevated px-3 py-1.5 text-xs font-medium text-app-soft">
            {selectionLevel ? `${selectionCount} ${selectionLevel}${selectionCount === 1 ? '' : 's'} selected` : 'No hierarchy selection yet'}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden p-6">
          <div className="relative h-full overflow-auto rounded-[22px] border border-app-border bg-dt-sunken p-3">
            <svg width={960} height={graph.height} viewBox={`0 0 960 ${graph.height}`}>
              {columnOrder.map((type) => (
                <text
                  key={`title-${type}`}
                  x={columnX[type]}
                  y={18}
                  textAnchor="middle"
                  fill={columnColor[type]}
                  fontSize={11}
                  fontWeight={700}
                  style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  {type === 'supplier' ? 'Suppliers' : type === 'part' ? 'Parts' : type === 'assembly' ? 'Assemblies' : 'Products'}
                </text>
              ))}

              {graph.links.map((link) => {
                const source = graph.nodesByType[link.source_type].find((node) => node.id === link.source_id);
                const target = graph.nodesByType[link.target_type].find((node) => node.id === link.target_id);
                if (!source || !target) {
                  return null;
                }

                const sourceKey = `${source.type}:${source.id}`;
                const targetKey = `${target.type}:${target.id}`;
                const highlighted = !highlightedKeys || (highlightedKeys.has(sourceKey) && highlightedKeys.has(targetKey));

                return (
                  <line
                    key={`link-${sourceKey}-${targetKey}`}
                    x1={columnX[source.type] + 60}
                    y1={source.y + 38}
                    x2={columnX[target.type] - 60}
                    y2={target.y + 38}
                    stroke="var(--border-subtle)"
                    strokeWidth={0.5}
                    opacity={highlighted ? 0.85 : 0.12}
                  />
                );
              })}

              {columnOrder.flatMap((type) => graph.nodesByType[type].map((node) => {
                const nodeKey = `${node.type}:${node.id}`;
                const highlighted = !highlightedKeys || highlightedKeys.has(nodeKey);
                const selectable = node.type !== 'supplier';
                const selected = node.type === 'product'
                  ? isSelected(selection.product_id, node.id)
                  : node.type === 'assembly'
                    ? isSelected(selection.assembly_id, node.id)
                    : node.type === 'part'
                      ? isSelected(selection.part_id, node.id)
                      : false;

                return (
                  <g
                    key={nodeKey}
                    transform={`translate(${columnX[node.type] - 54}, ${node.y + 24})`}
                    opacity={highlighted ? 1 : 0.2}
                    style={{ cursor: selectable ? 'pointer' : 'default' }}
                    onMouseEnter={(event) => {
                      const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      setHovered({
                        x: event.clientX - rect.left + 12,
                        y: event.clientY - rect.top + 12,
                        title: node.name,
                        subtitle: node.type === 'part' ? node.subtitle : node.id
                      });
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      if (!selectable) {
                        return;
                      }
                      onToggleNode(node.type, node.id);
                    }}
                  >
                    <rect
                      width={108}
                      height={28}
                      rx={7}
                      fill={selected ? `${columnColor[node.type]}38` : `${columnColor[node.type]}22`}
                      stroke={columnColor[node.type]}
                      strokeWidth={selected ? 2 : 1}
                    />
                    <text x={54} y={18} textAnchor="middle" fill="var(--text-primary)" fontSize={10} fontWeight={selected ? 700 : 500}>
                      {node.name.length > 16 ? `${node.name.slice(0, 16)}...` : node.name}
                    </text>
                  </g>
                );
              }))}
            </svg>

            {hovered ? (
              <div
                className="pointer-events-none absolute z-10 rounded-xl border border-app-border bg-dt-panel px-3 py-2 text-xs shadow-xl"
                style={{ left: hovered.x, top: hovered.y }}
              >
                <div className="font-semibold text-app-text">{hovered.title}</div>
                {hovered.subtitle ? <div className="mt-1 text-app-soft">{hovered.subtitle}</div> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-app-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-app-border bg-dt-panel px-4 py-2 text-sm font-medium text-app-soft transition hover:border-req hover:text-app-text"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleNode('product', '__clear__')}
              className="rounded-full border border-app-border bg-dt-panel px-4 py-2 text-sm font-medium text-app-soft transition hover:border-req hover:text-app-text"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={onApply}
              className="rounded-full border border-req bg-dt-panel-hover px-4 py-2 text-sm font-medium text-app-text shadow-glow transition hover:opacity-90"
            >
              Apply selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HierarchyPanel = () => {
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false);
  const [stagedSelection, setStagedSelection] = useState<HierarchySelection>(emptyHierarchySelection);
  const { data } = useHierarchy();
  const { data: networkData } = useHierarchyNetwork();
  const { filters, setFilters, clearHierarchyFilters } = useFilters();

  const products = data?.products ?? [];

  const graph = useMemo(() => {
    const suppliers: SupplierNode[] = networkData?.suppliers ?? [];
    const parts: Part[] = networkData?.parts ?? [];
    const assemblies: Assembly[] = networkData?.assemblies ?? [];
    const graphProducts: Product[] = networkData?.products ?? [];
    const links: HierarchyNetworkLink[] = networkData?.links ?? [];

    const toNodes = <T extends { [K in Id]: string } & { [K in Name]: string }, Id extends keyof T, Name extends keyof T>(
      items: T[],
      idKey: Id,
      nameKey: Name,
      type: NetworkNodeType,
      subtitleOf?: (item: T) => string | undefined
    ): GraphNode[] => items.map((item, index) => ({
      id: String(item[idKey]),
      name: String(item[nameKey]),
      type,
      subtitle: subtitleOf?.(item),
      y: index * 42
    }));

    const supplierNodes = toNodes(suppliers, 'supplier_id', 'supplier_name', 'supplier');
    const partNodes = toNodes(parts, 'part_id', 'part_name', 'part', (item) => item.part_category ?? 'Unknown');
    const assemblyNodes = toNodes(assemblies, 'assembly_id', 'assembly_name', 'assembly');
    const productNodes = toNodes(graphProducts, 'product_id', 'product_name', 'product');

    const nodesByType = {
      supplier: supplierNodes,
      part: partNodes,
      assembly: assemblyNodes,
      product: productNodes
    };

    const nodeIdSet = new Set(
      [...supplierNodes, ...partNodes, ...assemblyNodes, ...productNodes].map((node) => `${node.type}:${node.id}`)
    );

    const cleanLinks = links.filter((link) => (
      nodeIdSet.has(`${link.source_type}:${link.source_id}`) && nodeIdSet.has(`${link.target_type}:${link.target_id}`)
    ));

    const adjacency = new Map<string, Set<string>>();
    for (const link of cleanLinks) {
      const sourceKey = `${link.source_type}:${link.source_id}`;
      const targetKey = `${link.target_type}:${link.target_id}`;
      if (!adjacency.has(sourceKey)) adjacency.set(sourceKey, new Set());
      if (!adjacency.has(targetKey)) adjacency.set(targetKey, new Set());
      adjacency.get(sourceKey)?.add(targetKey);
      adjacency.get(targetKey)?.add(sourceKey);
    }

    return {
      nodesByType,
      links: cleanLinks,
      adjacency,
      height: Math.max(
        supplierNodes.length,
        partNodes.length,
        assemblyNodes.length,
        productNodes.length,
        8
      ) * 42 + 40
    };
  }, [networkData]);

  const openNetworkDialog = () => {
    setStagedSelection({
      product_id: [...filters.product_id],
      assembly_id: [...filters.assembly_id],
      part_id: [...filters.part_id]
    });
    setIsNetworkDialogOpen(true);
  };

  const applyNetworkSelection = () => {
    setFilters((current) => ({
      ...current,
      product_id: [...stagedSelection.product_id],
      assembly_id: [...stagedSelection.assembly_id],
      part_id: [...stagedSelection.part_id]
    }));
    setIsNetworkDialogOpen(false);
  };

  const handleStagedToggle = (nodeType: NetworkNodeType, id: string) => {
    if (id === '__clear__') {
      setStagedSelection(emptyHierarchySelection());
      return;
    }

    if (nodeType === 'supplier') {
      return;
    }

    setStagedSelection((current) => {
      if (nodeType === 'product') {
        return toggleHierarchyLevel(current, 'product', id);
      }
      if (nodeType === 'assembly') {
        return toggleHierarchyLevel(current, 'assembly', id);
      }
      return toggleHierarchyLevel(current, 'part', id);
    });
  };

  return (
    <>
      <Panel
        className="h-[620px] rounded-[26px]"
        title="Product Hierarchy"
        subtitle="Tree navigation"
        rightAction={
          <div className="inline-flex rounded-full border border-app-border bg-dt-elevated p-1">
            <span className="rounded-full border border-req bg-dt-panel-hover px-3 py-1.5 text-sm font-medium text-app-text shadow-glow">
              Tree
            </span>
            <button
              type="button"
              onClick={openNetworkDialog}
              className="rounded-full border border-transparent px-3 py-1.5 text-sm font-medium text-app-muted transition hover:text-app-text"
            >
              Open Network
            </button>
          </div>
        }
        bodyClassName="flex h-[calc(100%-73px)] flex-col gap-4 overflow-hidden p-5"
      >
        <div className="relative grid-glow flex-1 overflow-hidden rounded-[22px] border border-app-border/80 bg-dt-sunken p-3">
          <div className="h-full overflow-y-auto pr-1">
            <div className="space-y-3">
              {products.map((product) => (
                <ProductTree
                  key={product.product_id}
                  product={product}
                  activeProducts={filters.product_id}
                  activeAssemblies={filters.assembly_id}
                  activeParts={filters.part_id}
                  onProductToggle={(productId) => {
                    setFilters((current) => ({
                      ...current,
                      ...toggleHierarchyLevel({
                        product_id: current.product_id,
                        assembly_id: current.assembly_id,
                        part_id: current.part_id
                      }, 'product', productId)
                    }));
                  }}
                  onAssemblyToggle={(assemblyId) => {
                    setFilters((current) => ({
                      ...current,
                      ...toggleHierarchyLevel({
                        product_id: current.product_id,
                        assembly_id: current.assembly_id,
                        part_id: current.part_id
                      }, 'assembly', assemblyId)
                    }));
                  }}
                  onPartToggle={(partId) => {
                    setFilters((current) => ({
                      ...current,
                      ...toggleHierarchyLevel({
                        product_id: current.product_id,
                        assembly_id: current.assembly_id,
                        part_id: current.part_id
                      }, 'part', partId)
                    }));
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <button type="button" onClick={clearHierarchyFilters} className="self-start text-sm font-medium text-critical transition hover:text-red-300">
          Clear All
        </button>
      </Panel>

      {isNetworkDialogOpen ? (
        <NetworkSelectionDialog
          graph={graph}
          selection={stagedSelection}
          onToggleNode={handleStagedToggle}
          onClose={() => setIsNetworkDialogOpen(false)}
          onApply={applyNetworkSelection}
        />
      ) : null}
    </>
  );
};

export default HierarchyPanel;
