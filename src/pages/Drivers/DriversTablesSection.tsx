import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TablePagination } from "../../components/TablePagination";
import type { Driver } from "../../types/driver";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

export type DriverFilterForm = {
  branchId: string;
  name: string;
  cpf: string;
  cnh: string;
  vehicleId: string;
  status: string;
};

export type DriverSortBy = "name" | "cpf" | "documents" | "vehicle" | "status";

type SelectOption = { id: string; label: string };

type DriversTablesSectionProps = {
  currentCompanyName?: string;
  loading: boolean;
  consulting: boolean;
  hasSearched: boolean;

  draftFilters: DriverFilterForm;
  onFilterChange: <K extends keyof DriverFilterForm>(
    field: K,
    value: DriverFilterForm[K],
  ) => void;
  onConsult: () => void;
  onClearFilters: () => void;

  statusOptions: SelectOption[];
  selectedDraftStatusIds: string[];

  nameOptions: SelectOption[];
  selectedDraftNameIds: string[];

  vehicleSelectOptions: SelectOption[];
  selectedDraftVehicleIds: string[];

  filteredDrivers: Driver[];
  paginatedDrivers: Driver[];
  selectedDriverIds: string[];
  onToggleDriverSelection: (driverId: string) => void;
  onToggleSelectAllDriversOnPage: () => void;
  allDriversOnPageSelected: boolean;

  onSort: (column: DriverSortBy) => void;
  getSortArrow: (column: DriverSortBy) => string;

  driverDocumentCountByDriverId: Map<string, number>;

  currentPage: number;
  totalPages: number;
  tablePageSize: number;
  onPreviousPage: () => void;
  onNextPage: () => void;

  onOpenEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => Promise<void> | void;

  onClearSelection: () => void;
  onOpenBulkDelete: () => void;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function getDriverStatusLabel(status: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "INACTIVE") return "Inativo";
  return status;
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

export function DriversTablesSection({
  currentCompanyName,
  loading,
  consulting,
  hasSearched,
  onFilterChange,
  onConsult,
  onClearFilters,
  statusOptions,
  selectedDraftStatusIds,
  nameOptions,
  selectedDraftNameIds,
  vehicleSelectOptions,
  selectedDraftVehicleIds,
  filteredDrivers,
  paginatedDrivers,
  selectedDriverIds,
  onToggleDriverSelection,
  onToggleSelectAllDriversOnPage,
  allDriversOnPageSelected,
  onSort,
  getSortArrow,
  driverDocumentCountByDriverId,
  currentPage,
  totalPages,
  tablePageSize,
  onPreviousPage,
  onNextPage,
  onOpenEdit,
  onDelete,
  onClearSelection,
  onOpenBulkDelete,
}: DriversTablesSectionProps) {
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

            <MultiSelectField
              label="Nome"
              options={nameOptions}
              selectedIds={selectedDraftNameIds}
              onChange={(value) => onFilterChange("name", value.join(","))}
              placeholder="Selecione os motoristas"
            />

            <MultiSelectField
              label="Status"
              options={statusOptions}
              selectedIds={selectedDraftStatusIds}
              onChange={(value) =>
                onFilterChange("status", value.length ? value.join(",") : "ALL")
              }
              placeholder="Selecione os status"
            />

            <MultiSelectField
              label="Veículo"
              options={vehicleSelectOptions}
              selectedIds={selectedDraftVehicleIds}
              onChange={(value) => onFilterChange("vehicleId", value.join(","))}
              placeholder="Selecione os veículos"
            />
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
              type="button"
              onClick={onConsult}
              disabled={loading}
              className="btn-ui btn-ui-primary"
            >
              Consultar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedDriverIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedDriverIds.length} motorista(s) selecionado(s)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar seleção
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
                {hasSearched
                  ? `${filteredDrivers.length} motorista(s) encontrado(s).`
                  : "Nenhum resultado carregado ainda."}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allDriversOnPageSelected}
                    onChange={onToggleSelectAllDriversOnPage}
                    disabled={!hasSearched || paginatedDrivers.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Selecionar todos os motoristas da página"
                  />
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("name")}
                    className="cursor-pointer"
                  >
                    Nome {getSortArrow("name")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("cpf")}
                    className="cursor-pointer"
                  >
                    CPF {getSortArrow("cpf")}
                  </button>
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => onSort("documents")}
                    className="cursor-pointer"
                  >
                    Documentos {getSortArrow("documents")}
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
                    onClick={() => onSort("status")}
                    className="cursor-pointer"
                  >
                    Status {getSortArrow("status")}
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
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando dados auxiliares...
                  </td>
                </tr>
              ) : consulting ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando motoristas...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum resultado carregado ainda.
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum motorista encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedDriverIds.includes(driver.id)}
                        onChange={() => onToggleDriverSelection(driver.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label={`Selecionar motorista ${driver.name}`}
                      />
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {driver.name}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatCpf(driver.cpf)}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">
                          {driverDocumentCountByDriverId.get(driver.id) || 0} documento(s)
                        </p>

                        <Link
                          to={`/vehicle-documents?tab=DRIVER&driverId=${driver.id}`}
                          className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          Ver documentos
                        </Link>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {driver.vehicle
                        ? formatVehicleLabel(driver.vehicle)
                        : "Sem veículo vinculado"}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`status-pill ${
                          driver.status === "ACTIVE"
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {getDriverStatusLabel(driver.status)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenEdit(driver)}
                          className="btn-ui btn-ui-neutral"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void onDelete(driver)}
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

        {hasSearched && filteredDrivers.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDrivers.length}
            pageSize={tablePageSize}
            itemLabel="motoristas"
            onPrevious={onPreviousPage}
            onNext={onNextPage}
          />
        ) : null}
      </section>
    </>
  );
}