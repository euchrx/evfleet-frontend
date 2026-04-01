import type {
  ProductXmlPreviewInvoice,
  ProductXmlPreviewItem,
  RetailProductCategory,
} from "../services/retailProducts";

type ProductXmlImportModalProps = {
  isOpen: boolean;
  invoices: ProductXmlPreviewInvoice[];
  selectedKeys: Set<string>;
  loading?: boolean;
  onClose: () => void;
  onToggleItem: (invoiceKey: string, lineIndex: number) => void;
  onConfirm: () => void;
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getItemKey(invoiceKey: string, lineIndex: number) {
  return `${invoiceKey}:${lineIndex}`;
}

function getCategoryLabel(category: RetailProductCategory) {
  if (category === "PERFUMARIA") return "Perfumaria";
  if (category === "COSMETICOS") return "Cosméticos";
  if (category === "LUBRIFICANTES") return "Lubrificantes";
  if (category === "CONVENIENCIA") return "Conveniência";
  if (category === "LIMPEZA") return "Limpeza";
  return "Outros";
}

function getItemStatus(item: ProductXmlPreviewItem) {
  if (item.duplicate) {
    return {
      label: "Duplicado",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: "Pronto para importar",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

export function ProductXmlImportModal({
  isOpen,
  invoices,
  selectedKeys,
  loading = false,
  onClose,
  onToggleItem,
  onConfirm,
}: ProductXmlImportModalProps) {
  if (!isOpen) return null;

  const items = invoices.flatMap((invoice) => invoice.items);
  const importableCount = items.filter(
    (item) => item.importable && !item.duplicate,
  ).length;
  const duplicateCount = items.filter((item) => item.duplicate).length;
  const selectedCount = invoices.reduce(
    (acc, invoice) =>
      acc +
      invoice.items.filter((item) =>
        selectedKeys.has(getItemKey(invoice.invoiceKey, item.lineIndex)),
      ).length,
    0,
  );

  return (
    <div className="fixed inset-0 z-[105] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Preview da importação XML
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revise os produtos detectados antes de importar os itens.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Importáveis
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-800">
                  {importableCount}
                </p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Duplicados
                </p>
                <p className="mt-1 text-2xl font-bold text-red-800">
                  {duplicateCount}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700">
            {selectedCount} item(ns) selecionado(s) para importar.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhum produto foi detectado nos XMLs enviados.
            </div>
          ) : (
            invoices.map((invoice) => (
              <section
                key={invoice.invoiceKey}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Fornecedor
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {invoice.supplierName || "Fornecedor não identificado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      NF-e
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {invoice.invoiceNumber || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {formatDateTime(invoice.issuedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Documento
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {invoice.supplierDocument || "-"}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Selecionar
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Produto
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Categoria
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Quantidade
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Valor unitário
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Valor total
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => {
                        const itemKey = getItemKey(invoice.invoiceKey, item.lineIndex);
                        const disabled = item.duplicate || !item.importable;
                        const status = getItemStatus(item);

                        return (
                          <tr key={itemKey} className="border-t border-slate-200">
                            <td className="px-4 py-4 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(itemKey)}
                                disabled={disabled || loading}
                                onChange={() =>
                                  onToggleItem(invoice.invoiceKey, item.lineIndex)
                                }
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              <p className="font-medium text-slate-900">
                                {item.productName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Código: {item.productCode || "-"}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {getCategoryLabel(item.category)}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {item.quantity.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {formatMoney(item.unitPrice)}
                            </td>
                            <td className="px-4 py-4 text-sm font-medium text-slate-900">
                              {formatMoney(item.totalPrice)}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">
                              <div className="space-y-2">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                                >
                                  {status.label}
                                </span>
                                {item.duplicateReason ? (
                                  <p className="max-w-xs text-xs text-slate-500">
                                    {item.duplicateReason}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selectedCount === 0 || loading}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Importando..." : "Importar selecionados"}
          </button>
        </div>
      </div>
    </div>
  );
}
