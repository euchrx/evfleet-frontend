import { useEffect, useMemo, useRef, useState } from "react";
import { TablePagination } from "../../components/TablePagination";
import type { FuelRecord } from "../../services/fuelRecords";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import { formatFuelTypeLabel } from "../../utils/fuelTypeLabel";

export type FuelListFilters = {
  branchId: string;
  vehicleId: string;
  driverId: string;
  fuelType: string;
  invoiceNumber: string;
  anomalyStatus: string;
  startDate: string;
  endDate: string;
};

export type FuelSortBy =
  | "invoiceNumber"
  | "branch"
  | "vehicle"
  | "driver"
  | "fuelDate"
  | "fuelType"
  | "liters"
  | "totalValue"
  | "km"
  | "avgConsumption";

export type SelectOption = {
  id: string;
  label: string;
};

type Props = {
  currentCompanyName?: string;
  loading: boolean;
  hasLoadedData: boolean;
  draftFilters: FuelListFilters;
  vehicleFilterOptions: SelectOption[];
  driverFilterOptions: SelectOption[];
  fuelTypeOptions: SelectOption[];
  anomalyStatusOptions: SelectOption[];
  filteredRecords: FuelRecord[];
  paginatedRecords: FuelRecord[];
  selectedRecordIds: string[];
  selectedRecordIdsSet: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  deletingSelectedRecords: boolean;
  currentPage: number;
  totalPages: number;
  tablePageSize: number;
  anomalyMapByRecordId: Record<string, unknown>;
  onFilterChange: <K extends keyof FuelListFilters>(
    field: K,
    value: FuelListFilters[K],
  ) => void;
  onSearchSubmit: (event: React.FormEvent) => void;
  onClearFilters: () => void;
  onClearSelectedRecords: () => void;
  onOpenBulkDeleteModal: () => void;
  onToggleSelectAllPage: () => void;
  onToggleRecordSelection: (recordId: string) => void;
  onSort: (column: FuelSortBy) => void;
  getSortArrow: (column: FuelSortBy) => string;
  getRecordBranchName: (record: FuelRecord) => string;
  getRecordDriverName: (record: FuelRecord) => string;
  getRecordFuelType: (record: FuelRecord) => string;
  formatLocalDate: (dateValue: string) => string;
  onOpenEditModal: (record: FuelRecord) => void;
  onSetRecordToDelete: (record: FuelRecord) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function CompactMultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  disabled = false,
  openOnClick = true,
  keepOpenOnSelect = true,
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
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
    <div className="space-y-1.5">
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div ref={containerRef} className="relative">
        <div
          className={`min-h-[40px] w-full rounded-xl border bg-white px-2.5 py-1.5 text-sm focus-within:ring-2 ${disabled
            ? "border-slate-200 bg-slate-100"
            : "border-slate-300 focus-within:border-orange-500 focus-within:ring-orange-200"
            }`}
          onClick={() => {
            if (disabled) return;
            inputRef.current?.focus();
            if (openOnClick) setOpen(true);
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
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }
                  }}
                  className={`leading-none ${disabled
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

export function FuelRecordsTablesSection({
  currentCompanyName,
  loading,
  hasLoadedData,
  draftFilters,
  vehicleFilterOptions,
  driverFilterOptions,
  fuelTypeOptions,
  anomalyStatusOptions,
  filteredRecords,
  paginatedRecords,
  selectedRecordIds,
  selectedRecordIdsSet,
  allPageSelected,
  somePageSelected,
  deletingSelectedRecords,
  currentPage,
  totalPages,
  tablePageSize,
  anomalyMapByRecordId,
  onFilterChange,
  onSearchSubmit,
  onClearFilters,
  onClearSelectedRecords,
  onOpenBulkDeleteModal,
  onToggleSelectAllPage,
  onToggleRecordSelection,
  onSort,
  getSortArrow,
  getRecordBranchName,
  getRecordDriverName,
  getRecordFuelType,
  formatLocalDate,
  onOpenEditModal,
  onSetRecordToDelete,
  onPreviousPage,
  onNextPage,
}: Props) {
  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form onSubmit={onSearchSubmit} className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Empresa
              </span>
              <input
                value={currentCompanyName || "Empresa não selecionada"}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              />
            </label>

            <CompactMultiSelectField
              label="Veículos"
              options={vehicleFilterOptions}
              selectedIds={splitCsv(draftFilters.vehicleId)}
              onChange={(value) => onFilterChange("vehicleId", value.join(","))}
              placeholder="Selecione os veículos"
            />

            <CompactMultiSelectField
              label="Motoristas"
              options={driverFilterOptions}
              selectedIds={splitCsv(draftFilters.driverId)}
              onChange={(value) => onFilterChange("driverId", value.join(","))}
              placeholder="Selecione os motoristas"
            />

            <CompactMultiSelectField
              label="Combustível"
              options={fuelTypeOptions}
              selectedIds={splitCsv(draftFilters.fuelType)}
              onChange={(value) => onFilterChange("fuelType", value.join(","))}
              placeholder="Selecione os combustíveis"
            />

            <CompactMultiSelectField
              label="Situação"
              options={anomalyStatusOptions}
              selectedIds={splitCsv(draftFilters.anomalyStatus)}
              onChange={(value) => onFilterChange("anomalyStatus", value.join(","))}
              placeholder="Selecione a situação"
            />

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Nota
              </span>
              <input
                value={draftFilters.invoiceNumber}
                onChange={(event) =>
                  onFilterChange("invoiceNumber", event.target.value)
                }
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Data inicial
              </span>
              <input
                type="datetime-local"
                value={draftFilters.startDate}
                onChange={(event) => onFilterChange("startDate", event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="space-y-1.5">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Data final
              </span>
              <input
                type="datetime-local"
                value={draftFilters.endDate}
                onChange={(event) => onFilterChange("endDate", event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-start">
            <button
              type="button"
              onClick={onClearFilters}
              className="btn-ui btn-ui-neutral"
            >
              Limpar filtros
            </button>
            <button type="submit" disabled={loading} className="btn-ui btn-ui-primary">
              {loading ? "Atualizando..." : "Consultar"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedRecordIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedRecordIds.length} abastecimento(s) selecionado(s)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearSelectedRecords}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar seleção
                </button>

                <button
                  type="button"
                  disabled={deletingSelectedRecords}
                  onClick={onOpenBulkDeleteModal}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingSelectedRecords ? "Excluindo..." : "Excluir selecionados"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {hasLoadedData
                  ? `${filteredRecords.length} abastecimento(s) encontrado(s).`
                  : "Nenhum resultado carregado ainda."}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = somePageSelected;
                    }}
                    onChange={onToggleSelectAllPage}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                    aria-label="Selecionar abastecimentos da página"
                  />
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("branch")}
                    className="cursor-pointer"
                  >
                    Filial {getSortArrow("branch")}
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
                    onClick={() => onSort("driver")}
                    className="cursor-pointer"
                  >
                    Motorista {getSortArrow("driver")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("fuelDate")}
                    className="cursor-pointer"
                  >
                    Data e Hora {getSortArrow("fuelDate")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("fuelType")}
                    className="cursor-pointer"
                  >
                    Combustível {getSortArrow("fuelType")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("liters")}
                    className="cursor-pointer"
                  >
                    Litros {getSortArrow("liters")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("totalValue")}
                    className="cursor-pointer"
                  >
                    Valor total {getSortArrow("totalValue")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("km")}
                    className="cursor-pointer"
                  >
                    KM {getSortArrow("km")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("avgConsumption")}
                    className="cursor-pointer"
                  >
                    Consumo médio {getSortArrow("avgConsumption")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando abastecimentos...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum abastecimento encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr key={record.id} className="border-t border-slate-200">
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedRecordIdsSet.has(record.id)}
                        onChange={() => onToggleRecordSelection(record.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300"
                        aria-label={`Selecionar abastecimento ${record.id}`}
                      />
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {getRecordBranchName(record)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.vehicle ? formatVehicleLabel(record.vehicle) : record.vehicleId}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {getRecordDriverName(record)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatLocalDate(record.fuelDate)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatFuelTypeLabel(getRecordFuelType(record))}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.liters.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {record.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.km}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.averageConsumptionKmPerLiter
                        ? `${record.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} km/L`
                        : "-"}

                      {anomalyMapByRecordId[record.id] ? (
                        <span className="status-pill status-anomaly ml-2">
                          Anomalia
                        </span>
                      ) : null}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(record)}
                          className="btn-ui btn-ui-neutral"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => onSetRecordToDelete(record)}
                          className="btn-ui btn-ui-danger"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRecords.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRecords.length}
            pageSize={tablePageSize}
            itemLabel="abastecimentos"
            onPrevious={onPreviousPage}
            onNext={onNextPage}
          />
        ) : null}
      </section>
    </>
  );
}