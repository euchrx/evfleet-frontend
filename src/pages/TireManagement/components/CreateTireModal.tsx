import type { TireStatus } from "../../../types/tire";
import type { CreateTireForm } from "../helpers";
import { normalizeDecimalInput, normalizeTireSize } from "../helpers";

type Props = {
  open: boolean;
  form: CreateTireForm;
  creating: boolean;
  msgError: string | null;
  onClose: () => void;
  onChange: (updater: (current: CreateTireForm) => CreateTireForm) => void;
  onSubmit: () => void;
};

function inputClass() {
  return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
}

export function CreateTireModal({
  open,
  form,
  creating,
  msgError,
  onClose,
  onChange,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cadastrar pneu</h2>
            <p className="text-sm text-slate-500">
              Preencha os dados para registrar o pneu no sistema.
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
                  Número(s) de série
                </label>
                <textarea
                  value={form.serialNumber}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      serialNumber: event.target.value,
                    }))
                  }
                  rows={5}
                  className={inputClass()}
                  placeholder={`Ex.:
123456789
123456790
123456791`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Informe um número de série por linha.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Marca</label>
                <input
                  value={form.brand}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, brand: event.target.value }))
                  }
                  className={inputClass()}
                  placeholder="Ex.: Continental"
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
                  placeholder="Ex.: PowerContact 2"
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
                  placeholder="Ex.: 19555"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Aro</label>
                <input
                  value={form.rim}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      rim: normalizeDecimalInput(event.target.value),
                    }))
                  }
                  className={inputClass()}
                  placeholder="Ex.: 22,5"
                  inputMode="decimal"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Status inicial
                </label>
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
                  placeholder="Ex.: 25000"
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
                  placeholder="Ex.: 108"
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
                  placeholder="Ex.: 110"
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
                  placeholder="Ex.: 7.5"
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
                  placeholder="Ex.: 3"
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
                  placeholder="Ex.: 1850"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Observações</label>
            <textarea
              value={form.notes}
              onChange={(event) =>
                onChange((current) => ({ ...current, notes: event.target.value }))
              }
              rows={4}
              className={inputClass()}
              placeholder="Observações importantes sobre o pneu"
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
            disabled={creating}
            className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {creating ? "Cadastrando..." : "Cadastrar pneu"}
          </button>
        </div>
      </div>
    </div>
  );
}
