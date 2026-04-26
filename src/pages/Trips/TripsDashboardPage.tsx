import { useEffect, useMemo, useState } from "react";
import { getTrips } from "../../services/trips";
import type { Trip } from "../../types/trip";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

function statusLabel(status: Trip["status"]) {
  const labels: Record<Trip["status"], string> = {
    DRAFT: "Rascunho",
    PENDING_COMPLIANCE: "Pendente",
    BLOCKED: "Bloqueada",
    APPROVED: "Liberada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return labels[status] || status;
}

export function TripsDashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const data = await getTrips();
      setTrips(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const pending = trips.filter((t) =>
      ["DRAFT", "PENDING_COMPLIANCE"].includes(t.status),
    ).length;

    const blocked = trips.filter((t) => t.status === "BLOCKED").length;
    const approved = trips.filter((t) => t.status === "APPROVED").length;
    const inProgress = trips.filter((t) => t.status === "IN_PROGRESS").length;
    const completed = trips.filter((t) => t.status === "COMPLETED").length;

    return { pending, blocked, approved, inProgress, completed };
  }, [trips]);

  const blockedTrips = useMemo(
    () => trips.filter((trip) => trip.status === "BLOCKED").slice(0, 8),
    [trips],
  );

  const pendingDocs = useMemo(() => {
    return trips
      .filter((trip) =>
        ["DRAFT", "PENDING_COMPLIANCE", "BLOCKED"].includes(trip.status),
      )
      .map((trip) => {
        const hasSheet = trip.generatedDocuments?.some(
          (doc) =>
            doc.type === "EMERGENCY_SHEET" &&
            ["GENERATED", "SENT"].includes(doc.status),
        );

        const hasMdfe = true;

        const missing = [
          !hasSheet ? "Ficha de emergência" : null,
          !hasMdfe ? "MDF-e" : null,
        ].filter(Boolean);

        return { trip, missing };
      })
      .filter((item) => item.missing.length > 0)
      .slice(0, 8);
  }, [trips]);

  const blockingReasons = useMemo(() => {
    const map = new Map<string, number>();

    trips.forEach((trip) => {
      const last = trip.complianceChecks?.[0];

      last?.results
        ?.filter((result) => !result.passed && result.severity === "BLOCKING")
        .forEach((result) => {
          map.set(result.title, (map.get(result.title) || 0) + 1);
        });
    });

    return [...map.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [trips]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Dashboard Operacional
        </h1>
        <p className="text-sm text-slate-500">
          Visão rápida de viagens, bloqueios e pendências de liberação.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Em liberação" value={summary.pending} tone="yellow" />
        <MetricCard title="Bloqueadas" value={summary.blocked} tone="red" />
        <MetricCard title="Liberadas" value={summary.approved} tone="green" />
        <MetricCard title="Em andamento" value={summary.inProgress} tone="blue" />
        <MetricCard title="Concluídas" value={summary.completed} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Viagens bloqueadas">
          {blockedTrips.length === 0 ? (
            <EmptyText>Nenhuma viagem bloqueada.</EmptyText>
          ) : (
            <div className="space-y-3">
              {blockedTrips.map((trip) => (
                <TripRow key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Documentos pendentes">
          {pendingDocs.length === 0 ? (
            <EmptyText>Nenhuma pendência documental.</EmptyText>
          ) : (
            <div className="space-y-3">
              {pendingDocs.map(({ trip, missing }) => (
                <div
                  key={trip.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <TripRow trip={trip} />
                  <p className="mt-2 text-xs text-red-600">
                    Pendentes: {missing.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Motivos de bloqueio">
          {blockingReasons.length === 0 ? (
            <EmptyText>Nenhum bloqueio registrado.</EmptyText>
          ) : (
            <div className="space-y-2">
              {blockingReasons.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-700">{item.title}</span>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "yellow" | "red" | "green" | "blue" | "slate";
}) {
  const classes = {
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-green-200 bg-green-50 text-green-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-white text-slate-900",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-sm">
      <p className="font-semibold text-slate-800">
        {trip.origin} → {trip.destination}
      </p>
      <p className="text-xs text-slate-500">
        {trip.vehicle ? formatVehicleLabel(trip.vehicle) : trip.vehicleId}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-600">
        {statusLabel(trip.status)}
      </p>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}