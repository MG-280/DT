import { useState } from 'react';
import { useHierarchy } from '../../hooks/useDashboardData';
import { useFilters } from '../../context/FilterContext';
import type { Filter, Product } from '../../types';
import Panel from '../shared/Panel';
import { isSelected, toggleSelection } from '../../utils/helpers';
import { useDashboardMode } from '../../hooks/useDashboardMode';

type HierarchyLevel = 'product' | 'assembly' | 'part';
type HierarchySelection = Pick<Filter, 'product_id' | 'assembly_id' | 'part_id'>;

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
  const [expandedProduct, setExpandedProduct] = useState(false);
  const [expandedAssemblies, setExpandedAssemblies] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded-[22px] border border-app-border bg-dt-panel px-4 py-4 shadow-panel">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setExpandedProduct((current) => !current)}
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-app-border bg-dt-elevated text-xs text-app-soft transition hover:border-req hover:text-app-text"
          aria-label={expandedProduct ? 'Collapse product' : 'Expand product'}
        >
          {expandedProduct ? '▾' : '▸'}
        </button>

        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected(activeProducts, product.product_id)}
            onChange={() => onProductToggle(product.product_id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-app-border bg-transparent accent-req"
          />
          <button
            type="button"
            onClick={() => setExpandedProduct((current) => !current)}
            className="min-w-0 text-left"
          >
            <span className="block truncate text-sm font-semibold text-app-text">{product.product_name}</span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-app-muted">
              {product.product_id} • {product.assemblies.length} assemblies
            </span>
          </button>
        </div>
      </div>

      {expandedProduct ? (
        <div className="ml-[9px] mt-4 space-y-3 border-l border-app-border/80 pl-5">
          {product.assemblies.map((assembly) => {
            const expanded = expandedAssemblies[assembly.assembly_id] ?? isSelected(activeAssemblies, assembly.assembly_id);

            return (
              <div key={assembly.assembly_id} className="rounded-2xl border border-app-border/70 bg-dt-elevated px-3 py-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedAssemblies((current) => ({
                      ...current,
                      [assembly.assembly_id]: !expanded
                    }))}
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-app-border bg-dt-panel text-xs text-app-soft transition hover:border-req hover:text-app-text"
                    aria-label={expanded ? 'Collapse assembly' : 'Expand assembly'}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>

                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected(activeAssemblies, assembly.assembly_id)}
                      onChange={() => onAssemblyToggle(assembly.assembly_id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-app-border bg-transparent accent-req"
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedAssemblies((current) => ({
                        ...current,
                        [assembly.assembly_id]: !expanded
                      }))}
                      className="min-w-0 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-app-text">{assembly.assembly_name}</span>
                      <span className="mt-1 block text-[11px] uppercase tracking-[0.14em] text-app-muted">
                        {assembly.assembly_id} • {assembly.parts.length} parts
                      </span>
                    </button>
                  </div>
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

const HierarchyPanel = () => {
  const { data } = useHierarchy();
  const { filters, setFilters, clearHierarchyFilters } = useFilters();
  const { mode } = useDashboardMode();

  const products = data?.products ?? [];

  return (
    <>
      <Panel
        className="h-[620px] rounded-[26px]"
        title="Product Hierarchy"
        subtitle="Tree navigation"
        rightAction={
          <span className="rounded-full border border-req bg-dt-panel-hover px-3 py-1.5 text-sm font-medium text-app-text shadow-glow">
            Tree
          </span>
        }
        bodyClassName="flex h-[calc(100%-73px)] flex-col gap-4 overflow-hidden p-5"
      >
        {mode === 'simulation' ? (
          <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Future phase: clicking a tree node in simulation mode will call selectPart().
          </div>
        ) : null}
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
    </>
  );
};

export default HierarchyPanel;
