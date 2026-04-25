import { useEffect, useMemo, useRef, useState } from "react";
import type { Tire, TireAlert, TireStatus } from "../../../types/tire";
import {
  brandModelLabel,
  formatNumberLabel,
  formatPositionLabel,
  tireConditionLabel,
  tireStatusClass,
  tireStatusLabel,
  tireVehicleLabel,
} from "../helpers";

export type LinkFilter = "" | "LINKED" | "UNLINKED";

export type TireSearchFilters = {
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  status: "" | TireStatus;
  condition: string;
  vehicle: string;
  branch: string;
  purchaseDateStart: string;
  purchaseDateEnd: string;
  linkFilter: string;
  alertFilter: string;
};

type SelectOption = { id: string; label: string };

type Props = {
  tires: Tire[];
  draftFilters: TireSearchFilters;
  onDraftFilterChange: <K extends keyof TireSearchFilters>(
    field: K,
    value: TireSearchFilters[K],
  ) => void;
  onSearch: () => void;
  onClearFilters: () => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  selectedIds: Set<string>;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onOpenDetails: (tire: Tire) => void;
  onOpenEdit: (tire: Tire) => void;
  onOpenBulkEdit: () => void;
  onDeleteSelected: () => void;
  getAlertsForTire: (tireId: string) => TireAlert[];
};

