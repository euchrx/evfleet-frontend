import { useEffect, useMemo, useState } from "react";
import { createTrip, deleteTrip, getTrips, updateTrip } from "../../services/trips";
import { getVehicles } from "../../services/vehicles";
import { getDrivers } from "../../services/drivers";
import { useBranch } from "../../contexts/BranchContext";
import type { Trip, TripStatus } from "../../types/trip";
import type { Vehicle } from "../../types/vehicle";
import type { Driver } from "../../types/driver";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type TripFormData = {
  vehicleId: string;
  driverId: string;
  origin: string;
  destination: string;
  reason: string;
  departureKm: string;
  returnKm: string;
  departureAt: string;
  returnAt: string;
  status: TripStatus;
  notes: string;
};
type TripFieldErrors = Partial<Record<keyof TripFormData, string>>;

type TripSortBy =
  | "vehicle"
  | "driver"
  | "origin"
  | "departureAt"
  | "returnAt"
  | "kmDriven"
  | "status";

const initialForm: TripFormData = {
  vehicleId: "",
  driverId: "",
  origin: "",
  destination: "",
  reason: "",
  departureKm: "",
  returnKm: "",
  departureAt: "",
  returnAt: "",
  status: "OPEN",
  notes: "",
};
const TABLE_PAGE_SIZE = 10;

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

function toDateText(value?: string | null) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function statusLabel(status: TripStatus) {
  if (status === "OPEN") return "Aberta";
  if (status === "COMPLETED") return "Concluída";
  return "Cancelada";
}

function statusClass(status: TripStatus) {
  if (status === "OPEN") return "status-pending";
  if (status === "COMPLETED") return "status-active";
  return "status-inactive";
}

