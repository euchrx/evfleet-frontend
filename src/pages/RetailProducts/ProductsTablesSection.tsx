import { useEffect, useMemo, useRef, useState } from "react";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import type {
  RetailProductCategory,
  RetailProductItem,
} from "../../services/retailProducts";

export type ProductPageFilters = {
  dateFrom: string;
  dateTo: string;
  category: string;
  description: string;
  productCode: string;
  supplierName: string;
  invoiceNumber: string;
};

export type SelectOption = {
  id: string;
  label: string;
};

type ProductsTablesSectionProps = {
  currentCompanyName?: string;
  loading: boolean;
  refreshing: boolean;
  draftFilters: ProductPageFilters;
  filteredItems: RetailProductItem[];
  paginatedItems: RetailProductItem[];
  selectedItemIds: string[];
  allItemsOnPageSelected: boolean;
  productOptions: SelectOption[];
  productCodeOptions: SelectOption[];
  supplierOptions: SelectOption[];
  invoiceOptions: SelectOption[];
  categoryOptions: SelectOption[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onFilterChange: <K extends keyof ProductPageFilters>(
    field: K,
    value: ProductPageFilters[K],
  ) => void;
  onSearch: () => void;
  onClear: () => void;
  onToggleItemSelection: (itemId: string) => void;
  onToggleSelectAllPage: () => void;
  onOpenBulkDelete: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const normalized = value.includes(",")
      ? value.replaceAll(".", "").replace(",", ".")
      : value;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatMoney(value: string | number | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatQuantity(value: string | number | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

function categoryLabel(category: RetailProductCategory | string) {
  if (category === "PERFUMARIA") return "Perfumaria";
  if (category === "COSMETICOS") return "Cosméticos";
  if (category === "LUBRIFICANTES") return "Lubrificantes";
  if (category === "CONVENIENCIA") return "Conveniência";
  if (category === "LIMPEZA") return "Limpeza";
  if (category === "OUTROS") return "Outros";

  return "Outros";
}

function MultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)),
    [options, selectedIds],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return options
      .filter((item) => {
        if (selectedIds.includes(item.id)) return false;
        if (!normalized) return true;
        return item.label.toLowerCase().includes(normalized);
      })
      .slice(0, 10);
  }, [options, query, selectedIds]);

  function addItem(id: string) {
    if (disabled || selectedIds.includes(id)) return;

    onChange([...selectedIds, id]);
    setQuery("");
    setOpen(true);
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;

      const target = event.target as Node;
      if (!containerRef.current.contains(target)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div ref={containerRef} className="relative">
        <div
          className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm transition focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200"
          onClick={() => {
            if (disabled) return;

            const input = containerRef.current?.querySelector("input");
            input?.focus();
            setOpen(true);
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex cursor-default items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                onClick={(event) => event.stopPropagation()}
              >
                {item.label}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    if (!disabled) {
                      onChange(selectedIds.filter((id) => id !== item.id));
                    }
                  }}
                  className={`text-slate-500 ${
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:text-red-600"
                  }`}
                >
                  ×
                </button>
              </span>
            ))}

            <input
              value={query}
              onChange={(event) => {
                if (disabled) return;

                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (!disabled) setOpen(true);
              }}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              placeholder={selectedOptions.length === 0 ? placeholder : "Buscar..."}
              disabled={disabled}
              className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {open && !disabled && filteredOptions.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  addItem(option.id);
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductsTablesSection({
  currentCompanyName,
  loading,
  refreshing,
  draftFilters,
  filteredItems,
  paginatedItems,
  selectedItemIds,
  allItemsOnPageSelected,
  productOptions,
  productCodeOptions,
  supplierOptions,
  invoiceOptions,
  categoryOptions,
  currentPage,
  totalPages,
  pageSize,
  onFilterChange,
  onSearch,
  onClear,
  onToggleItemSelection,
  onToggleSelectAllPage,
  onOpenBulkDelete,
  onPreviousPage,
  onNextPage,
}: ProductsTablesSectionProps) {
  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Empresa
              </label>
              <input
                value={currentCompanyName || "Empresa não selecionada"}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              />
            </div>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Data inicial
              </span>
              <input
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) => onFilterChange("dateFrom", event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Data final
              </span>
              <input
                type="date"
                value={draftFilters.dateTo}
                onChange={(event) => onFilterChange("dateTo", event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <MultiSelectField
              label="Produto"
              options={productOptions}
              selectedIds={splitCsv(draftFilters.description)}
              onChange={(value) => onFilterChange("description", value.join(","))}
              placeholder="Selecione os produtos"
            />

            <MultiSelectField
              label="Código do produto"
              options={productCodeOptions}
              selectedIds={splitCsv(draftFilters.productCode)}
              onChange={(value) => onFilterChange("productCode", value.join(","))}
              placeholder="Selecione os códigos"
            />

            <MultiSelectField
              label="Fornecedor"
              options={supplierOptions}
              selectedIds={splitCsv(draftFilters.supplierName)}
              onChange={(value) => onFilterChange("supplierName", value.join(","))}
              placeholder="Selecione os fornecedores"
            />

            <MultiSelectField
              label="NF-e"
              options={invoiceOptions}
              selectedIds={splitCsv(draftFilters.invoiceNumber)}
              onChange={(value) => onFilterChange("invoiceNumber", value.join(","))}
              placeholder="Selecione as notas"
            />

            <MultiSelectField
              label="Categoria"
              options={categoryOptions}
              selectedIds={splitCsv(draftFilters.category)}
              onChange={(value) => onFilterChange("category", value.join(","))}
              placeholder="Selecione as categorias"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-start">
            <button
              type="button"
              onClick={onClear}
              className="btn-ui btn-ui-neutral"
            >
              Limpar filtros
            </button>

            <button
              type="button"
              onClick={onSearch}
              disabled={loading || refreshing}
              className="btn-ui btn-ui-primary"
            >
              {refreshing ? "Consultando..." : "Consultar"}
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedItemIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedItemIds.length} item(ns) selecionado(s)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenBulkDelete}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Excluir selecionados
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {filteredItems.length} item(ns) encontrado(s).
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-12 px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allItemsOnPageSelected}
                    onChange={onToggleSelectAllPage}
                    disabled={loading || paginatedItems.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Selecionar itens da página"
                  />
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Produto
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Veículo
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Categoria
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Qtd
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Valor
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Valor total
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  NF-e
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Fornecedor
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Data
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando produtos...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => onToggleItemSelection(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label={`Selecionar produto ${item.description}`}
                      />
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Código: {item.productCode || "-"}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.vehicle ? (
                        <span>
                          {formatVehicleLabel(item.retailProductImport.vehicle)}
                        </span>
                      ) : item.retailProductImport.sourcePlate ? (
                        <span>{item.retailProductImport.sourcePlate}</span>
                      ) : (
                        <span className="text-slate-500">
                          Sem veículo detectado
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {categoryLabel(item.category)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatQuantity(item.quantity)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatMoney(item.unitValue)}
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {formatMoney(item.totalValue)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.invoiceNumber || "-"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.retailProductImport.supplierName || "-"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatDate(item.retailProductImport.issuedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredItems.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            pageSize={pageSize}
            itemLabel="produtos"
            onPrevious={onPreviousPage}
            onNext={onNextPage}
          />
        ) : null}
      </section>
    </>
  );
}