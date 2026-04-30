import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateEmergencySheet,
  generateMdfe,
  getTrips,
  startTrip,
  validateTripCompliance,
} from "../../services/trips";
import { useBranch } from "../../contexts/BranchContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useStatusToast } from "../../contexts/StatusToastContext";
import type { Trip, TripStatus } from "../../types/trip";
import { formatVehicleLabel } from "../../utils/vehicleLabel";
import { Download } from "lucide-react";

type FiscalStage =
  | "ALL"
  | "MISSING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "CLOSED"
  | "CANCELED"
  | "REJECTED";

function statusLabel(status: TripStatus) {
  const labels: Record<TripStatus, string> = {
    DRAFT: "Rascunho",
    PENDING_COMPLIANCE: "Pendente",
    BLOCKED: "Bloqueada",
    APPROVED: "Liberada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return labels[status] ?? status;
}

function statusClass(status: TripStatus) {
  const map: Record<TripStatus, string> = {
    DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
    PENDING_COMPLIANCE: "border-amber-200 bg-amber-50 text-amber-700",
    BLOCKED: "border-red-200 bg-red-50 text-red-700",
    APPROVED: "border-green-200 bg-green-50 text-green-700",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
    COMPLETED: "border-slate-200 bg-slate-100 text-slate-700",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-500",
  };

  return map[status] ?? map.DRAFT;
}

function mdfeLabel(status?: string | null) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    PROCESSING: "Processando",
    AUTHORIZED: "Autorizado",
    REJECTED: "Rejeitado",
    CANCELED: "Cancelado",
    CLOSED: "Encerrado",
    ERROR: "Erro",
  };

  return status ? labels[status] || status : "Não gerado";
}

function mdfeClass(status?: string | null) {
  if (status === "AUTHORIZED") return "border-green-200 bg-green-50 text-green-700";
  if (status === "PROCESSING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "REJECTED" || status === "ERROR") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CLOSED") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "CANCELED") return "border-slate-200 bg-slate-100 text-slate-500";
  return "border-slate-200 bg-white text-slate-500";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTripFiscalStage(trip: Trip): FiscalStage {
  if (!trip.mdfe) return "MISSING";

  if (trip.mdfe.status === "PROCESSING") return "PROCESSING";
  if (trip.mdfe.status === "AUTHORIZED") return "AUTHORIZED";
  if (trip.mdfe.status === "CLOSED") return "CLOSED";
  if (trip.mdfe.status === "CANCELED") return "CANCELED";
  if (trip.mdfe.status === "REJECTED" || trip.mdfe.status === "ERROR") {
    return "REJECTED";
  }

  return "MISSING";
}

function hasEmergencySheet(trip: Trip) {
  return Boolean(
    trip.generatedDocuments?.some(
      (doc) =>
        doc.type === "EMERGENCY_SHEET" &&
        ["DRAFT", "GENERATED", "SENT"].includes(doc.status),
    ),
  );
}

function hasBlockingCompliance(trip: Trip) {
  const last = trip.complianceChecks?.[0];

  return Boolean(
    last?.results?.some(
      (result) => !result.passed && result.severity === "BLOCKING",
    ),
  );
}

function getOperationLabel(trip: Trip) {
  const fiscalStage = getTripFiscalStage(trip);

  if (trip.status === "COMPLETED") return "Finalizada";
  if (trip.status === "IN_PROGRESS") return "Em transporte";
  if (fiscalStage === "CLOSED") return "MDF-e encerrado";
  if (fiscalStage === "AUTHORIZED") return "Pronta para iniciar";
  if (trip.status === "BLOCKED" || hasBlockingCompliance(trip)) return "Bloqueada";
  if (!hasEmergencySheet(trip)) return "Aguardando ficha";
  if (fiscalStage === "MISSING") return "Aguardando MDF-e";
  if (fiscalStage === "REJECTED") return "Corrigir MDF-e";

  return "Em liberação";
}