export function TripsPage() {
  const { selectedBranchId } = useBranch();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TripFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<TripSortBy>("departureAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [form, setForm] = useState<TripFormData>(initialForm);

  async function loadData() {
    try {
      setLoading(true);
      setPageErrorMessage("");
      const [tripsData, vehiclesData, driversData] = await Promise.all([
        getTrips(),
        getVehicles(),
        getDrivers(),
      ]);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
      setPageErrorMessage("Não foi possível carregar as viagens.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const availableVehicles = useMemo(() => {
    let filtered = vehicles;
    if (selectedBranchId) filtered = filtered.filter((item) => item.branchId === selectedBranchId);
    filtered = filtered.filter((item) => item.status === "ACTIVE" || item.id === form.vehicleId);
    return [...filtered].sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }));
  }, [vehicles, selectedBranchId, form.vehicleId]);

  const availableDrivers = useMemo(() => {
    let filtered = drivers;
    if (selectedBranchId) {
      filtered = filtered.filter((driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId);
    }
    filtered = filtered.filter((item) => item.status === "ACTIVE" || item.id === form.driverId);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }, [drivers, selectedBranchId, form.driverId]);

  const latestKmByVehicle = useMemo(
    () => resolveLatestVehicleKmMap({ vehicles, trips }),
    [vehicles, trips],
  );

  const filteredTrips = useMemo(() => {
    let filtered = trips;
    if (selectedBranchId) filtered = filtered.filter((trip) => trip.vehicle?.branchId === selectedBranchId);
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((trip) =>
        [
          trip.vehicle ? formatVehicleLabel(trip.vehicle) : "",
          trip.vehicle?.plate || "",
          trip.driver?.name || "",
          trip.origin,
          trip.destination,
          statusLabel(trip.status),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "vehicle") {
        const av = a.vehicle ? formatVehicleLabel(a.vehicle) : "";
        const bv = b.vehicle ? formatVehicleLabel(b.vehicle) : "";
        return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "driver") {
        return (a.driver?.name || "").localeCompare(b.driver?.name || "", "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "origin")
        return a.origin.localeCompare(b.origin, "pt-BR", {
          sensitivity: "base",
        }) * direction;
      if (sortBy === "departureAt")
        return (
          (parseLocalDate(a.departureAt)?.getTime() || 0) -
          (parseLocalDate(b.departureAt)?.getTime() || 0)
        ) * direction;
      if (sortBy === "returnAt")
        return (
          (parseLocalDate(a.returnAt)?.getTime() || 0) -
          (parseLocalDate(b.returnAt)?.getTime() || 0)
        ) * direction;
      if (sortBy === "status")
        return (
          statusLabel(a.status).localeCompare(statusLabel(b.status), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      const aKmDriven = Math.max((a.returnKm || 0) - (a.departureKm || 0), 0);
      const bKmDriven = Math.max((b.returnKm || 0) - (b.departureKm || 0), 0);
      return (aKmDriven - bKmDriven) * direction;
    });
  }, [trips, selectedBranchId, search, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTrips.length / TABLE_PAGE_SIZE)),
    [filteredTrips.length]
  );

  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredTrips.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTrips, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, sortDirection, selectedBranchId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const scoped = selectedBranchId ? trips.filter((trip) => trip.vehicle?.branchId === selectedBranchId) : trips;
    const total = scoped.length;
    const open = scoped.filter((trip) => trip.status === "OPEN").length;
    const completed = scoped.filter((trip) => trip.status === "COMPLETED").length;
    const cancelled = scoped.filter((trip) => trip.status === "CANCELLED").length;
    const totalKm = scoped.reduce((sum, trip) => sum + Math.max((trip.returnKm || 0) - trip.departureKm, 0), 0);
    return { total, open, completed, cancelled, totalKm };
  }, [trips, selectedBranchId]);

  function getSortArrow(column: TripSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function handleSort(column: TripSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function openCreateModal() {
    setEditingTrip(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(trip: Trip) {
    setEditingTrip(trip);
    setForm({
      vehicleId: trip.vehicleId,
      driverId: trip.driverId || "",
      origin: trip.origin,
      destination: trip.destination,
      reason: trip.reason || "",
      departureKm: String(trip.departureKm || ""),
      returnKm: trip.returnKm !== null && trip.returnKm !== undefined ? String(trip.returnKm) : "",
      departureAt: String(trip.departureAt).slice(0, 10),
      returnAt: trip.returnAt ? String(trip.returnAt).slice(0, 10) : "",
      status: trip.status,
      notes: trip.notes || "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingTrip(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof TripFormData>(field: K, value: TripFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function inputClass(field: keyof TripFormData) {
    if (fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  function handleVehicleChange(vehicleId: string) {
    if (editingTrip) {
      handleChange("vehicleId", vehicleId);
      return;
    }
    const latestKm = latestKmByVehicle.get(vehicleId);
    const suggestedDriver = drivers.find(
      (driver) =>
        driver.vehicleId === vehicleId &&
        (driver.status === "ACTIVE" || driver.id === form.driverId)
    );
    setForm((prev) => ({
      ...prev,
      vehicleId,
      driverId: suggestedDriver?.id || "",
      departureKm: typeof latestKm === "number" ? String(latestKm) : "",
      returnKm: "",
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setFieldErrors({});
      const payload = {
        vehicleId: form.vehicleId,
        driverId: form.driverId || null,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        reason: form.reason.trim() || undefined,
        departureKm: Number(form.departureKm),
        returnKm: form.returnKm ? Number(form.returnKm) : undefined,
        departureAt: form.departureAt,
        returnAt: form.returnAt || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };

      const nextErrors: TripFieldErrors = {};
      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione o veículo.";
      if (!payload.origin) nextErrors.origin = "Informe a origem.";
      if (!payload.destination) nextErrors.destination = "Informe o destino.";
      if (!payload.departureAt) nextErrors.departureAt = "Informe a data de saída.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      if (Number.isNaN(payload.departureKm) || payload.departureKm < 0) {
        setFieldErrors((prev) => ({ ...prev, departureKm: "KM de saída inválido." }));
        return;
      }
      if (payload.returnKm !== undefined && (Number.isNaN(payload.returnKm) || payload.returnKm < payload.departureKm)) {
        setFieldErrors((prev) => ({ ...prev, returnKm: "KM de retorno deve ser maior ou igual ao KM de saída." }));
        return;
      }

      if (editingTrip) await updateTrip(editingTrip.id, payload);
      else await createTrip(payload);

      closeModal();
      await loadData();
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
      const apiText = Array.isArray(apiMessage) ? apiMessage.join(", ") : String(apiMessage || "Não foi possível salvar a viagem.");
      setFieldErrors((prev) => ({ ...prev, origin: apiText }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(trip: Trip) {
    setTripToDelete(trip);
  }

  async function confirmDeleteTrip() {
    if (!tripToDelete) return;
    try {
      setDeletingTrip(true);
      await deleteTrip(tripToDelete.id);
      setTripToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir viagem:", error);
      setPageErrorMessage("Não foi possível excluir a viagem.");
    } finally {
      setDeletingTrip(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestão de Viagens</h1>
          <p className="text-sm text-slate-500">Controle completo de uso da frota por veículo e motorista.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
        >
          + Registrar viagem
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p><p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Abertas</p><p className="mt-1 text-2xl font-bold text-amber-800">{summary.open}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Concluidas</p><p className="mt-1 text-2xl font-bold text-emerald-800">{summary.completed}</p></div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Canceladas</p><p className="mt-1 text-2xl font-bold text-red-800">{summary.cancelled}</p></div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">KM Rodados</p><p className="mt-1 text-2xl font-bold text-blue-800">{summary.totalKm.toLocaleString("pt-BR")} km</p></div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por veículo, motorista, origem, destino ou status" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
      </div>

      {pageErrorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageErrorMessage}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("vehicle")} className="cursor-pointer">Veículo {getSortArrow("vehicle")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("driver")} className="cursor-pointer">Motorista {getSortArrow("driver")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("origin")} className="cursor-pointer">Rota {getSortArrow("origin")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("departureAt")} className="cursor-pointer">Data de saída {getSortArrow("departureAt")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("returnAt")} className="cursor-pointer">Data de retorno {getSortArrow("returnAt")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("kmDriven")} className="cursor-pointer">KM rodados {getSortArrow("kmDriven")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("status")} className="cursor-pointer">Status {getSortArrow("status")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">Carregando viagens...</td></tr> : filteredTrips.length === 0 ? <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">Nenhuma viagem encontrada.</td></tr> : paginatedTrips.map((trip) => (
                <tr key={trip.id} className="border-t border-slate-200">
                  <td className="px-6 py-4 text-sm text-slate-700">{trip.vehicle ? formatVehicleLabel(trip.vehicle) : trip.vehicleId}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{trip.driver?.name || "Sem motorista"}</td>
                  <td className="px-6 py-4 text-sm text-slate-700"><span className="font-medium">{trip.origin}</span><span className="mx-2 text-slate-400">→</span>{trip.destination}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{toDateText(trip.departureAt)}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{toDateText(trip.returnAt)}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{trip.returnKm ? Math.max(trip.returnKm - trip.departureKm, 0).toLocaleString("pt-BR") : "-"} km</td>
                  <td className="px-6 py-4 text-sm"><span className={`status-pill ${statusClass(trip.status)}`}>{statusLabel(trip.status)}</span></td>
                  <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button onClick={() => openEditModal(trip)} className="btn-ui btn-ui-neutral">Editar</button><button onClick={() => handleDelete(trip)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredTrips.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTrips.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="viagens"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingTrip ? "Editar viagem" : "Registrar viagem"}</h2>
                <p className="text-sm text-slate-500">Preencha os dados operacionais da viagem.</p>
              </div>
              <button onClick={closeModal} className="btn-ui btn-ui-neutral">Fechar</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Planejamento</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-medium text-slate-700">Veículo</label><select value={form.vehicleId} onChange={(e) => handleVehicleChange(e.target.value)} className={inputClass("vehicleId")}><option value="">Selecione um veículo</option>{availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{formatVehicleLabel(vehicle)}</option>)}</select>{fieldErrors.vehicleId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleId}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Motorista</label><select value={form.driverId} onChange={(e) => handleChange("driverId", e.target.value)} className={inputClass("driverId")}><option value="">Selecione um motorista</option>{availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select>{fieldErrors.driverId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.driverId}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Origem</label><input value={form.origin} onChange={(e) => handleChange("origin", e.target.value)} className={inputClass("origin")} placeholder="Cidade/filial de saída" />{fieldErrors.origin ? <p className="mt-1 text-xs text-red-600">{fieldErrors.origin}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Destino</label><input value={form.destination} onChange={(e) => handleChange("destination", e.target.value)} className={inputClass("destination")} placeholder="Cidade/filial de destino" />{fieldErrors.destination ? <p className="mt-1 text-xs text-red-600">{fieldErrors.destination}</p> : null}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Motivo da viagem</label><input value={form.reason} onChange={(e) => handleChange("reason", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Ex: Entrega regional" /></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Execucao</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-medium text-slate-700">Data de saída</label><input type="date" value={form.departureAt} onChange={(e) => handleChange("departureAt", e.target.value)} className={inputClass("departureAt")} />{fieldErrors.departureAt ? <p className="mt-1 text-xs text-red-600">{fieldErrors.departureAt}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Data de retorno</label><input type="date" value={form.returnAt} onChange={(e) => handleChange("returnAt", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" /></div>
                  <div><label className="block text-sm font-medium text-slate-700">KM saída</label><input type="number" min="0" value={form.departureKm} onChange={(e) => handleChange("departureKm", e.target.value)} className={inputClass("departureKm")} />{fieldErrors.departureKm ? <p className="mt-1 text-xs text-red-600">{fieldErrors.departureKm}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">KM retorno</label><input type="number" min="0" value={form.returnKm} onChange={(e) => handleChange("returnKm", e.target.value)} className={inputClass("returnKm")} />{fieldErrors.returnKm ? <p className="mt-1 text-xs text-red-600">{fieldErrors.returnKm}</p> : null}</div>
                  <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={form.status} onChange={(e) => handleChange("status", e.target.value as TripStatus)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"><option value="OPEN">Aberta</option><option value="COMPLETED">Concluída</option><option value="CANCELLED">Cancelada</option></select></div>
                  <div><label className="block text-sm font-medium text-slate-700">Observacoes</label><input value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="Opcional" /></div>
                </div>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button type="button" onClick={closeModal} className="btn-ui btn-ui-neutral">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-ui btn-ui-primary disabled:cursor-not-allowed disabled:opacity-70">{saving ? "Salvando..." : editingTrip ? "Salvar alterações" : "Registrar viagem"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ConfirmDeleteModal
        isOpen={Boolean(tripToDelete)}
        title="Excluir viagem"
        description={
          tripToDelete
            ? `Deseja excluir a viagem ${tripToDelete.origin} > ${tripToDelete.destination}?`
            : ""
        }
        loading={deletingTrip}
        onCancel={() => setTripToDelete(null)}
        onConfirm={confirmDeleteTrip}
      />
    </div>
  );
}
