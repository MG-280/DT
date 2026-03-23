import { useFilters } from '../../context/FilterContext';
import { FILTER_OPTIONS } from '../../utils/constants';

const selectClassName =
  'w-full appearance-none rounded-2xl border border-app-border bg-dt-elevated px-4 py-3 pr-10 text-sm text-app-text outline-none transition hover:border-dt-subtle focus:border-req';

const wrapperClassName =
  'relative min-w-[190px] rounded-2xl bg-dt-sunken before:pointer-events-none before:absolute before:right-4 before:top-1/2 before:-translate-y-1/2 before:text-app-muted before:content-["▾"]';

const hierarchyKeys = new Set(['product_id', 'assembly_id', 'part_id']);

const FilterBar = () => {
  const { filters, updateFilter } = useFilters();

  return (
    <div className="panel rounded-[24px] px-4 py-4">
      <div className="grid gap-3 xl:grid-cols-6">
        {(
          [
            ['product_id', 'All Products'],
            ['assembly_id', 'All Assemblies'],
            ['part_id', 'All Parts'],
            ['supplier_id', 'All Suppliers'],
            ['factory_id', 'All Factories'],
            ['location_id', 'All Locations']
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">{label}</span>
            <div className={wrapperClassName}>
              {(() => {
                const isHierarchyKey = hierarchyKeys.has(key);
                const hierarchyValues = isHierarchyKey ? filters[key] as string[] : [];
                const currentValue = isHierarchyKey
                  ? hierarchyValues.length === 0
                    ? ''
                    : hierarchyValues.length === 1
                      ? hierarchyValues[0]
                      : '__multiple__'
                  : filters[key] ?? '';

                return (
              <select
                className={selectClassName}
                value={currentValue}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (!isHierarchyKey) {
                    updateFilter(key, nextValue);
                    return;
                  }

                  if (key === 'product_id') {
                    updateFilter('product_id', nextValue ? [nextValue] : []);
                    updateFilter('assembly_id', []);
                    updateFilter('part_id', []);
                    return;
                  }

                  if (key === 'assembly_id') {
                    updateFilter('product_id', []);
                    updateFilter('assembly_id', nextValue ? [nextValue] : []);
                    updateFilter('part_id', []);
                    return;
                  }

                  updateFilter('product_id', []);
                  updateFilter('assembly_id', []);
                  updateFilter('part_id', nextValue ? [nextValue] : []);
                }}
              >
                {isHierarchyKey && hierarchyValues.length > 1 ? (
                  <option value="__multiple__">Multiple selected</option>
                ) : null}
                {FILTER_OPTIONS[key].map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
                );
              })()}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;