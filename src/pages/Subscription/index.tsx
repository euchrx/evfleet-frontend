import { useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import {
  generateSubscriptionPayment,
  getSubscriptionPageData,
  selectCompanyPlan,
  type PaymentStatus,
  type SubscriptionInvoice,
  type SubscriptionPageData,
  type SubscriptionStatus,
} from "../../services/subscription";
import { formatCurrency, formatDate } from "../../utils/formatters";

function subscriptionStatusLabel(status: SubscriptionStatus) {
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIALING") return "Período de teste";
  if (status === "PAST_DUE") return "Pagamento pendente";
  return "Cancelada";
}

function subscriptionStatusClass(status: SubscriptionStatus) {
  if (status === "ACTIVE") return "status-active";
  if (status === "TRIALING") return "status-pending";
  if (status === "PAST_DUE") return "status-anomaly";
  return "status-inactive";
}

function invoiceStatusLabel(status: PaymentStatus) {
  if (status === "PAID") return "Pago";
  if (status === "PENDING") return "Pendente";
  if (status === "EXPIRED") return "Expirado";
  if (status === "CANCELED") return "Cancelado";
  if (status === "REFUNDED") return "Estornado";
  return "Falhou";
}

function invoiceStatusClass(status: PaymentStatus) {
  if (status === "PAID") return "status-active";
  if (status === "PENDING") return "status-pending";
  if (status === "EXPIRED") return "status-anomaly";
  return "status-inactive";
}

function getStatusAlert(status?: SubscriptionStatus) {
  if (!status) return null;
  if (status === "TRIALING") {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      message: "Período de teste ativo.",
    };
  }
  if (status === "PAST_DUE") {
    return {
      className: "border-red-200 bg-red-50 text-red-700",
      message: "Pagamento pendente. Regularize para manter acesso completo.",
    };
  }
  if (status === "CANCELED") {
    return {
      className: "border-slate-300 bg-slate-50 text-slate-700",
      message: "Assinatura cancelada.",
    };
  }
  return null;
}

export function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<SubscriptionPageData | null>(null);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [payingNow, setPayingNow] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const next = await getSubscriptionPageData();
      setData(next);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível carregar os dados da assinatura.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const overview = data?.overview || null;
  const plans = data?.plans || [];
  const invoices = data?.invoices || [];
  const statusAlert = getStatusAlert(overview?.status);
  async function handleSelectPlan(planId: string) {
    if (!data?.companyId) return;

    try {
      setSubmittingPlanId(planId);
      setErrorMessage("");
      await selectCompanyPlan(data.companyId, planId);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível selecionar o plano.",
      );
    } finally {
      setSubmittingPlanId(null);
    }
  }

  async function handlePayNow() {
    if (!overview?.subscriptionId) return;
    try {
      setPayingNow(true);
      setErrorMessage("");
      const checkoutUrl = await generateSubscriptionPayment(overview.subscriptionId);
      window.location.href = checkoutUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar o pagamento agora.",
      );
    } finally {
      setPayingNow(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assinatura</h1>
          <p className="mt-1 text-sm text-slate-500">Status da assinatura, planos e histórico de pagamento.</p>
        </div>
        <div className="flex items-center gap-2">
          {overview && data?.canPayNow ? (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={payingNow}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payingNow ? "Redirecionando..." : "Pagar agora"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {statusAlert ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${statusAlert.className}`}>
          {statusAlert.message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando dados da assinatura...</p>
        ) : !overview ? (
          <p className="text-sm text-slate-600">Nenhuma assinatura encontrada para esta empresa.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                <p className="mt-1 text-lg font-bold text-amber-900">{formatDate(overview.nextBillingDate)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Valor</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">
                  {formatCurrency(overview.amountCents, overview.currency)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</p>
                <p className="mt-1 text-base font-bold text-slate-900">{overview.companyName}</p>
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
            const isSubmitting = submittingPlanId === plan.id;
            return (
              <article
                key={plan.id}
                className={`rounded-2xl border p-4 ${
                  plan.isCurrent ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  </div>
                  {plan.isCurrent ? <span className="status-pill status-pending">Plano atual</span> : null}
                </div>

                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {formatCurrency(plan.priceCents, plan.currency)}
                  <span className="text-sm font-medium text-slate-500">
                    /{plan.billingCycle === "MONTHLY" ? "mês" : "ano"}
                  </span>
                </p>

                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={plan.isCurrent || isSubmitting}
                  className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    plan.isCurrent
                      ? "cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-500"
                      : "cursor-pointer bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  }`}
                >
                  {plan.isCurrent ? "Plano atual" : isSubmitting ? "Salvando..." : "Selecionar plano"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Histórico de pagamentos</h2>
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
                    Nenhum pagamento encontrado.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice: SubscriptionInvoice) => (
                  <tr key={invoice.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(invoice.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{invoice.description}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{invoice.reference || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`status-pill ${invoiceStatusClass(invoice.status)}`}>
                        {invoiceStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {formatCurrency(invoice.amountCents)}
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
