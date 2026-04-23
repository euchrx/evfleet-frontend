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

type LinkFilter = "ALL" | "LINKED" | "UNLINKED";

type TireSearchFilters = {
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
  linkFilter: LinkFilter;
  alertFilter: "ALL" | "ONLY_ALERTS" | "WITHOUT_ALERTS";
};

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

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-700">
            Número de série
            <input
              value={draftFilters.serialNumber}
              onChange={(event) =>
                onDraftFilterChange("serialNumber", event.target.value)
              }
              placeholder="Ex.: 12345"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            Marca
            <input
              value={draftFilters.brand}
              onChange={(event) =>
                onDraftFilterChange("brand", event.target.value)
              }
              placeholder="Ex.: Michelin"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            Modelo
            <input
              value={draftFilters.model}
              onChange={(event) =>
                onDraftFilterChange("model", event.target.value)
              }
              placeholder="Ex.: X Multi"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            Medida
            <input
              value={draftFilters.size}
              onChange={(event) =>
                onDraftFilterChange("size", event.target.value)
              }
              placeholder="Ex.: 295/80R22.5"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            Estado
            <input
              value={draftFilters.condition}
              onChange={(event) =>
                onDraftFilterChange("condition", event.target.value)
              }
              placeholder="Ex.: Bom, Atenção..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            Veículo
            <input
              value={draftFilters.vehicle}
              onChange={(event) =>
                onDraftFilterChange("vehicle", event.target.value)
              }
              placeholder="Placa, marca ou modelo"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="text-sm text-slate-700">
            Status
            <select
              value={draftFilters.status}
              onChange={(event) =>
                onDraftFilterChange(
                  "status",
                  event.target.value as TireSearchFilters["status"],
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">Todos</option>
              <option value="IN_STOCK">Em estoque</option>
              <option value="INSTALLED">Instalado</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="RETREADED">Recapado</option>
              <option value="SCRAPPED">Descartado</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Vínculo
            <select
              value={draftFilters.linkFilter}
              onChange={(event) =>
                onDraftFilterChange(
                  "linkFilter",
                  event.target.value as LinkFilter,
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            >
              <option value="ALL">Todos</option>
              <option value="LINKED">Somente vinculados</option>
              <option value="UNLINKED">Somente não vinculados</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Alertas
            <select
              value={draftFilters.alertFilter}
              onChange={(event) =>
                onDraftFilterChange(
                  "alertFilter",
                  event.target.value as TireSearchFilters["alertFilter"],
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            >
              <option value="ALL">Todos</option>
              <option value="ONLY_ALERTS">Somente com alertas</option>
              <option value="WITHOUT_ALERTS">Sem alertas</option>
            </select>
          </label>
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