function splitFilterValue(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinFilterValue(values: string[]) {
  return values.join(",");
}

function uniqueOptions(values: Array<string | null | undefined>): SelectOption[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  )
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((value) => ({
      id: value,
      label: value,
    }));
}

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
      <label className="block text-sm font-semibold text-slate-700">{label}</label>

      <div ref={containerRef} className="relative">
        <div
          className={`min-h-[44px] w-full rounded-xl border bg-white px-2.5 py-2 text-sm focus-within:ring-2 ${error
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
                  className={`text-slate-500 ${disabled
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
                selectedOptions.length === 0 ? placeholder : "Digite para buscar..."
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

export function TireTable({
  tires,
  draftFilters,
  onDraftFilterChange,
  onSearch,
  onClearFilters,
  currentPage,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
  selectedIds,
  onToggleAll,
  onToggleOne,
  onOpenDetails,
  onOpenEdit,
  onOpenBulkEdit,
  onDeleteSelected,
  getAlertsForTire,
}: Props) {
  const allSelected =
    tires.length > 0 && tires.every((tire) => selectedIds.has(tire.id));

  const serialNumberOptions = useMemo(
    () => uniqueOptions(tires.map((tire) => tire.serialNumber)),
    [tires],
  );

  const brandOptions = useMemo(
    () => uniqueOptions(tires.map((tire) => tire.brand)),
    [tires],
  );

  const modelOptions = useMemo(
    () => uniqueOptions(tires.map((tire) => tire.model)),
    [tires],
  );

  const sizeOptions = useMemo(
    () => uniqueOptions(tires.map((tire) => tire.size)),
    [tires],
  );

  const conditionOptions = useMemo(
    () => uniqueOptions(tires.map((tire) => tireConditionLabel(tire))),
    [tires],
  );

  const vehicleOptions = useMemo(
    () => uniqueOptions(tires.map((tire) => tireVehicleLabel(tire))),
    [tires],
  );

  const statusOptions: SelectOption[] = [
    { id: "IN_STOCK", label: "Em estoque" },
    { id: "INSTALLED", label: "Instalado" },
    { id: "MAINTENANCE", label: "Manutenção" },
    { id: "RETREADED", label: "Recapado" },
    { id: "SCRAPPED", label: "Descartado" },
  ];

  const linkOptions: SelectOption[] = [
    { id: "ALL", label: "Todos" },
    { id: "LINKED", label: "Somente vinculados" },
    { id: "UNLINKED", label: "Somente não vinculados" },
  ];

  const alertOptions: SelectOption[] = [
    { id: "ALL", label: "Todos" },
    { id: "ONLY_ALERTS", label: "Somente com alertas" },
    { id: "WITHOUT_ALERTS", label: "Sem alertas" },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MultiSelectField
            label="Número de série"
            options={serialNumberOptions}
            selectedIds={splitFilterValue(draftFilters.serialNumber)}
            onChange={(value) =>
              onDraftFilterChange("serialNumber", joinFilterValue(value))
            }
            placeholder="Ex.: 12345"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Marca"
            options={brandOptions}
            selectedIds={splitFilterValue(draftFilters.brand)}
            onChange={(value) => onDraftFilterChange("brand", joinFilterValue(value))}
            placeholder="Ex.: Michelin"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Modelo"
            options={modelOptions}
            selectedIds={splitFilterValue(draftFilters.model)}
            onChange={(value) => onDraftFilterChange("model", joinFilterValue(value))}
            placeholder="Ex.: X Multi"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Medida"
            options={sizeOptions}
            selectedIds={splitFilterValue(draftFilters.size)}
            onChange={(value) => onDraftFilterChange("size", joinFilterValue(value))}
            placeholder="Ex.: 295/80R22.5"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Estado"
            options={conditionOptions}
            selectedIds={splitFilterValue(draftFilters.condition)}
            onChange={(value) =>
              onDraftFilterChange("condition", joinFilterValue(value))
            }
            placeholder="Ex.: Bom, Atenção..."
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Veículo"
            options={vehicleOptions}
            selectedIds={splitFilterValue(draftFilters.vehicle)}
            onChange={(value) =>
              onDraftFilterChange("vehicle", joinFilterValue(value))
            }
            placeholder="Placa, marca ou modelo"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Status"
            options={statusOptions}
            selectedIds={splitFilterValue(draftFilters.status)}
            onChange={(value) =>
              onDraftFilterChange("status", joinFilterValue(value) as TireSearchFilters["status"])
            }
            placeholder="Selecione um ou mais status"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Vínculo"
            options={linkOptions}
            selectedIds={splitFilterValue(draftFilters.linkFilter)}
            onChange={(value) =>
              onDraftFilterChange("linkFilter", joinFilterValue(value))
            }
            placeholder="Selecione um ou mais vínculos"
            openOnClick
            keepOpenOnSelect
          />

          <MultiSelectField
            label="Alertas"
            options={alertOptions}
            selectedIds={splitFilterValue(draftFilters.alertFilter)}
            onChange={(value) =>
              onDraftFilterChange("alertFilter", joinFilterValue(value))
            }
            placeholder="Selecione um ou mais filtros"
            openOnClick
            keepOpenOnSelect
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSearch}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Consultar
          </button>

          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedIds.size} pneu(s) selecionado(s)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                >
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                </select>

                <button
                  type="button"
                  onClick={onOpenBulkEdit}
                  disabled={selectedIds.size === 0}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar em lote
                </button>

                <button
                  type="button"
                  onClick={onDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excluir selecionados
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-slate-500">
            {selectedIds.size === 0
              ? "Nenhum pneu selecionado"
              : selectedIds.size === 1
                ? "1 pneu selecionado"
                : `${selectedIds.size} pneus selecionados`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>

                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Série
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Marca / Modelo
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Medida
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Aro
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Posição
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Veículo vinculado
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  KM
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  Alertas
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {tires.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Nenhum pneu encontrado.
                  </td>
                </tr>
              ) : (
                tires.map((tire) => {
                  const alerts = getAlertsForTire(tire.id);

                  return (
                    <tr key={tire.id} className="border-t border-slate-200">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tire.id)}
                          onChange={() => onToggleOne(tire.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>

                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                        {tire.serialNumber}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {brandModelLabel(tire)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {tire.size || "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {tire.rim != null ? String(tire.rim) : "-"}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatPositionLabel(
                          tire.axlePosition,
                          tire.wheelPosition,
                          Boolean(tire.vehicle),
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tireStatusClass(
                            tire.status,
                          )}`}
                        >
                          {tireStatusLabel(tire.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {tireConditionLabel(tire)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {tireVehicleLabel(tire)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatNumberLabel(tire.currentKm, " km")}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {alerts.length === 0 ? (
                          <span className="text-slate-400">Sem alertas</span>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-medium text-amber-700">
                              {alerts.length} alerta(s)
                            </p>
                            <p className="max-w-xs truncate text-xs text-slate-500">
                              {alerts[0].message}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenDetails(tire)}
                            className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Detalhes
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenEdit(tire)}
                            className="rounded-xl border border-orange-200 px-3 py-2 font-semibold text-orange-700 transition hover:bg-orange-50"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          <span>
            Página {currentPage} de {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPreviousPage}
              disabled={currentPage <= 1}
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            <button
              type="button"
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}