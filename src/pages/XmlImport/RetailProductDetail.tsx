import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRetailProductImportById, type RetailProductImportDetail } from "../../services/xmlImport";
import { formatDate } from "../../utils/formatters";

function formatAmountReais(value: string | number | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(String(value).replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatInvoiceStatus(status?: string) {
  if (status === "AUTHORIZED") return "Autorizada";
  if (status === "CANCELED") return "Cancelada";
  if (status === "DENIED") return "Denegada";
  return "Desconhecida";
}

function invoiceStatusClass(status?: string) {
  if (status === "AUTHORIZED") return "status-pill status-active";
  if (status === "CANCELED") return "status-pill status-inactive";
  if (status === "DENIED") return "status-pill status-anomaly";
  return "status-pill status-pending";
}

export function XmlRetailProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [detail, setDetail] = useState<RetailProductImportDetail | null>(null);

  useEffect(() => {
    async function loadDetail() {
      if (!id) {
        setErrorMessage("ID da importação não informado.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const data = await getRetailProductImportById(id);
        setDetail(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os detalhes da importação.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Detalhe da importação de produtos</h1>
          <p className="text-sm text-slate-500">
            Auditoria completa dos produtos importados a partir da NF-e.
          </p>
        </div>
        <Link
          to="/xml-import/retail-products"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando detalhes...</p>
        ) : !detail ? (
          <p className="text-sm text-slate-500">Importação não encontrada.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detail.supplierName || "-"}</p>
                <p className="text-xs text-slate-500">{detail.supplierDocument || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {detail.invoiceNumber || "-"} / {detail.invoiceSeries || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(detail.issuedAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor total</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {formatAmountReais(detail.totalAmount)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vínculo XML</p>
                <p className="mt-1 break-all text-xs text-slate-700">{detail.xmlInvoice.invoiceKey}</p>
                <Link
                  to={`/xml-import/invoices/${detail.xmlInvoice.id}`}
                  className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Abrir nota XML
                </Link>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status da nota</p>
                <span className={`mt-1 inline-flex ${invoiceStatusClass(detail.xmlInvoice.invoiceStatus)}`}>
                  {formatInvoiceStatus(detail.xmlInvoice.invoiceStatus)}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Itens importados</p>
                <p className="mt-1 text-base font-bold text-slate-900">{detail._count?.items || 0}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Itens da importação</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Código</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Descrição</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Quantidade</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Valor unitário</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Nenhum item importado para esta nota.
                        </td>
                      </tr>
                    ) : (
                      detail.items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-700">{item.productCode || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{item.description}</td>
                          <td className="px-4 py-3 text-slate-700">{item.quantity ?? "-"}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatAmountReais(item.unitValue)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {formatAmountReais(item.totalValue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

