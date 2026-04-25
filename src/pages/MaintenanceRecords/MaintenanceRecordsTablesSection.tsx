import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { QuickStatusAction } from "../../components/QuickStatusAction";
import { TablePagination } from "../../components/TablePagination";
import type { MaintenancePlan } from "../../types/maintenance-plan";
import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

export type Tab = "records" | "plans";
export type SortDirection = "asc" | "desc";
export type RecordSortBy = "date" | "vehicle" | "type" | "km" | "cost" | "status";
export type PlanSortBy = "name" | "vehicle" | "interval" | "due" | "status";

export type SelectOption = {
  id: string;
  label: string;
};

export type MaintenanceFilters = {
  vehicleId: string;
  recordType: string;
  recordStatus: string;
  planStatus: string;
  startDate: string;
  endDate: string;
};

type MaintenanceRecordsTablesSectionProps = {
  currentCompanyName?: string;
  tab: Tab;
  loading: boolean;
  consulting: boolean;
  draftFilters: MaintenanceFilters;
  filtersDirty: boolean;
  hasFiltersApplied: boolean;

  vehicleFilterOptions: SelectOption[];
  recordTypeOptions: SelectOption[];
  recordStatusOptions: SelectOption[];
  planStatusOptions: SelectOption[];

  onFilterChange: <K extends keyof MaintenanceFilters>(
    field: K,
    value: MaintenanceFilters[K],
  ) => void;
  onConsult: (event?: FormEvent) => void;
  onClearFilters: () => void;

  vehicleMap: Map<string, Vehicle>;
  highlightId: string | null;

  records: MaintenanceRecord[];
  paginatedRecords: MaintenanceRecord[];
  selectedRecordIds: string[];
  selectedRecordIdsSet: Set<string>;
  allRecordsOnPageSelected: boolean;
  someRecordsOnPageSelected: boolean;
  recordPage: number;
  recordTotalPages: number;
  tablePageSize: number;
  quickStatusRecordId: string | null;

  recordSortBy: RecordSortBy;
  recordSortDirection: SortDirection;
  onRecordSort: (column: RecordSortBy) => void;
  onToggleRecord: (id: string) => void;
  onToggleAllRecords: () => void;
  onClearSelectedRecords: () => void;
  onOpenEditSelectedRecord: () => void;
  onOpenBulkDeleteRecords: () => void;
  onPreviousRecordPage: () => void;
  onNextRecordPage: () => void;
  onOpenEditRecord: (record: MaintenanceRecord) => void;
  onQuickRecordStatusChange: (
    record: MaintenanceRecord,
    status: "OPEN" | "DONE",
  ) => void;

  plans: MaintenancePlan[];
  paginatedPlans: MaintenancePlan[];
  planPage: number;
  planTotalPages: number;
  planSortBy: PlanSortBy;
  planSortDirection: SortDirection;
  onPlanSort: (column: PlanSortBy) => void;
  onPreviousPlanPage: () => void;
  onNextPlanPage: () => void;
  onOpenEditPlan: (plan: MaintenancePlan) => void;
  onSetPlanToDelete: (plan: MaintenancePlan) => void;
};

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0,
  );
}

