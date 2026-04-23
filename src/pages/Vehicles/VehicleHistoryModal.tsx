import type { Vehicle, VehicleHistoryItem } from "../../types/vehicle";
import {
  formatHistoryDate,
  getHistoryTypeLabel,
  translateHistoryText,
} from "./helpers";

type VehicleHistoryModalProps = {
  isOpen: boolean;
  vehicle: Vehicle | null;
  historyItems: VehicleHistoryItem[];
  historyLoading: boolean;
  historyPage: number;
  historyTotalPages: number;
  historyTotal: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

function getHistoryItemStyles(type?: string) {
  if (
    type === "IMPLEMENT_LINKED" ||
    type === "IMPLEMENT_UNLINKED" ||
    type === "IMPLEMENT_POSITION_CHANGED"
  ) {
    return {
      container:
        "rounded-xl border border-indigo-200 bg-indigo-50/60 p-4",
      badge:
        "inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700",
      title: "font-semibold text-slate-900",
      description: "mt-2 text-sm leading-6 text-slate-700",
    };
  }

  return {
    container: "rounded-xl border border-slate-200 p-4",
    badge:
      "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600",
    title: "font-semibold text-slate-900",
    description: "mt-2 text-sm leading-6 text-slate-600",
  };
}

export function VehicleHistoryModal({
  isOpen,
  vehicle,
  historyItems,
  historyLoading,
  historyPage,
  historyTotalPages,
  historyTotal,
  onClose,
  onPrevious,
  onNext,
}: VehicleHistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900">
            Histórico - {vehicle?.plate || "Veículo"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {historyLoading ? (
            <p className="text-sm text-slate-500">Carregando histórico...</p>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum evento encontrado.</p>
          ) : (
            historyItems.map((item, index) => {
              const styles = getHistoryItemStyles(item.type);

              return (
                <div
                  key={`${item.type}-${item.date}-${index}`}
                  className={styles.container}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className={styles.title}>
                        {translateHistoryText(item.title)}
                      </p>

                      <div className="mt-2">
                        <span className={styles.badge}>
                          {getHistoryTypeLabel(item.type)}
                        </span>
                      </div>
                    </div>

                    <p className="whitespace-nowrap text-xs text-slate-500">
                      {formatHistoryDate(item.date)}
                    </p>
                  </div>

                  <p className={styles.description}>
                    {translateHistoryText(item.description)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <p className="text-xs text-slate-500">
            Página {historyPage} de {historyTotalPages} • {historyTotal} evento(s)
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={historyPage <= 1 || historyLoading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={historyPage >= historyTotalPages || historyLoading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}