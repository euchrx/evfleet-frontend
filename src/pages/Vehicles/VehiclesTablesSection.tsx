import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Link2, Pencil, Trash2 } from "lucide-react";
import { TablePagination } from "../../components/TablePagination";
import type { Branch } from "../../types/branch";
import type { Vehicle } from "../../types/vehicle";
import type { VehicleFilters } from "./useVehiclesTables";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";

type SortColumn = "plate" | "vehicle" | "type" | "status";
type ActiveTab = "vehicles" | "implements";

type VehicleWithLinkedMeta = Vehicle & {
  linkedVehicleLabel?: string;
};

type SelectOption = {
  id: string;
  label: string;
};

type VehiclesTablesSectionProps = {
  activeTab: ActiveTab;
  loading: boolean;
  hasSearched: boolean;
  branches: Branch[];
  currentCompanyName?: string;
  filtersDraft: VehicleFilters;
  onFiltersDraftChange: (field: keyof VehicleFilters, value: string) => void;
  onConsult: () => void;
  onClearFilters: () => void;

  sortBy: SortColumn;
  sortDirection: "asc" | "desc";
  toggleSort: (column: SortColumn) => void;
  getSortArrow: (column: SortColumn) => string;

  filteredVehiclesOnlyLength: number;
  filteredImplementsOnlyLength: number;

  paginatedVehiclesOnly: Vehicle[];
  paginatedImplementsOnly: Vehicle[];

  currentVehiclesPage: number;
  vehiclesTotalPages: number;
  setCurrentVehiclesPage: React.Dispatch<React.SetStateAction<number>>;

  currentImplementsPage: number;
  implementsTotalPages: number;
  setCurrentImplementsPage: React.Dispatch<React.SetStateAction<number>>;

  tablePageSize: number;

  selectedVehicleIds: string[];
  selectedCount: number;
  onOpenBulkDelete: () => void;
  onOpenCompositionImplements: (vehicle: Vehicle) => void;
  onOpenLinkedVehicle: (vehicle: Vehicle) => void;
  onOpenLinkModal: (vehicle: Vehicle) => void;

  allMainVehiclesOnPageSelected: boolean;
  allImplementsOnPageSelected: boolean;

  toggleVehicleSelection: (vehicleId: string) => void;
  toggleSelectAllMainVehiclesOnPage: () => void;
  toggleSelectAllImplementsOnPage: () => void;

  openEdit: (vehicle: Vehicle) => void;
  openHistory: (vehicle: Vehicle) => Promise<void> | void;
  onDelete: (vehicle: Vehicle) => Promise<void> | void;

  getCategoryLabel: (value?: "CAR" | "TRUCK" | "UTILITY" | "IMPLEMENT") => string;
  getVehicleTypeLabel: (value?: "LIGHT" | "HEAVY") => string;
  getStatusLabel: (value?: "ACTIVE" | "MAINTENANCE" | "SOLD") => string;
  getVehicleAxleCount: (vehicle: Vehicle) => number;
  getVehicleAxleConfiguration: (vehicle: Vehicle) => string;
};