function getOperationClass(trip: Trip) {
  const label = getOperationLabel(trip);

  if (label === "Bloqueada" || label === "Corrigir MDF-e") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (label === "Pronta para iniciar" || label === "MDF-e encerrado") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (label === "Em transporte") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function TripsPage() {
  const { selectedBranchId } = useBranch();
  const { currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTripId, setActionTripId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<
    "VALIDATE" | "SHEET" | "MDFE" | "START" | null
  >(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "ALL">("ALL");
  const [fiscalFilter, setFiscalFilter] = useState<FiscalStage>("ALL");

  async function loadTrips() {
    try {
      setLoading(true);
      const data = await getTrips();
      setTrips(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
      showToast({
        tone: "error",
        title: "Erro ao carregar viagens",
        message: "Não foi possível buscar as viagens.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    trip: Trip,
    type: "VALIDATE" | "SHEET" | "MDFE" | "START",
    callback: () => Promise<unknown>,
    successMessage: string,
  ) {
    try {
      setActionTripId(trip.id);
      setActionType(type);

      await callback();
      await loadTrips();

      showToast({
        tone: "success",
        title: "Ação concluída",
        message: successMessage,
      });
    } catch (error: any) {
      const response = error?.response?.data;

      const description = Array.isArray(response?.errors)
        ? response.errors.join("\n")
        : response?.message || error?.message || "Não foi possível concluir a ação.";

      showToast({
        tone: "error",
        title: "Atenção",
        message: description,
      });
    } finally {
      setActionTripId(null);
      setActionType(null);
    }
  }

  useEffect(() => {
    void loadTrips();
  }, []);

  const visibleTrips = useMemo(() => {
    let result = trips;

    if (selectedBranchId) {
      result = result.filter((trip) => trip.vehicle?.branchId === selectedBranchId);
    }

    if (statusFilter !== "ALL") {
      result = result.filter((trip) => trip.status === statusFilter);
    }

    if (fiscalFilter !== "ALL") {
      result = result.filter((trip) => getTripFiscalStage(trip) === fiscalFilter);
    }

    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch) {
      result = result.filter((trip) => {
        const vehicleLabel = trip.vehicle
          ? formatVehicleLabel(trip.vehicle)
          : trip.vehicleId;

        return [
          trip.origin,
          trip.destination,
          trip.driver?.name,
          vehicleLabel,
          trip.mdfe?.accessKey,
          trip.mdfe?.protocol,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
    }

    return [...result].sort((a, b) => {
      const aTime = new Date(a.departureAt).getTime() || 0;
      const bTime = new Date(b.departureAt).getTime() || 0;

      return bTime - aTime;
    });
  }, [trips, selectedBranchId, statusFilter, fiscalFilter, search]);

  const summary = useMemo(() => {
    const total = visibleTrips.length;
    const blocked = visibleTrips.filter(
      (trip) => trip.status === "BLOCKED" || hasBlockingCompliance(trip),
    ).length;
    const ready = visibleTrips.filter(
      (trip) => trip.status === "APPROVED" && trip.mdfe?.status === "AUTHORIZED",
    ).length;
    const inProgress = visibleTrips.filter(
      (trip) => trip.status === "IN_PROGRESS",
    ).length;
    const missingMdfe = visibleTrips.filter(
      (trip) => getTripFiscalStage(trip) === "MISSING",
    ).length;
    const openMdfe = visibleTrips.filter(
      (trip) => trip.mdfe?.status === "AUTHORIZED",
    ).length;

    return {
      total,
      blocked,
      ready,
      inProgress,
      missingMdfe,
      openMdfe,
    };
  }, [visibleTrips]);

  return (
    <div className="min-w-0 space-y-6 p-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                Gestão operacional
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Dashboard
              </h1>
            </div>

            <div className="flex gap-3">
              <Link
                to="/trips"
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-orange-600"
              >
                Lista de viagens concluídas
              </Link>

              <Link
                to="/trips/new"
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-orange-600"
              >
                + Nova viagem
              </Link>
            </div>

          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Total" value={summary.total} tone="slate" />
          <MetricCard label="Bloqueadas" value={summary.blocked} tone="red" />
          <MetricCard label="Sem MDF-e" value={summary.missingMdfe} tone="amber" />
          <MetricCard label="MDF-e aberto" value={summary.openMdfe} tone="purple" />
          <MetricCard label="Prontas" value={summary.ready} tone="green" />
          <MetricCard label="Em transporte" value={summary.inProgress} tone="blue" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Buscar
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Placa, motorista, origem, destino, chave MDF-e..."
              className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status viagem
            </span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TripStatus | "ALL")
              }
              className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PENDING_COMPLIANCE">Pendente</option>
              <option value="BLOCKED">Bloqueada</option>
              <option value="APPROVED">Liberada</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status fiscal
            </span>
            <select
              value={fiscalFilter}
              onChange={(event) => setFiscalFilter(event.target.value as FiscalStage)}
              className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos</option>
              <option value="MISSING">Sem MDF-e</option>
              <option value="PROCESSING">Processando</option>
              <option value="AUTHORIZED">Autorizado</option>
              <option value="CLOSED">Encerrado</option>
              <option value="CANCELED">Cancelado</option>
              <option value="REJECTED">Rejeitado/erro</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm">

        <div className="w-full overflow-visible">
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50 text-sm font-semibold text-slate-600">
              <tr>
                <th className="w-[22%] px-5 py-3 font-semibold">Viagem</th>
                <th className="w-[18%] px-5 py-3 font-semibold">Veículo</th>
                <th className="w-[18%] px-5 py-3 font-semibold">Motorista</th>
                <th className="w-[13%] px-5 py-3 font-semibold">Documentação</th>
                <th className="w-[8%] px-5 py-3 font-semibold">Status da viagem</th>
                <th className="w-[20%] px-5 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-t border-slate-200">
                    <td className="px-5 py-4" colSpan={6}>
                      <div className="h-8 animate-pulse rounded-xl bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : visibleTrips.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                    Nenhuma viagem encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                visibleTrips.map((trip) => {
                  const sheetOk = hasEmergencySheet(trip);
                  const fiscalStage = getTripFiscalStage(trip);
                  const hasProducts = Boolean(trip.products?.length);
                  const actionLoading = actionTripId === trip.id;

                  return (
                    <tr key={trip.id} className="border-t border-slate-200 align-top">
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {trip.origin} → {trip.destination}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>
                          <p className="font-medium text-slate-900">
                            {trip.vehicle ? formatVehicleLabel(trip.vehicle) : trip.vehicleId}
                          </p>

                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {trip.driver?.name || "-"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm">
                        <span
                          className={`status-pill ${hasProducts &&
                            sheetOk &&
                            !hasBlockingCompliance(trip) &&
                            fiscalStage !== "MISSING"
                            ? "status-active"
                            : "status-inactive"
                            }`}
                        >
                          {hasProducts &&
                            sheetOk &&
                            !hasBlockingCompliance(trip) &&
                            fiscalStage !== "MISSING"
                            ? "OK"
                            : "Inadimplente"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm">
                        <div className="flex items-center">
                          <span className={`status-pill w-fit ${statusClass(trip.status)}`}>
                            {statusLabel(trip.status)}
                          </span>

                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Link
                            to={`/trips/${trip.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Abrir
                          </Link>

                          <Link
                            to={`/trips/${trip.id}/edit`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Editar
                          </Link>

                          <div className="relative group">
                            <button
                              type="button"
                              disabled={!sheetOk && !trip.mdfe}
                              title="Baixar arquivos"
                              aria-label="Baixar arquivos"
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Download size={16} />
                            </button>

                            <div className="invisible absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">                              <Link
                              to={`/trips/${trip.id}`}
                              className={`block rounded-xl px-3 py-2 text-xs font-semibold transition ${sheetOk
                                ? "text-slate-700 hover:bg-slate-50"
                                : "pointer-events-none text-slate-400 opacity-50"
                                }`}
                            >
                              Ficha de emergência
                            </Link>

                              <Link
                                to={`/trips/${trip.id}`}
                                className={`block rounded-xl px-3 py-2 text-xs font-semibold transition ${trip.mdfe?.accessKey
                                  ? "text-slate-700 hover:bg-slate-50"
                                  : "pointer-events-none text-slate-400 opacity-50"
                                  }`}
                              >
                                XML MDF-e
                              </Link>

                              <Link
                                to={`/trips/${trip.id}`}
                                className={`block rounded-xl px-3 py-2 text-xs font-semibold transition ${trip.mdfe?.accessKey
                                  ? "text-slate-700 hover:bg-slate-50"
                                  : "pointer-events-none text-slate-400 opacity-50"
                                  }`}
                              >
                                DAMDFE
                              </Link>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              runAction(
                                trip,
                                "START",
                                () => startTrip(trip.id),
                                "Viagem iniciada.",
                              )
                            }
                            disabled={actionLoading || trip.status !== "APPROVED"}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${trip.status === "APPROVED"
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-slate-200 text-slate-500"
                              }`}
                          >
                            {actionLoading && actionType === "START"
                              ? "Iniciando..."
                              : "Iniciar"}
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
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "red" | "amber" | "green" | "blue" | "purple";
}) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-green-200 bg-green-50 text-green-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    purple: "border-purple-200 bg-purple-50 text-purple-800",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${classes[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MiniPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}
    >
      {ok ? "✓" : "!"} {label}
    </span>
  );
}

function DocumentLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p
      className={`text-xs font-semibold ${ok ? "text-green-700" : "text-red-600"
        }`}
    >
      {ok ? "✓" : "•"} {label}
    </p>
  );
}