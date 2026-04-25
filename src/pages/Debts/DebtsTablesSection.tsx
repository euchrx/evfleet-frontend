import { useEffect, useMemo, useRef, useState } from "react";
import type { Debt } from "../../types/debt";
import type { Vehicle } from "../../types/vehicle";
import { QuickStatusAction } from "../../components/QuickStatusAction";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

export type DebtCategory = Debt["category"];

export type DebtSortBy =
  | "category"
  | "description"
  | "vehicle"
  | "debtDate"
  | "dueDate"
  | "amount"
  | "status";

export type DebtListFilters = {
  vehicleIds: string[];
  categories: string[];
  statuses: string[];
  dueDateStart: string;
  dueDateEnd: string;
};

type SelectOption = {
  id: string;
  label: string;
};

type DebtCategoryOption = {
  value: DebtCategory;
  label: string;
};

type DebtStatusOption = {
  value: string;
  label: string;
};

type DebtsTablesSectionProps = {
  currentCompanyName?: string;
  loading: boolean;
  draftFilters: DebtListFilters;
  filterVehicleOptions: Vehicle[];
  filteredDebts: Debt[];
  paginatedDebts: Debt[];
  selectedDebtIds: string[];
  allDebtsOnPageSelected: boolean;
  currentPage: number;
  totalPages: number;
  tablePageSize: number;
  highlightedDebtId: string | null;
  quickStatusDebtId: string | null;
  debtCategoryOptions: DebtCategoryOption[];
  debtStatusOptions: DebtStatusOption[];
  onFilterChange: <K extends keyof DebtListFilters>(
    field: K,
    value: DebtListFilters[K],
  ) => void;
  onConsult: () => void;
  onClearFilters: () => void;
  onToggleDebt: (id: string) => void;
  onToggleAllDebts: () => void;
  onOpenEditSelected: () => void;
  onOpenBulkDelete: () => void;
  onQuickStatusChange: (debt: Debt, nextStatus: string) => void;
  onSort: (column: DebtSortBy) => void;
  getSortArrow: (column: DebtSortBy) => string;
  categoryLabel: (value?: DebtCategory | null) => string;
  statusLabel: (status: string) => string;
  statusClass: (status: string) => string;
  getEffectiveDebtStatus: (debt: Debt) => string;
  toDateText: (value?: string | null) => string;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

function MultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  error,
  disabled = false,
  openOnClick = false,
  keepOpenOnSelect = false,
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  openOnClick?: boolean;
  keepOpenOnSelect?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)),
    [options, selectedIds],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return options
      .filter((item) => {
        if (selectedIds.includes(item.id)) return false;
        if (!normalized && !openOnClick) return false;
        if (!normalized) return true;
        return item.label.toLowerCase().includes(normalized);
      })
      .slice(0, 10);
  }, [options, selectedIds, query, openOnClick]);

  function addItem(id: string) {
    if (disabled || selectedIds.includes(id)) return;

    onChange([...selectedIds, id]);
    setQuery("");

    if (keepOpenOnSelect) {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setOpen(false);
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
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div ref={containerRef} className="relative">
        <div
          className={`min-h-[44px] w-full rounded-xl border bg-white px-2.5 py-2 text-sm focus-within:ring-2 ${
            error
              ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-200"
              : "border-slate-300 focus-within:border-orange-500 focus-within:ring-orange-200"
          }`}
          onClick={() => {
            if (disabled) return;
            inputRef.current?.focus();
            if (openOnClick) setOpen(true);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex cursor-default items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                onClick={(event) => event.stopPropagation()}
              >
                {item.label}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    if (!disabled) {
                      onChange(selectedIds.filter((id) => id !== item.id));
                      requestAnimationFrame(() => inputRef.current?.focus());
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
              ref={inputRef}
              value={query}
              onChange={(event) => {
                if (disabled) return;

                const nextQuery = event.target.value;
                setQuery(nextQuery);
                setOpen(Boolean(nextQuery.trim()) || openOnClick);
              }}
              onFocus={() => {
                if (disabled) return;
                if (openOnClick || query.trim()) setOpen(true);
              }}
              placeholder={
                selectedOptions.length === 0
                  ? placeholder
                  : "Digite para buscar..."
              }
              disabled={disabled}
              className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed"
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

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function DebtsTablesSection({
  currentCompanyName,
  loading,
  draftFilters,
  filterVehicleOptions,
  filteredDebts,
  paginatedDebts,
  selectedDebtIds,
  allDebtsOnPageSelected,
  currentPage,
  totalPages,
  tablePageSize,
  highlightedDebtId,
  quickStatusDebtId,
  debtCategoryOptions,
  debtStatusOptions,
  onFilterChange,
  onConsult,
  onClearFilters,
  onToggleDebt,
  onToggleAllDebts,
  onOpenEditSelected,
  onOpenBulkDelete,
  onQuickStatusChange,
  onSort,
  getSortArrow,
  categoryLabel,
  statusLabel,
  statusClass,
  getEffectiveDebtStatus,
  toDateText,
  onPreviousPage,
  onNextPage,
}: DebtsTablesSectionProps) {
  const vehicleOptions = useMemo<SelectOption[]>(
    () =>
      filterVehicleOptions.map((vehicle) => ({
        id: vehicle.id,
        label: formatVehicleLabel(vehicle),
      })),
    [filterVehicleOptions],
  );

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      debtCategoryOptions.map((item) => ({
        id: item.value,
        label: item.label,
      })),
    [debtCategoryOptions],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () =>
      debtStatusOptions.map((item) => ({
        id: item.value,
        label: item.label,
      })),
    [debtStatusOptions],
  );

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Empresa
            </label>
            <input
              type="text"
              value={currentCompanyName || "Empresa não selecionada"}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
            />
          </div>

          <div>
            <MultiSelectField
              label="Veículos"
              options={vehicleOptions}
              selectedIds={draftFilters.vehicleIds}
              onChange={(value) => onFilterChange("vehicleIds", value)}
              placeholder="Buscar por placa, marca ou modelo"
              openOnClick
              keepOpenOnSelect
            />
          </div>

          <div>
            <MultiSelectField
              label="Categoria"
              options={categoryOptions}
              selectedIds={draftFilters.categories}
              onChange={(value) => onFilterChange("categories", value)}
              placeholder="Selecione as categorias"
              openOnClick
              keepOpenOnSelect
            />
          </div>

          <div>
            <MultiSelectField
              label="Status"
              options={statusOptions}
              selectedIds={draftFilters.statuses}
              onChange={(value) => onFilterChange("statuses", value)}
              placeholder="Selecione os status"
              openOnClick
              keepOpenOnSelect
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Vencimento inicial
            </label>
            <input
              type="date"
              value={draftFilters.dueDateStart}
              onChange={(event) =>
                onFilterChange("dueDateStart", event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Vencimento final
            </label>
            <input
              type="date"
              value={draftFilters.dueDateEnd}
              onChange={(event) =>
                onFilterChange("dueDateEnd", event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Limpar filtros
          </button>

          <button
            type="button"
            onClick={onConsult}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Consultar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedDebtIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedDebtIds.length} débito(s) selecionado(s)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenEditSelected}
                  disabled={selectedDebtIds.length !== 1}
                  title={
                    selectedDebtIds.length > 1
                      ? "Você pode editar apenas 1 débito selecionado"
                      : undefined
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar selecionado
                </button>

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
                {filteredDebts.length} débito(s) encontrado(s).
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
                    checked={allDebtsOnPageSelected}
                    onChange={onToggleAllDebts}
                    aria-label="Selecionar débitos da página"
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                  />
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("category")}
                    className="cursor-pointer"
                  >
                    Categoria {getSortArrow("category")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("description")}
                    className="cursor-pointer"
                  >
                    Descrição {getSortArrow("description")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("vehicle")}
                    className="cursor-pointer"
                  >
                    Veículo {getSortArrow("vehicle")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("debtDate")}
                    className="cursor-pointer"
                  >
                    Lançamento {getSortArrow("debtDate")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("dueDate")}
                    className="cursor-pointer"
                  >
                    Vencimento {getSortArrow("dueDate")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("amount")}
                    className="cursor-pointer"
                  >
                    Valor {getSortArrow("amount")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("status")}
                    className="cursor-pointer"
                  >
                    Status {getSortArrow("status")}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando débitos...
                  </td>
                </tr>
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhum débito encontrado.
                  </td>
                </tr>
              ) : (
                paginatedDebts.map((debt) => {
                  const effectiveStatus = getEffectiveDebtStatus(debt);
                  const isSelected = selectedDebtIds.includes(debt.id);

                  return (
                    <tr
                      id={`debt-row-${debt.id}`}
                      key={debt.id}
                      className={`border-t border-slate-200 transition-colors ${
                        isSelected ? "bg-slate-50" : ""
                      } ${
                        highlightedDebtId === debt.id
                          ? "notification-highlight"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleDebt(debt.id)}
                          aria-label={`Selecionar débito ${debt.description}`}
                          className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        />
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {categoryLabel(debt.category)}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {debt.description}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {debt.vehicle
                          ? formatVehicleLabel(debt.vehicle)
                          : debt.vehicleId}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {toDateText(debt.debtDate)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {toDateText(debt.dueDate || debt.debtDate)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-900">
                        {debt.amount.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`status-pill ${statusClass(effectiveStatus)}`}
                          >
                            {statusLabel(effectiveStatus)}
                          </span>

                          {effectiveStatus === "PENDING" ||
                          effectiveStatus === "OVERDUE" ? (
                            <QuickStatusAction
                              label={`Atualizar status do débito ${debt.description}`}
                              loading={quickStatusDebtId === debt.id}
                              options={[
                                { value: "PAID", label: "Marcar como paga" },
                                {
                                  value: "APPEALED",
                                  label: "Marcar como recorrida",
                                },
                              ]}
                              onSelect={(value) =>
                                onQuickStatusChange(debt, value)
                              }
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredDebts.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDebts.length}
            pageSize={tablePageSize}
            itemLabel="débitos"
            onPrevious={onPreviousPage}
            onNext={onNextPage}
          />
        ) : null}
      </div>
    </>
  );
}