function parseCsvValue(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCsvValue(values: string[]) {
  return values.join(",");
}

function CompactMultiSelectField({
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
    return options.filter((item) => {
      if (selectedIds.includes(item.id)) return false;
      if (!normalized) return true;
      return item.label.toLowerCase().includes(normalized);
    });
  }, [options, selectedIds, query]);

  function addItem(id: string) {
    if (disabled || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
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
            if (!disabled) setOpen(true);
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
              >
                {item.label}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!disabled) onChange(selectedIds.filter((id) => id !== item.id));
                  }}
                  className={`leading-none ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-red-600"
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
              className="min-w-[96px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
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

function getStatusClass(status?: "ACTIVE" | "MAINTENANCE" | "SOLD") {
  if (status === "ACTIVE") return "status-active";
  if (status === "MAINTENANCE") return "status-pending";
  return "status-inactive";
}

function getLinkedVehicleLabel(vehicle: Vehicle) {
  return (vehicle as VehicleWithLinkedMeta).linkedVehicleLabel || "Não vinculado";
}

function renderVehicleComposition(
  vehicle: Vehicle,
  onOpenCompositionImplements: (vehicle: Vehicle) => void,
) {
  const implementsList = (vehicle.implements ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((item) => item?.implement?.plate);

  if (implementsList.length === 0) {
    return <span className="text-sm text-slate-400">Sem implementos</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenCompositionImplements(vehicle)}
      className="group w-full rounded-2xl border border-orange-200 bg-orange-50/70 px-0 py-2 text-left transition hover:border-orange-300 hover:bg-orange-100/70"
      title="Abrir implementos desse conjunto"
    >
      <div className="flex flex-wrap justify-center gap-2">
        {implementsList.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700"
          >
            {item.implement.plate}
          </span>
        ))}
      </div>
    </button>
  );
}

function renderLinkedVehicle(
  vehicle: Vehicle,
  onOpenLinkedVehicle: (vehicle: Vehicle) => void,
) {
  const label = getLinkedVehicleLabel(vehicle);

  if (!label || label === "Não vinculado") {
    return <span className="text-sm text-slate-400">Não vinculado</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenLinkedVehicle(vehicle)}
      className="group w-full rounded-2xl border border-orange-200 bg-orange-50/70 px-0 py-2 text-left transition hover:border-orange-300 hover:bg-orange-100/70"
      title={label}
    >
      <div className="flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">
          {label}
        </span>
      </div>
    </button>
  );
}

function ActionButtons({
  vehicle,
  showLinkButton,
  onOpenLinkModal,
  onOpenHistory,
}: {
  vehicle: Vehicle;
  showLinkButton: boolean;
  onOpenLinkModal: (vehicle: Vehicle) => void;
  onOpenHistory: (vehicle: Vehicle) => Promise<void> | void;
  onOpenEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => Promise<void> | void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLinkButton ? (
        <button
          type="button"
          onClick={() => onOpenLinkModal(vehicle)}
          className="btn-ui btn-ui-neutral"
          title="Vincular implemento"
        >
          <Link2 size={16} />
          <span>Vincular</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => void onOpenHistory(vehicle)}
        className="btn-ui btn-ui-neutral !px-3"
        title="Histórico"
        aria-label={`Abrir histórico de ${vehicle.plate}`}
      >
        <Clock3 size={16} />
        <span>Histórico</span>
      </button>

    </div>
  );
}

function EmptyState({ activeTab }: { activeTab: ActiveTab }) {
  const title =
    activeTab === "vehicles"
      ? "Nenhum veículo encontrado para os filtros informados."
      : "Nenhum implemento encontrado para os filtros informados.";

  const description = "Ajuste os filtros e tente novamente para localizar os registros desejados.";

  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8">
        <p className="text-base font-semibold text-slate-700">{title}</p>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function VehiclesTablesSection({
  activeTab,
  loading,
  filtersDraft,
  onFiltersDraftChange,
  onConsult,
  onClearFilters,
  toggleSort,
  getSortArrow,
  filteredVehiclesOnlyLength,
  filteredImplementsOnlyLength,
  paginatedVehiclesOnly,
  paginatedImplementsOnly,
  currentVehiclesPage,
  vehiclesTotalPages,
  setCurrentVehiclesPage,
  currentImplementsPage,
  implementsTotalPages,
  setCurrentImplementsPage,
  tablePageSize,
  selectedVehicleIds,
  selectedCount,
  onOpenBulkDelete,
  onOpenCompositionImplements,
  onOpenLinkedVehicle,
  onOpenLinkModal,
  allMainVehiclesOnPageSelected,
  allImplementsOnPageSelected,
  toggleVehicleSelection,
  toggleSelectAllMainVehiclesOnPage,
  toggleSelectAllImplementsOnPage,
  openEdit,
  openHistory,
  onDelete,
  getCategoryLabel,
  getVehicleTypeLabel,
  getStatusLabel,
  getVehicleAxleCount,
  getVehicleAxleConfiguration,
}: VehiclesTablesSectionProps) {
  const { currentCompany } = useCompanyScope();

  const selectedLabel = activeTab === "vehicles" ? "veículo(s)" : "implemento(s)";
  const totalItems =
    activeTab === "vehicles" ? filteredVehiclesOnlyLength : filteredImplementsOnlyLength;

  const vehicleTypeOptions: SelectOption[] = [
    { id: "LIGHT", label: "Leve" },
    { id: "HEAVY", label: "Pesado" },
  ];

  const categoryOptions: SelectOption[] = [
    { id: "CAR", label: "Carro" },
    { id: "TRUCK", label: "Caminhão" },
    { id: "UTILITY", label: "Utilitário" },
    { id: "IMPLEMENT", label: "Implemento" },
  ];

  const statusOptions: SelectOption[] = [
    { id: "ACTIVE", label: "Ativo" },
    { id: "MAINTENANCE", label: "Manutenção" },
    { id: "SOLD", label: "Vendido" },
  ];

  const selectedVehicleTypes = parseCsvValue(filtersDraft.vehicleType).filter(
    (item) => item !== "ALL",
  );
  const selectedCategories = parseCsvValue(filtersDraft.category).filter((item) => item !== "ALL");
  const selectedStatuses = parseCsvValue(filtersDraft.status).filter((item) => item !== "ALL");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Empresa
              </label>
              <input
                type="text"
                value={currentCompany?.name || "Empresa não selecionada"}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Placa
              </label>
              <input
                value={filtersDraft.plate}
                onChange={(e) => onFiltersDraftChange("plate", e.target.value)}
                placeholder="Digite a placa"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Marca
              </label>
              <input
                value={filtersDraft.brand}
                onChange={(e) => onFiltersDraftChange("brand", e.target.value)}
                placeholder="Digite a marca"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Modelo
              </label>
              <input
                value={filtersDraft.model}
                onChange={(e) => onFiltersDraftChange("model", e.target.value)}
                placeholder="Digite o modelo"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </div>

            {activeTab === "vehicles" ? (
              <>
                <CompactMultiSelectField
                  label="Tipo de peso"
                  options={vehicleTypeOptions}
                  selectedIds={selectedVehicleTypes}
                  onChange={(value) => onFiltersDraftChange("vehicleType", toCsvValue(value))}
                  placeholder="Selecione os tipos"
                />

                <CompactMultiSelectField
                  label="Categoria"
                  options={categoryOptions}
                  selectedIds={selectedCategories}
                  onChange={(value) => onFiltersDraftChange("category", toCsvValue(value))}
                  placeholder="Selecione as categorias"
                />
              </>
            ) : null}

            <CompactMultiSelectField
              label="Status"
              options={statusOptions}
              selectedIds={selectedStatuses}
              onChange={(value) => onFiltersDraftChange("status", toCsvValue(value))}
              placeholder="Selecione os status"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-start">
            <button type="button" onClick={onClearFilters} className="btn-ui btn-ui-neutral">
              Limpar filtros
            </button>
            <button type="button" onClick={onConsult} className="btn-ui btn-ui-primary">
              Consultar
            </button>
          </div>
        </div>
      </section >

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          {selectedCount > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {selectedCount} {selectedLabel} selecionado(s)
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
              <p className="text-sm text-slate-600">{totalItems} registro(s) encontrado(s).</p>
            </div>
          )}
        </div>

        {activeTab === "vehicles" ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-12 px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={allMainVehiclesOnPageSelected}
                        onChange={toggleSelectAllMainVehiclesOnPage}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label="Selecionar veículos da página"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("plate")}
                        className="inline-flex cursor-pointer items-center gap-1 transition hover:text-slate-900"
                      >
                        Placa <span className="text-xs">{getSortArrow("plate")}</span>
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("vehicle")}
                        className="inline-flex cursor-pointer items-center gap-1 transition hover:text-slate-900"
                      >
                        Veículo <span className="text-xs">{getSortArrow("vehicle")}</span>
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("type")}
                        className="inline-flex cursor-pointer items-center gap-1 transition hover:text-slate-900"
                      >
                        Tipo <span className="text-xs">{getSortArrow("type")}</span>
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Eixos
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Configuração
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Conjunto
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="inline-flex cursor-pointer items-center gap-1 transition hover:text-slate-900"
                      >
                        Status <span className="text-xs">{getSortArrow("status")}</span>
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
                      <td colSpan={9} className="px-6 py-8 text-center text-sm text-slate-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredVehiclesOnlyLength === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8">
                        <EmptyState activeTab={activeTab} />
                      </td>
                    </tr>
                  ) : (
                    paginatedVehiclesOnly.map((vehicle) => (
                      <tr key={vehicle.id} className="border-t border-slate-200">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedVehicleIds.includes(vehicle.id)}
                            onChange={() => toggleVehicleSelection(vehicle.id)}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                            aria-label={`Selecionar veículo ${vehicle.plate}`}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {vehicle.plate}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {vehicle.brand} {vehicle.model}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getCategoryLabel(vehicle.category)} | {getVehicleTypeLabel(vehicle.vehicleType)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getVehicleAxleCount(vehicle)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getVehicleAxleConfiguration(vehicle)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {renderVehicleComposition(vehicle, onOpenCompositionImplements)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`status-pill ${getStatusClass(vehicle.status)}`}>
                            {getStatusLabel(vehicle.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <ActionButtons
                            vehicle={vehicle}
                            showLinkButton
                            onOpenLinkModal={onOpenLinkModal}
                            onOpenHistory={openHistory}
                            onOpenEdit={openEdit}
                            onDelete={onDelete}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredVehiclesOnlyLength > 0 ? (
              <TablePagination
                currentPage={currentVehiclesPage}
                totalPages={vehiclesTotalPages}
                totalItems={filteredVehiclesOnlyLength}
                pageSize={tablePageSize}
                itemLabel="veículos"
                onPrevious={() => setCurrentVehiclesPage((prev) => Math.max(prev - 1, 1))}
                onNext={() =>
                  setCurrentVehiclesPage((prev) => Math.min(prev + 1, vehiclesTotalPages))
                }
              />
            ) : null}
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-12 px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={allImplementsOnPageSelected}
                        onChange={toggleSelectAllImplementsOnPage}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label="Selecionar implementos da página"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("plate")}
                        className="inline-flex cursor-pointer items-center gap-1 transition hover:text-slate-900"
                      >
                        Placa <span className="text-xs">{getSortArrow("plate")}</span>
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("vehicle")}
                        className="inline-flex cursor-pointer items-center gap-1 transition hover:text-slate-900"
                      >
                        Implemento <span className="text-xs">{getSortArrow("vehicle")}</span>
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Eixos
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Veículo vinculado
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredImplementsOnlyLength === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8">
                        <EmptyState activeTab={activeTab} />
                      </td>
                    </tr>
                  ) : (
                    paginatedImplementsOnly.map((vehicle) => (
                      <tr key={vehicle.id} className="border-t border-slate-200">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedVehicleIds.includes(vehicle.id)}
                            onChange={() => toggleVehicleSelection(vehicle.id)}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                            aria-label={`Selecionar implemento ${vehicle.plate}`}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {vehicle.plate}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {vehicle.brand} {vehicle.model}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getCategoryLabel(vehicle.category)} | {getVehicleTypeLabel(vehicle.vehicleType)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getVehicleAxleCount(vehicle)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {renderLinkedVehicle(vehicle, onOpenLinkedVehicle)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`status-pill ${getStatusClass(vehicle.status)}`}>
                            {getStatusLabel(vehicle.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <ActionButtons
                            vehicle={vehicle}
                            showLinkButton={false}
                            onOpenLinkModal={onOpenLinkModal}
                            onOpenHistory={openHistory}
                            onOpenEdit={openEdit}
                            onDelete={onDelete}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredImplementsOnlyLength > 0 ? (
              <TablePagination
                currentPage={currentImplementsPage}
                totalPages={implementsTotalPages}
                totalItems={filteredImplementsOnlyLength}
                pageSize={tablePageSize}
                itemLabel="implementos"
                onPrevious={() => setCurrentImplementsPage((prev) => Math.max(prev - 1, 1))}
                onNext={() =>
                  setCurrentImplementsPage((prev) => Math.min(prev + 1, implementsTotalPages))
                }
              />
            ) : null}
          </>
        )}
      </section>
    </div >
  );
}