function toDateBR(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function toMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function maintenanceTypeLabel(value: string) {
  if (value === "PREVENTIVE") return "Preventiva";
  if (value === "CORRECTIVE") return "Corretiva";
  if (value === "PERIODIC") return "Periódica";
  return value || "-";
}

function maintenanceStatusLabel(value: string) {
  return value === "DONE" ? "Concluída" : "Pendente";
}

function planIntervalLabel(plan: MaintenancePlan) {
  if (plan.intervalUnit === "KM") {
    return `${plan.intervalValue.toLocaleString("pt-BR")} km`;
  }

  if (plan.intervalUnit === "MONTH") return `${plan.intervalValue} mês(es)`;
  if (plan.intervalUnit === "DAY") return `${plan.intervalValue} dia(s)`;

  return "-";
}

function planDueLabel(plan: MaintenancePlan) {
  if (plan.nextDueDate) return toDateBR(plan.nextDueDate);
  if (plan.nextDueKm) return `${plan.nextDueKm.toLocaleString("pt-BR")} km`;
  return "-";
}

function sortArrow(
  activeColumn: string,
  currentColumn: string,
  direction: SortDirection,
) {
  if (activeColumn !== currentColumn) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function MultiSelectField({
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
              className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
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
export function MaintenanceRecordsTablesSection({
  currentCompanyName,
  tab,
  loading,
  consulting,
  draftFilters,
  vehicleFilterOptions,
  recordTypeOptions,
  recordStatusOptions,
  planStatusOptions,
  onFilterChange,
  onConsult,
  onClearFilters,
  vehicleMap,
  highlightId,
  records,
  paginatedRecords,
  selectedRecordIds,
  selectedRecordIdsSet,
  allRecordsOnPageSelected,
  someRecordsOnPageSelected,
  recordPage,
  recordTotalPages,
  tablePageSize,
  quickStatusRecordId,
  recordSortBy,
  recordSortDirection,
  onRecordSort,
  onToggleRecord,
  onToggleAllRecords,
  onOpenEditSelectedRecord,
  onOpenBulkDeleteRecords,
  onPreviousRecordPage,
  onNextRecordPage,
  onQuickRecordStatusChange,
  plans,
  paginatedPlans,
  planPage,
  planTotalPages,
  planSortBy,
  planSortDirection,
  onPlanSort,
  onPreviousPlanPage,
  onNextPlanPage,
  onOpenEditPlan,
}: MaintenanceRecordsTablesSectionProps) {
  return (
    <>
      <form
        onSubmit={(event) => onConsult(event)}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
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

          <MultiSelectField
            label="Veículo"
            options={vehicleFilterOptions}
            selectedIds={splitCsv(draftFilters.vehicleId)}
            onChange={(value) => onFilterChange("vehicleId", value.join(","))}
            placeholder="Selecione os veículos"
          />

          <MultiSelectField
            label="Tipo"
            options={recordTypeOptions}
            selectedIds={splitCsv(draftFilters.recordType)}
            onChange={(value) => onFilterChange("recordType", value.join(","))}
            placeholder="Selecione os tipos"
          />

          <MultiSelectField
            label="Status da manutenção"
            options={recordStatusOptions}
            selectedIds={splitCsv(draftFilters.recordStatus)}
            onChange={(value) => onFilterChange("recordStatus", value.join(","))}
            placeholder="Selecione os status"
          />

          <MultiSelectField
            label="Status do plano"
            options={planStatusOptions}
            selectedIds={splitCsv(draftFilters.planStatus)}
            onChange={(value) => onFilterChange("planStatus", value.join(","))}
            placeholder="Selecione os status"
          />

          <label className="space-y-1.5">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Data inicial
            </span>
            <input
              type="date"
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
              type="date"
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

          <button
            type="submit"
            disabled={loading || consulting}
            className="btn-ui btn-ui-primary"
          >
            {loading || consulting ? "Atualizando..." : "Consultar"}
          </button>
        </div>
      </form>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando...
        </section>
      ) : null}

      {!loading && tab === "records" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            {selectedRecordIds.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {selectedRecordIds.length} manutenção(ões) selecionada(s)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenEditSelectedRecord}
                    disabled={selectedRecordIds.length !== 1}
                    title={
                      selectedRecordIds.length > 1
                        ? "Você pode editar apenas 1 manutenção selecionada"
                        : undefined
                    }
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Editar selecionado
                  </button>

                  <button
                    type="button"
                    onClick={onOpenBulkDeleteRecords}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Excluir selecionados
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  {records.length} manutenção(ões) encontrada(s).
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
                      checked={allRecordsOnPageSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someRecordsOnPageSelected;
                      }}
                      onChange={onToggleAllRecords}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                      aria-label="Selecionar manutenções da página"
                    />
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onRecordSort("date")}
                      className="cursor-pointer"
                    >
                      Data {sortArrow(recordSortBy, "date", recordSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onRecordSort("vehicle")}
                      className="cursor-pointer"
                    >
                      Veículo {sortArrow(recordSortBy, "vehicle", recordSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onRecordSort("type")}
                      className="cursor-pointer"
                    >
                      Tipo {sortArrow(recordSortBy, "type", recordSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    Descrição
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onRecordSort("km")}
                      className="cursor-pointer"
                    >
                      KM {sortArrow(recordSortBy, "km", recordSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onRecordSort("cost")}
                      className="cursor-pointer"
                    >
                      Custo {sortArrow(recordSortBy, "cost", recordSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onRecordSort("status")}
                      className="cursor-pointer"
                    >
                      Status {sortArrow(recordSortBy, "status", recordSortDirection)}
                    </button>
                  </th>

                </tr>
              </thead>

              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-sm text-slate-500"
                    >
                      Nenhuma manutenção encontrada.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => {
                    const vehicle = record.vehicle || vehicleMap.get(record.vehicleId);
                    const selected = selectedRecordIdsSet.has(record.id);

                    return (
                      <tr
                        key={record.id}
                        id={`maintenance-row-${record.id}`}
                        className={`border-t border-slate-200 ${highlightId === record.id
                          ? "bg-orange-50"
                          : selected
                            ? "bg-slate-50"
                            : ""
                          }`}
                      >
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleRecord(record.id)}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                            aria-label={`Selecionar manutenção ${record.description}`}
                          />
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {toDateBR(record.maintenanceDate)}
                        </td>

                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {vehicle ? formatVehicleLabel(vehicle) : "-"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {maintenanceTypeLabel(record.type)}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {record.description || "-"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {Number(record.km || 0).toLocaleString("pt-BR")}
                        </td>

                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {toMoney(Number(record.cost || 0))}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className={`status-pill ${record.status === "DONE" ? "status-active" : "status-pending"
                                }`}
                            >
                              {maintenanceStatusLabel(record.status)}
                            </span>

                            {record.status !== "DONE" ? (
                              <QuickStatusAction
                                label="Marcar como concluída"
                                loading={quickStatusRecordId === record.id}
                                options={[
                                  {
                                    value: "DONE",
                                    label: "Marcar como concluída",
                                  },
                                ]}
                                onSelect={(value) =>
                                  onQuickRecordStatusChange(record, value as "OPEN" | "DONE")
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

          {records.length > 0 ? (
            <TablePagination
              currentPage={recordPage}
              totalPages={recordTotalPages}
              totalItems={records.length}
              pageSize={tablePageSize}
              itemLabel="manutenções"
              onPrevious={onPreviousRecordPage}
              onNext={onNextRecordPage}
            />
          ) : null}
        </section>
      ) : null}

      {!loading && tab === "plans" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <p className="text-sm text-slate-600">
              {plans.length} plano(s) encontrado(s).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onPlanSort("name")}
                      className="cursor-pointer"
                    >
                      Plano {sortArrow(planSortBy, "name", planSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onPlanSort("vehicle")}
                      className="cursor-pointer"
                    >
                      Veículo {sortArrow(planSortBy, "vehicle", planSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    Tipo
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onPlanSort("interval")}
                      className="cursor-pointer"
                    >
                      Intervalo {sortArrow(planSortBy, "interval", planSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onPlanSort("due")}
                      className="cursor-pointer"
                    >
                      Próximo vencimento{" "}
                      {sortArrow(planSortBy, "due", planSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => onPlanSort("status")}
                      className="cursor-pointer"
                    >
                      Status {sortArrow(planSortBy, "status", planSortDirection)}
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedPlans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-sm text-slate-500"
                    >
                      Nenhum plano encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedPlans.map((plan) => {
                    const vehicle = plan.vehicle || vehicleMap.get(plan.vehicleId);

                    return (
                      <tr key={plan.id} className="border-t border-slate-200">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {plan.name}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {vehicle ? formatVehicleLabel(vehicle) : "-"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {maintenanceTypeLabel(plan.planType)}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {planIntervalLabel(plan)}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {planDueLabel(plan)}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`status-pill ${plan.active ? "status-active" : "status-inactive"
                              }`}
                          >
                            {plan.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <button
                            type="button"
                            onClick={() => onOpenEditPlan(plan)}
                            className="btn-ui btn-ui-neutral !px-3"
                            title="Editar plano"
                            aria-label={`Editar plano ${plan.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {plans.length > 0 ? (
            <TablePagination
              currentPage={planPage}
              totalPages={planTotalPages}
              totalItems={plans.length}
              pageSize={tablePageSize}
              itemLabel="planos"
              onPrevious={onPreviousPlanPage}
              onNext={onNextPlanPage}
            />
          ) : null}
        </section>
      ) : null}
    </>
  );
}