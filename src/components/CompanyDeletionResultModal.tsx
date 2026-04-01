import type { CompanyDeleteWithBackupResult } from "../types/company";

type CompanyDeletionResultModalProps = {
  isOpen: boolean;
  result: CompanyDeleteWithBackupResult | null;
  onClose: () => void;
  onDownloadMetadata?: () => void;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatSummaryLabel(key: string) {
  const labels: Record<string, string> = {
    company: "empresa",
    branches: "filiais",
    users: "usuários",
    subscriptions: "assinaturas",
    payments: "pagamentos",
    webhookEvents: "eventos de webhook",
    vehicles: "veículos",
    vehicleProfilePhotos: "fotos de perfil",
    vehicleChangeLogs: "históricos do veículo",
    drivers: "motoristas",
    maintenanceRecords: "manutenções",
    maintenancePlans: "planos de manutenção",
    debts: "débitos",
    fuelRecords: "abastecimentos",
    trips: "viagens",
    vehicleDocuments: "documentos",
    tires: "pneus",
    tireReadings: "leituras de pneu",
    xmlImportBatches: "lotes XML",
    xmlInvoices: "notas XML",
    xmlInvoiceItems: "itens XML",
    retailProductImports: "importações de varejo",
    retailProductImportItems: "itens de varejo",
  };

  return labels[key] || key;
}

export function CompanyDeletionResultModal({
  isOpen,
  result,
  onClose,
  onDownloadMetadata,
}: CompanyDeletionResultModalProps) {
  if (!isOpen || !result) return null;

  const deletedEntries = Object.entries(result.deleted).filter(
    ([, value]) => Number(value) > 0,
  );

  return (
    <div className="fixed inset-0 z-[96] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 sm:items-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-2xl">
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-700">
              OK
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Exclusão concluída com sucesso</h2>
              <p className="text-sm text-slate-600">
                A empresa foi removida e o backup lógico foi gerado antes da exclusão.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa excluída</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{result.company.name}</p>
              <p className="mt-1 text-sm text-slate-600">ID: {result.company.id}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horário da operação</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatDateTime(result.backup.generatedAt)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                O timestamp exibido corresponde à geração do backup.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Metadados do backup</h3>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome do backup</p>
                <p className="mt-1 text-sm text-slate-800">{result.backup.fileName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificador</p>
                <p className="mt-1 text-sm text-slate-800">{result.backup.identifier}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caminho</p>
                <p className="mt-1 break-all text-sm text-slate-800">{result.backup.filePath}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Resumo da exclusão</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {deletedEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">{formatSummaryLabel(key)}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-ui btn-ui-neutral"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={onDownloadMetadata}
            disabled={!result.backup.metadataDownloadAvailable}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              result.backup.metadataDownloadAvailable
                ? "Baixar metadados do backup"
                : "Download de metadados disponível em breve"
            }
          >
            Baixar metadados do backup
          </button>
        </div>
      </div>
    </div>
  );
}
