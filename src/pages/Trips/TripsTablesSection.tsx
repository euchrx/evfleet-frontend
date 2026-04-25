import type { Trip } from "../../types/trip";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import type { TripSortBy } from "./index";
import { QuickStatusAction } from "../../components/QuickStatusAction";

type Props = {
  loading: boolean;
  searchLoading: boolean;
  trips: Trip[];
  filteredTripsCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  selectedTripIds: string[];
  allTripsOnPageSelected: boolean;
  quickStatusTripId: string | null;
  onQuickTripStatusChange: (trip: Trip, status: Trip["status"]) => void;
  onToggleTrip: (id: string) => void;
  onToggleAllTrips: () => void;
  onOpenEditSelected: () => void;
  onOpenBulkDelete: () => void;
  onSort: (column: TripSortBy) => void;
  getSortArrow: (column: TripSortBy) => string;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

function parseLocalDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
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

function toDateText(value?: string | null) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function statusLabel(status: Trip["status"]) {
  if (status === "OPEN") return "Aberta";
  if (status === "COMPLETED") return "Concluída";
  return "Cancelada";
}

function statusClass(status: Trip["status"]) {
  if (status === "OPEN") return "status-pending";
  if (status === "COMPLETED") return "status-active";
  return "status-inactive";
}

export function TripsTablesSection({
  loading,
  searchLoading,
  trips,
  filteredTripsCount,
  currentPage,
  totalPages,
  pageSize,
  selectedTripIds,
  allTripsOnPageSelected,
  quickStatusTripId,
  onQuickTripStatusChange,
  onToggleTrip,
  onToggleAllTrips,
  onOpenEditSelected,
  onOpenBulkDelete,
  onSort,
  getSortArrow,
  onPreviousPage,
  onNextPage,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4">
        {selectedTripIds.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">
                {selectedTripIds.length} viagem(ns) selecionada(s)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenEditSelected}
                disabled={selectedTripIds.length !== 1}
                title={
                  selectedTripIds.length > 1
                    ? "Você pode editar apenas 1 viagem selecionada"
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
              {filteredTripsCount} viagem(ns) encontrada(s).
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
                  checked={allTripsOnPageSelected}
                  onChange={onToggleAllTrips}
                  aria-label="Selecionar viagens da página"
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                />
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("vehicle")} className="cursor-pointer">
                  Veículo {getSortArrow("vehicle")}
                </button>
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("driver")} className="cursor-pointer">
                  Motorista {getSortArrow("driver")}
                </button>
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("origin")} className="cursor-pointer">
                  Rota {getSortArrow("origin")}
                </button>
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("departureAt")} className="cursor-pointer">
                  Data de saída {getSortArrow("departureAt")}
                </button>
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("returnAt")} className="cursor-pointer">
                  Data de retorno {getSortArrow("returnAt")}
                </button>
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("kmDriven")} className="cursor-pointer">
                  KM rodados {getSortArrow("kmDriven")}
                </button>
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                <button type="button" onClick={() => onSort("status")} className="cursor-pointer">
                  Status {getSortArrow("status")}
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                  Carregando viagens...
                </td>
              </tr>
            ) : searchLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                  Consultando viagens...
                </td>
              </tr>
            ) : filteredTripsCount === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                  Nenhuma viagem encontrada.
                </td>
              </tr>
            ) : (
              trips.map((trip) => (
                <tr
                  key={trip.id}
                  className={`border-t border-slate-200 ${selectedTripIds.includes(trip.id) ? "bg-slate-50" : ""
                    }`}
                >
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedTripIds.includes(trip.id)}
                      onChange={() => onToggleTrip(trip.id)}
                      aria-label={`Selecionar viagem ${trip.origin} para ${trip.destination}`}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                    />
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {trip.vehicle ? formatVehicleLabel(trip.vehicle) : trip.vehicleId}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {trip.driver?.name || "Sem motorista"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    <span className="font-medium">{trip.origin}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    {trip.destination}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {toDateText(trip.departureAt)}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {toDateText(trip.returnAt)}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {trip.returnKm
                      ? Math.max(trip.returnKm - trip.departureKm, 0).toLocaleString("pt-BR")
                      : "-"}{" "}
                    km
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`status-pill ${statusClass(trip.status)}`}>
                        {statusLabel(trip.status)}
                      </span>

                      <QuickStatusAction
                        label="Alterar status"
                        loading={quickStatusTripId === trip.id}
                        options={[
                          { value: "OPEN", label: "Marcar como aberta" },
                          { value: "COMPLETED", label: "Marcar como concluída" },
                          { value: "CANCELLED", label: "Marcar como cancelada" },
                        ].filter((option) => option.value !== trip.status)}
                        onSelect={(value) =>
                          onQuickTripStatusChange(trip, value as Trip["status"])
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredTripsCount > 0 ? (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTripsCount}
          pageSize={pageSize}
          itemLabel="viagens"
          onPrevious={onPreviousPage}
          onNext={onNextPage}
        />
      ) : null}
    </div>
  );
}