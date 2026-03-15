import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBranch } from "../../contexts/BranchContext";
import { getVehicles } from "../../services/vehicles";
import {
  createMaintenanceRecord,
  getMaintenanceRecords,
  updateMaintenanceRecord,
  type CreateMaintenanceRecordInput,
} from "../../services/maintenanceRecords";
import type { Vehicle } from "../../types/vehicle";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";

type RegisterForm = {
  recordId?: string;
  vehicleId: string;
  type: string;
  description: string;
  partsReplaced: string;
  km: string;
  cost: string;
  maintenanceDate: string;
  status: string;
  workshop: string;
  responsible: string;
  notes: string;
};

const initialForm: RegisterForm = {
  vehicleId: "",
  type: "PREVENTIVE",
  description: "",
  partsReplaced: "",
  km: "",
  cost: "",
  maintenanceDate: new Date().toISOString().slice(0, 10),
  status: "OPEN",
  workshop: "",
  responsible: "",
  notes: "",
};

export function MaintenanceRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedBranchId } = useBranch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState<RegisterForm>(initialForm);

  const isEditing = Boolean(form.recordId);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [vehiclesData, recordsData] = await Promise.all([
        getVehicles(),
        getMaintenanceRecords(),
      ]);
      const nextVehicles = Array.isArray(vehiclesData) ? vehiclesData : [];
      const nextActiveVehicles = nextVehicles.filter(
        (vehicle) => vehicle.status === "ACTIVE"
      );
      const nextRecords = Array.isArray(recordsData) ? recordsData : [];
      setVehicles(nextVehicles);
      const latestKmByVehicle = resolveLatestVehicleKmMap({
        vehicles: nextVehicles,
        maintenanceRecords: nextRecords,
      });

      const vehicleIdParam = searchParams.get("vehicleId") || "";
      const recordIdParam = searchParams.get("recordId") || "";
      const editingRecord = recordIdParam
        ? nextRecords.find((record) => record.id === recordIdParam)
        : null;

      if (editingRecord) {
        setForm({
          recordId: editingRecord.id,
          vehicleId: editingRecord.vehicleId,
          type: editingRecord.type,
          description: editingRecord.description || "",
          partsReplaced: (editingRecord.partsReplaced || []).join(", "),
          km: String(editingRecord.km || ""),
          cost: String(editingRecord.cost || ""),
          maintenanceDate: String(editingRecord.maintenanceDate || "").slice(0, 10),
          status: editingRecord.status || "OPEN",
          workshop: editingRecord.workshop || "",
          responsible: editingRecord.responsible || "",
          notes: editingRecord.notes || "",
        });
        return;
      }

      const defaultVehicleId =
        vehicleIdParam ||
        (selectedBranchId
          ? nextActiveVehicles.find((vehicle) => vehicle.branchId === selectedBranchId)?.id || ""
          : nextActiveVehicles[0]?.id || "");
      const latestKm = defaultVehicleId
        ? latestKmByVehicle.get(defaultVehicleId)
        : undefined;

      setForm((prev) => ({
        ...initialForm,
        vehicleId: defaultVehicleId,
        km: typeof latestKm === "number" ? String(latestKm) : "",
        maintenanceDate: prev.maintenanceDate,
      }));
    } catch {
      setErrorMessage("Não foi possível carregar os dados para registro de manutenção.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const availableVehicles = useMemo(() => {
    const scoped = selectedBranchId
      ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId)
      : vehicles;
    const sorted = [...scoped].sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR"));

    if (isEditing && form.vehicleId) {
      return sorted.filter(
        (vehicle) => vehicle.status === "ACTIVE" || vehicle.id === form.vehicleId
      );
    }

    return sorted.filter((vehicle) => vehicle.status === "ACTIVE");
  }, [vehicles, selectedBranchId, isEditing, form.vehicleId]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === form.vehicleId) || null,
    [vehicles, form.vehicleId]
  );

  const latestKmByVehicle = useMemo(
    () => resolveLatestVehicleKmMap({ vehicles }),
    [vehicles],
  );

  function notifyHeaderNotifications() {
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  function updateField<K extends keyof RegisterForm>(field: K, value: RegisterForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    const payload: CreateMaintenanceRecordInput = {
      type: form.type,
      description: form.description.trim(),
      partsReplaced: form.partsReplaced
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      workshop: form.workshop.trim() || undefined,
      responsible: form.responsible.trim() || undefined,
      cost: Number(form.cost.replace(",", ".")) || 0,
      km: Number(form.km) || 0,
      maintenanceDate: form.maintenanceDate,
      status: form.status,
      notes: form.notes.trim() || undefined,
      vehicleId: form.vehicleId,
    };

    if (!payload.vehicleId) {
      setErrorMessage("Selecione um veículo.");
      return;
    }
    if (!payload.description) {
      setErrorMessage("Informe a descrição da manutenção.");
      return;
    }
    if (!payload.maintenanceDate) {
      setErrorMessage("Informe a data da manutenção.");
      return;
    }

    try {
      setSaving(true);
      if (form.recordId) await updateMaintenanceRecord(form.recordId, payload);
      else await createMaintenanceRecord(payload);
      notifyHeaderNotifications();
      navigate("/maintenance-records");
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : apiMessage || "Não foi possível salvar a manutenção."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {isEditing ? "Editar manutenção" : "Registrar manutenção"}
            </h1>
            <p className="text-sm text-slate-500">
              Tela exclusiva para cadastro e atualizacao de manutenção.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/maintenance-records")}
            className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Carregando...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Veículo
                <select
                  value={form.vehicleId}
                  onChange={(e) => {
                    const vehicleId = e.target.value;
                    updateField("vehicleId", vehicleId);
                    if (!isEditing) {
                      const latestKm = latestKmByVehicle.get(vehicleId);
                      updateField(
                        "km",
                        typeof latestKm === "number" ? String(latestKm) : "",
                      );
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="">Selecione</option>
                  {availableVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Tipo
                <select
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="PREVENTIVE">Preventiva</option>
                  <option value="CORRECTIVE">Corretiva</option>
                  <option value="PERIODIC">Periódica</option>
                </select>
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              Descrição
              <input
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="block text-sm text-slate-700">
              Peças trocadas (separe por virgula)
              <input
                value={form.partsReplaced}
                onChange={(e) => updateField("partsReplaced", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-sm text-slate-700">
                Data
                <input
                  type="date"
                  value={form.maintenanceDate}
                  onChange={(e) => updateField("maintenanceDate", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="text-sm text-slate-700">
                KM
                <input
                  value={form.km}
                  onChange={(e) => updateField("km", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="text-sm text-slate-700">
                Custo
                <input
                  value={form.cost}
                  onChange={(e) => updateField("cost", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="text-sm text-slate-700">
                Status
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="OPEN">Pendente</option>
                  <option value="DONE">Concluída</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Oficina
                <input
                  value={form.workshop}
                  onChange={(e) => updateField("workshop", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                />
              </label>
              <label className="text-sm text-slate-700">
                Responsavel
                <input
                  value={form.responsible}
                  onChange={(e) => updateField("responsible", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              Observacoes
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving
                  ? "Salvando..."
                  : isEditing
                  ? "Atualizar manutenção"
                  : "Registrar manutenção"}
              </button>
            </div>
          </form>

          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Resumo do veículo
            </h2>
            {selectedVehicle ? (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Placa:</span> {selectedVehicle.plate}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Modelo:</span>{" "}
                  {selectedVehicle.brand} {selectedVehicle.model}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Status:</span>{" "}
                  {selectedVehicle.status === "MAINTENANCE"
                    ? "Em manutenção"
                    : selectedVehicle.status === "SOLD"
                    ? "Vendido"
                    : "Ativo"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Combustível:</span>{" "}
                  {selectedVehicle.fuelType || "-"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Selecione um veículo para ver o resumo.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
