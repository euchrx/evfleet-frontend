import { useEffect, useMemo, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import {
  getSubscriptionPageData,
  startSubscriptionCheckout,
  type SubscriptionInvoice,
  type SubscriptionPageData,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "../../services/subscription";

function toCurrency(value: number, currency = "BRL") {
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

function toDate(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function subscriptionStatusLabel(status: SubscriptionStatus) {
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIALING") return "Em teste";
  if (status === "PAST_DUE") return "Em atraso";
  return "Cancelada";
}

function subscriptionStatusClass(status: SubscriptionStatus) {
  if (status === "ACTIVE") return "status-active";
  if (status === "TRIALING") return "status-pending";
  if (status === "PAST_DUE") return "status-anomaly";
  return "status-inactive";
}

function invoiceStatusLabel(status: SubscriptionInvoice["status"]) {
  if (status === "PAID") return "Paga";
  if (status === "PENDING") return "Pendente";
  return "Falhou";
}

function invoiceStatusClass(status: SubscriptionInvoice["status"]) {
  if (status === "PAID") return "status-active";
  if (status === "PENDING") return "status-pending";
  return "status-inactive";
}

export function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<SubscriptionPageData | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const next = await getSubscriptionPageData();
      setData(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar os dados da assinatura.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const overview = data?.overview;
  const plans = data?.plans || [];
  const invoices = data?.invoices || [];

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === overview?.planId) || null,
    [plans, overview?.planId]
  );

  async function handleCheckout(plan: SubscriptionPlan) {
    try {
      setSubmittingPlanId(plan.id);
      const checkoutUrl = await startSubscriptionCheckout(plan.id);
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o checkout no gateway de cobrança."
      );
    } finally {
      setSubmittingPlanId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assinatura</h1>
          <p className="mt-1 text-sm text-slate-500">
            Status atual da assinatura, cobrança e gestão de planos.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading || !overview ? (
          <p className="text-sm text-slate-500">Carregando dados da assinatura...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  <span className={`status-pill ${subscriptionStatusClass(overview.status)}`}>
                    {subscriptionStatusLabel(overview.status)}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Plano atual</p>
                <p className="mt-1 text-lg font-bold text-blue-900">{overview.planName}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Próxima cobrança</p>
                <p className="mt-1 text-lg font-bold text-amber-900">{toDate(overview.nextBillingDate)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Valor cobrado</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">
                  {toCurrency(overview.amount, overview.currency)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{overview.companyName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{overview.gatewayName || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagamento</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{overview.paymentMethodLabel || "-"}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard size={18} className="text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Planos disponíveis</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            const isSubmitting = submittingPlanId === plan.id;
            return (
              <article
                key={plan.id}
                className={`rounded-2xl border p-4 ${
                  isCurrent
                    ? "border-orange-300 bg-orange-50"
                    : plan.recommended
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  </div>
                  {isCurrent ? (
                    <span className="status-pill status-pending">Plano atual</span>
                  ) : plan.recommended ? (
                    <span className="status-pill status-active">Recomendado</span>
                  ) : null}
                </div>

                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {toCurrency(plan.price, plan.currency)}
                  <span className="text-sm font-medium text-slate-500">
                    /{plan.billingCycle === "MONTHLY" ? "mês" : "ano"}
                  </span>
                </p>

                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleCheckout(plan)}
                  disabled={isCurrent || isSubmitting}
                  className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isCurrent
                      ? "cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-500"
                      : "cursor-pointer bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  {isCurrent ? "Plano atual" : isSubmitting ? "Abrindo gateway..." : "Selecionar plano"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Histórico de cobranças</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Data</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Descrição</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Referência</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Valor</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-700">{toDate(invoice.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{invoice.description}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{invoice.reference || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`status-pill ${invoiceStatusClass(invoice.status)}`}>
                        {invoiceStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {toCurrency(invoice.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
