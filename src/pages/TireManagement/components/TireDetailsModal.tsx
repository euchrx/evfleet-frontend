import type { Tire, TireAlert } from "../../../types/tire";
import {
  formatCurrencyLabel,
  formatDateLabel,
  formatNumberLabel,
  formatPositionLabel,
  getCostPerKm,
  getCriticalTreadAlert,
  getCurrentLifeKm,
  getCurrentPressure,
  getCurrentTreadDepth,
  getLateInspectionAlert,
  getLifeCount,
  getLoadSpeedIndexLabel,
  getTotalCasingKm,
  getTotalInvestment,
  getUsefulLifePercent,
  tireConditionLabel,
  tireStatusClass,
  tireStatusLabel,
  tireVehicleLabel,
} from "../helpers";

type Props = {
  open: boolean;
  tire: Tire | null;
  alerts: TireAlert[];
  onClose: () => void;
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-base font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

export function TireDetailsModal({ open, tire, alerts, onClose }: Props) {
  if (!open || !tire) return null;

  const criticalTreadAlert = getCriticalTreadAlert(tire, alerts);
  const usefulLife = getUsefulLifePercent(tire);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Visão completa do pneu
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{tire.serialNumber}</h2>
            <p className="mt-1 text-base text-slate-600">
              {tire.brand} {tire.model}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${tireStatusClass(
                tire.status,
              )}`}
            >
              {tireStatusLabel(tire.status)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base font-medium text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-base font-bold uppercase tracking-wide text-slate-500">
                Operacional
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Veículo vinculado" value={tireVehicleLabel(tire)} />
                <DetailItem
                  label="Posição"
                  value={formatPositionLabel(
                    tire.axlePosition,
                    tire.wheelPosition,
                    Boolean(tire.vehicle),
                  )}
                />
                <DetailItem label="Estado" value={tireConditionLabel(tire)} />
                <DetailItem label="Instalado em" value={formatDateLabel(tire.installedAt)} />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-base font-bold uppercase tracking-wide text-slate-500">
                Técnico
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Medida" value={tire.size || "-"} />
                <DetailItem
                  label="Índice de carga e velocidade"
                  value={getLoadSpeedIndexLabel(tire)}
                />
                <DetailItem
                  label="Sulco atual"
                  value={formatNumberLabel(getCurrentTreadDepth(tire), " mm")}
                />
                <DetailItem
                  label="% de vida útil"
                  value={usefulLife != null ? `${usefulLife.toFixed(1).replace(".", ",")}%` : "-"}
                />
                <DetailItem
                  label="Pressão"
                  value={formatNumberLabel(getCurrentPressure(tire), " PSI")}
                />
                <DetailItem
                  label="Data da última aferição"
                  value={formatDateLabel(tire.readings?.[0]?.readingDate)}
                />
                <DetailItem label="Número de vidas" value={String(getLifeCount(tire))} />
                <DetailItem
                  label="KM da vida atual"
                  value={formatNumberLabel(getCurrentLifeKm(tire), " km")}
                />
                <DetailItem
                  label="KM total do casco"
                  value={formatNumberLabel(getTotalCasingKm(tire), " km")}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-base font-bold uppercase tracking-wide text-slate-500">
                Financeiro
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label="Valor investido"
                  value={formatCurrencyLabel(getTotalInvestment(tire))}
                />
                <DetailItem
                  label="CPK (custo por km)"
                  value={formatCurrencyLabel(getCostPerKm(tire))}
                />
                <DetailItem
                  label="Valor de Aquisição"
                  value={formatCurrencyLabel(tire.purchaseCost ?? null)}
                />
                <DetailItem label="Data da compra" value={formatDateLabel(tire.purchaseDate)} />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-base font-bold uppercase tracking-wide text-slate-500">
                Alertas
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label="Sulco crítico"
                  value={criticalTreadAlert ? criticalTreadAlert.message : "Sem alerta"}
                />
                <DetailItem label="Inspeção" value={getLateInspectionAlert(tire)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}