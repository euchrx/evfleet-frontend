import type { Trip } from "../../types/trip";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import type { TripSortBy } from "./index";
import { Link } from "react-router-dom";

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

  validatingTripId: string | null;
  generatingEmergencyTripId: string | null;
  generatingMdfeTripId: string | null;
  startingTripId: string | null;

  onValidateCompliance: (trip: Trip) => void;
  onGenerateEmergencySheet: (trip: Trip) => void;
  onGenerateMdfe: (trip: Trip) => void;
  onStartTrip: (trip: Trip) => void;

  onToggleTrip: (id: string) => void;
  onToggleAllTrips: () => void;

  onOpenEditSelected: () => void;
  onOpenBulkDelete: () => void;

  onSort: (column: TripSortBy) => void;
  getSortArrow: (column: TripSortBy) => string;

  onPreviousPage: () => void;
  onNextPage: () => void;
};

function statusLabel(status: Trip["status"]) {
  const map: Record<Trip["status"], string> = {
    DRAFT: "Rascunho",
    PENDING_COMPLIANCE: "Pendente",
    BLOCKED: "Bloqueada",
    APPROVED: "Liberada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return map[status] ?? status;
}

function statusClass(status: Trip["status"]) {
  if (status === "APPROVED") return "status-active";
  if (status === "IN_PROGRESS") return "status-active";
  if (status === "BLOCKED") return "status-inactive";
  if (status === "PENDING_COMPLIANCE") return "status-pending";
  return "status-pending";
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

  validatingTripId,
  generatingEmergencyTripId,
  generatingMdfeTripId,
  startingTripId,

  onValidateCompliance,
  onGenerateEmergencySheet,
  onGenerateMdfe,
  onStartTrip,

  onToggleTrip,
  onToggleAllTrips,

  onOpenEditSelected,
  onOpenBulkDelete,

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
                <th className="w-12 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={allTripsOnPageSelected}
                    onChange={onToggleAllTrips}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Veículo
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Rota
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Status
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando viagens...
                  </td>
                </tr>
              ) : searchLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Consultando viagens...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhuma viagem encontrada.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => {
                  const hasProducts = Boolean(trip.products?.length);

                  return (
                    <tr key={trip.id} className="border-t border-slate-200">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedTripIds.includes(trip.id)}
                          onChange={() => onToggleTrip(trip.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {trip.vehicle
                          ? formatVehicleLabel(trip.vehicle)
                          : trip.vehicleId}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {trip.origin} → {trip.destination}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`status-pill ${statusClass(trip.status)}`}>
                          {statusLabel(trip.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4">

                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/trips/${trip.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Detalhes
                          </Link>
                          <button
                            type="button"
                            onClick={() => onValidateCompliance(trip)}
                            disabled={validatingTripId === trip.id}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {validatingTripId === trip.id
                              ? "Validando..."
                              : "Validar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => onGenerateEmergencySheet(trip)}
                            disabled={generatingEmergencyTripId === trip.id}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {generatingEmergencyTripId === trip.id
                              ? "Gerando..."
                              : "Ficha"}
                          </button>

                          <button
                            type="button"
                            onClick={() => onGenerateMdfe(trip)}
                            disabled={generatingMdfeTripId === trip.id || !hasProducts}
                            title={
                              !hasProducts
                                ? "Adicione produtos/carga antes de gerar MDF-e."
                                : undefined
                            }
                            className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {generatingMdfeTripId === trip.id
                              ? "Gerando..."
                              : "MDF-e"}
                          </button>

                          <button
                            type="button"
                            onClick={() => onStartTrip(trip)}
                            disabled={
                              startingTripId === trip.id ||
                              trip.status !== "APPROVED"
                            }
                            title={
                              trip.status !== "APPROVED"
                                ? "A viagem precisa estar liberada."
                                : undefined
                            }
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${trip.status === "APPROVED"
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-slate-200 text-slate-500"
                              }`}
                          >
                            {startingTripId === trip.id ? "Iniciando..." : "Iniciar"}
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

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTripsCount}
          pageSize={pageSize}
          itemLabel="viagens"
          onPrevious={onPreviousPage}
          onNext={onNextPage}
        />
      </div>
      );
}