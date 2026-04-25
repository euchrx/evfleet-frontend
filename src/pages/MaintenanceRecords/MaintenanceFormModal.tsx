import type { MaintenanceRecord } from "../../types/maintenance-record";
import type { Vehicle } from "../../types/vehicle";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

export type MaintenanceRecordFormData = {
  vehicleId: string;
  type: "PREVENTIVE" | "CORRECTIVE" | "PERIODIC";
  description: string;
  partsReplaced: string;
  workshop: string;
  responsible: string;
  cost: string;
  km: string;
  maintenanceDate: string;
  status: "OPEN" | "DONE";
  notes: string;
};

export type MaintenanceRecordFieldErrors = Partial<
  Record<keyof MaintenanceRecordFormData, string>
>;

type MaintenanceRecordFormModalProps = {
  isOpen: boolean;
  editingRecord: MaintenanceRecord | null;
  vehicles: Vehicle[];
  currentCompanyName?: string | null;
  form: MaintenanceRecordFormData;
  setForm: React.Dispatch<React.SetStateAction<MaintenanceRecordFormData>>;
  fieldErrors: MaintenanceRecordFieldErrors;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  clearFieldError: (field: keyof MaintenanceRecordFormData) => void;
  getFieldClass: (field: keyof MaintenanceRecordFormData, extra?: string) => string;
};

export function initialMaintenanceRecordForm(
  vehicleId = "",
): MaintenanceRecordFormData {
  return {
    vehicleId,
    type: "PREVENTIVE",
    description: "",
    partsReplaced: "",
    workshop: "",
    responsible: "",
    cost: "",
    km: "",
    maintenanceDate: new Date().toLocaleDateString("en-CA"),
    status: "OPEN",
    notes: "",
  };
}

export function maintenanceRecordToForm(
  record: MaintenanceRecord,
): MaintenanceRecordFormData {
  return {
    vehicleId: record.vehicleId || "",
    type: (record.type as MaintenanceRecordFormData["type"]) || "PREVENTIVE",
    description: record.description || "",
    partsReplaced: Array.isArray(record.partsReplaced)
      ? record.partsReplaced.join(", ")
      : "",
    workshop: record.workshop || "",
    responsible: record.responsible || "",
    cost: String(record.cost || "").replace(".", ","),
    km: String(record.km || ""),
    maintenanceDate: String(record.maintenanceDate || "").slice(0, 10),
    status: (record.status as MaintenanceRecordFormData["status"]) || "OPEN",
    notes: record.notes || "",
  };
}

function formatMoneyInput(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MaintenanceRecordFormModal({
  isOpen,
  editingRecord,
  vehicles,
  currentCompanyName,
  form,
  setForm,
  fieldErrors,
  saving,
  onClose,
  onSubmit,
  clearFieldError,
  getFieldClass,
}: MaintenanceRecordFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
      <div className="relative mx-auto my-4 flex h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl md:my-6 md:h-[calc(100dvh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {editingRecord ? "Editar manutenção" : "Registrar manutenção"}
            </h2>
            <p className="text-sm text-slate-500">
              Preencha os dados da manutenção realizada ou pendente.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 space-y-5 overflow-y-auto px-6 pt-6">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Identificação
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Empresa</span>
                <input
                  value={currentCompanyName || "Empresa não selecionada"}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Veículo</span>
                <select
                  value={form.vehicleId}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, vehicleId: event.target.value }));
                    clearFieldError("vehicleId");
                  }}
                  className={getFieldClass("vehicleId")}
                >
                  <option value="">Selecione o veículo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {formatVehicleLabel(vehicle)}
                    </option>
                  ))}
                </select>
                {fieldErrors.vehicleId ? (
                  <p className="text-xs text-red-600">{fieldErrors.vehicleId}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Tipo</span>
                <select
                  value={form.type}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      type: event.target.value as MaintenanceRecordFormData["type"],
                    }));
                    clearFieldError("type");
                  }}
                  className={getFieldClass("type")}
                >
                  <option value="PREVENTIVE">Preventiva</option>
                  <option value="CORRECTIVE">Corretiva</option>
                  <option value="PERIODIC">Periódica</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as MaintenanceRecordFormData["status"],
                    }));
                    clearFieldError("status");
                  }}
                  className={getFieldClass("status")}
                >
                  <option value="OPEN">Pendente</option>
                  <option value="DONE">Concluída</option>
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Descrição</span>
                <input
                  value={form.description}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, description: event.target.value }));
                    clearFieldError("description");
                  }}
                  className={getFieldClass("description")}
                  placeholder="Ex: Troca de óleo e filtros"
                />
                {fieldErrors.description ? (
                  <p className="text-xs text-red-600">{fieldErrors.description}</p>
                ) : null}
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Execução e custo
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Data</span>
                <input
                  type="date"
                  value={form.maintenanceDate}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, maintenanceDate: event.target.value }));
                    clearFieldError("maintenanceDate");
                  }}
                  className={getFieldClass("maintenanceDate")}
                />
                {fieldErrors.maintenanceDate ? (
                  <p className="text-xs text-red-600">{fieldErrors.maintenanceDate}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">KM</span>
                <input
                  value={form.km}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      km: event.target.value.replace(/\D/g, ""),
                    }));
                    clearFieldError("km");
                  }}
                  className={getFieldClass("km")}
                  placeholder="Ex: 120000"
                  inputMode="numeric"
                />
                {fieldErrors.km ? (
                  <p className="text-xs text-red-600">{fieldErrors.km}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Custo</span>
                <input
                  value={form.cost}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      cost: formatMoneyInput(event.target.value),
                    }));
                    clearFieldError("cost");
                  }}
                  className={getFieldClass("cost")}
                  placeholder="0,00"
                  inputMode="numeric"
                />
                {fieldErrors.cost ? (
                  <p className="text-xs text-red-600">{fieldErrors.cost}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Oficina</span>
                <input
                  value={form.workshop}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, workshop: event.target.value }))
                  }
                  className={getFieldClass("workshop")}
                  placeholder="Ex: Oficina Central"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Responsável</span>
                <input
                  value={form.responsible}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, responsible: event.target.value }))
                  }
                  className={getFieldClass("responsible")}
                  placeholder="Ex: João"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Peças substituídas
                </span>
                <input
                  value={form.partsReplaced}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, partsReplaced: event.target.value }))
                  }
                  className={getFieldClass("partsReplaced")}
                  placeholder="Separar por vírgula"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Observações</span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className={`${getFieldClass("notes")} min-h-28`}
                  placeholder="Observações adicionais"
                />
              </label>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
            >
              {saving ? "Salvando..." : editingRecord ? "Salvar alterações" : "Cadastrar manutenção"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}