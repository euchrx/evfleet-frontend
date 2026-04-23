import type { TireStatus } from "../../../types/tire";
import type { EditTireForm } from "../helpers";
import { normalizeTireSize } from "../helpers";

type Props = {
  open: boolean;
  form: EditTireForm | null;
  editing: boolean;
  msgError: string | null;
  onClose: () => void;
  onChange: (updater: (current: EditTireForm) => EditTireForm) => void;
  onSubmit: () => void;
};

function inputClass() {
  return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
}

export function EditTireModal({
  open,
  form,
  editing,
  msgError,
  onClose,
  onChange,
  onSubmit,
}: Props) {
  if (!open || !form) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Editar pneu</h2>
            <p className="text-sm text-slate-500">
              Atualize os dados do pneu mantendo o histórico consistente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Identificação
            </h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Número de série
                </label>
                <input
                  value={form.serialNumber}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      serialNumber: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Marca</label>
                <input
                  value={form.brand}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, brand: event.target.value }))
                  }
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Modelo</label>
                <input
                  value={form.model}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, model: event.target.value }))
                  }
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Medida</label>
                <input
                  value={form.size}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      size: normalizeTireSize(event.target.value),
                    }))
                  }
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      status: event.target.value as TireStatus,
                    }))
                  }
                  className={inputClass()}
                >
                  <option value="IN_STOCK">Em estoque</option>
                  <option value="INSTALLED">Instalado</option>
                  <option value="MAINTENANCE">Manutenção</option>
                  <option value="RETREADED">Recapado</option>
                  <option value="SCRAPPED">Descartado</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Operacional
            </h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">KM atual</label>
                <input
                  value={form.currentKm}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, currentKm: event.target.value }))
                  }
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Pressão atual (PSI)
                </label>
                <input
                  value={form.currentPressurePsi}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      currentPressurePsi: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Pressão alvo (PSI)
                </label>
                <input
                  value={form.targetPressurePsi}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      targetPressurePsi: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Data da compra
                </label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      purchaseDate: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Técnico
            </h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Sulco atual (mm)
                </label>
                <input
                  value={form.currentTreadDepthMm}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      currentTreadDepthMm: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Sulco mínimo (mm)
                </label>
                <input
                  value={form.minTreadDepthMm}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      minTreadDepthMm: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Data de instalação
                </label>
                <input
                  type="date"
                  value={form.installedAt}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      installedAt: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Valor de aquisição
                </label>
                <input
                  value={form.purchaseCost}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      purchaseCost: event.target.value,
                    }))
                  }
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Observações</label>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) =>
                onChange((current) => ({ ...current, notes: event.target.value }))
              }
              className={inputClass()}
            />
          </div>

          {msgError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {msgError}
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={editing}
            className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {editing ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
