export type BulkEditTiresForm = {
  brand: string;
  model: string;
  size: string;
  purchaseCost: string;
  currentKm: string;
  targetPressurePsi: string;
  status: "" | "IN_STOCK" | "INSTALLED" | "MAINTENANCE" | "SCRAPPED";
};

type BulkEditTiresModalProps = {
  open: boolean;
  selectedCount: number;
  form: BulkEditTiresForm;
  saving: boolean;
  onClose: () => void;
  onChange: (updater: (current: BulkEditTiresForm) => BulkEditTiresForm) => void;
  onSubmit: () => void;
};

function updateField(
  onChange: BulkEditTiresModalProps["onChange"],
  field: keyof BulkEditTiresForm,
  value: string,
) {
  onChange((current) => ({
    ...current,
    [field]: value,
  }));
}

export function BulkEditTiresModal({
  open,
  selectedCount,
  form,
  saving,
  onClose,
  onChange,
  onSubmit,
}: BulkEditTiresModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Edição em lote</h2>
            <p className="mt-1 text-sm text-slate-500">
              Editando {selectedCount} pneu(s). Deixe vazio o que não quiser alterar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Marca</span>
            <input
              value={form.brand}
              onChange={(event) => updateField(onChange, "brand", event.target.value)}
              placeholder="Ex.: Goodyear"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Modelo</span>
            <input
              value={form.model}
              onChange={(event) => updateField(onChange, "model", event.target.value)}
              placeholder="Ex.: KMax"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Medida</span>
            <input
              value={form.size}
              onChange={(event) => updateField(onChange, "size", event.target.value)}
              placeholder="Ex.: 295/80 R22.5"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <select
              value={form.status}
              onChange={(event) => updateField(onChange, "status", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Não alterar</option>
              <option value="IN_STOCK">Em estoque</option>
              <option value="INSTALLED">Instalado</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="SCRAPPED">Descartado</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Custo de compra</span>
            <input
              value={form.purchaseCost}
              onChange={(event) => updateField(onChange, "purchaseCost", event.target.value)}
              placeholder="Ex.: 1850"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">KM atual</span>
            <input
              value={form.currentKm}
              onChange={(event) => updateField(onChange, "currentKm", event.target.value)}
              placeholder="Ex.: 25000"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Pressão alvo (PSI)</span>
            <input
              value={form.targetPressurePsi}
              onChange={(event) =>
                updateField(onChange, "targetPressurePsi", event.target.value)
              }
              placeholder="Ex.: 110"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Aplicar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
