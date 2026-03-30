import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CreditCard, Pencil, Power, RefreshCw, Trash2 } from "lucide-react";
import {
  activateCompanySubscription,
  cancelCompanySubscription,
  clearCompanyPayments,
  createBillingPlan,
  deleteBillingPlan,
  generateSubscriptionPayment,
  getSubscriptionPageData,
  selectCompanyPlan,
  updateBillingPlan,
  type PlanInterval,
  type PaymentStatus,
  type SubscriptionInvoice,
  type SubscriptionPageData,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "../../services/subscription";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";

function subscriptionStatusLabel(status: SubscriptionStatus) {
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIALING") return "Período de teste";
  if (status === "PAST_DUE") return "Pagamento pendente";
  return "Cancelada";
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
      message: "Assinatura cancelada. Entre em contato com o administrador para reativação.",
    };
  }
  if (status === "ACTIVE") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      message: "Assinatura ativa e operação liberada.",
    };
  }
  return null;
}

function parseDateSafe(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function SubscriptionPage() {
  const location = useLocation();
  const { user } = useAuth();
  const { selectedCompanyId } = useCompanyScope();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<SubscriptionPageData | null>(null);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [payingNow, setPayingNow] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [isCancelSubscriptionOpen, setIsCancelSubscriptionOpen] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [activatingSubscription, setActivatingSubscription] = useState(false);
  const [isClearPaymentsOpen, setIsClearPaymentsOpen] = useState(false);
  const [clearingPayments, setClearingPayments] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [selectedPlanActivationStatus, setSelectedPlanActivationStatus] =
    useState<Extract<SubscriptionStatus, "ACTIVE" | "TRIALING">>("TRIALING");
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [newPlan, setNewPlan] = useState({
    code: "",
    name: "",
    description: "",
    priceCents: "",
    vehicleLimit: "",
    interval: "MONTHLY" as PlanInterval,
  });

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
  }, [selectedCompanyId, location.key]);

  const overview = data?.overview || null;
  const plans = data?.plans || [];
  const invoices = data?.invoices || [];
  const canManagePlans = user?.role === "ADMIN";
  const hasCompanyScope = Boolean(data?.companyId);
  const statusAlert = getStatusAlert(overview?.status);
  const paymentUnlockDaysBeforeDue = 5;
  const now = new Date();
  const nextBillingDate = parseDateSafe(overview?.nextBillingDate);
  const currentPeriodStart = parseDateSafe(overview?.startedAt);
  const latestPaidInvoice = [...invoices]
    .filter((invoice) => invoice.status === "PAID")
    .sort((a, b) => {
      const dateA = parseDateSafe(a.paidAt || a.date)?.getTime() || 0;
      const dateB = parseDateSafe(b.paidAt || b.date)?.getTime() || 0;
      return dateB - dateA;
    })[0];
  const latestPaidDate = parseDateSafe(latestPaidInvoice?.paidAt || latestPaidInvoice?.date);
  const hasPaidCurrentCycle = Boolean(
    latestPaidDate && (!currentPeriodStart || latestPaidDate >= currentPeriodStart),
  );
  const paymentUnlockDate = nextBillingDate
    ? new Date(nextBillingDate.getTime() - paymentUnlockDaysBeforeDue * 24 * 60 * 60 * 1000)
    : null;
  const isInsideUnlockWindow = paymentUnlockDate ? now >= paymentUnlockDate : true;
  const paymentWindowBlocked = Boolean(
    overview &&
      overview.status !== "PAST_DUE" &&
      overview.status !== "CANCELED" &&
      hasPaidCurrentCycle &&
      !isInsideUnlockWindow,
  );
  const paymentWindowBlockedMessage = paymentWindowBlocked
    ? paymentUnlockDate
      ? `Pagamento deste ciclo ja confirmado. Nova cobranca sera liberada em ${paymentUnlockDate.toLocaleDateString(
          "pt-BR",
        )}.`
      : "Pagamento deste ciclo ja confirmado. Aguarde a proxima janela de cobranca."
    : "";

  function redirectToCheckout(checkoutUrl: string) {
    const normalizedUrl = String(checkoutUrl || "").trim();
    if (!normalizedUrl) {
      throw new Error("Checkout não disponível no momento.");
    }

    window.location.href = normalizedUrl;
  }

  function openCreatePlanModal() {
    setEditingPlan(null);
    setNewPlan({
      code: "",
      name: "",
      description: "",
      priceCents: "",
      vehicleLimit: "",
      interval: "MONTHLY",
    });
    setIsPlanModalOpen(true);
  }

  function openEditPlanModal(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setNewPlan({
      code: plan.code,
      name: plan.name,
      description: plan.description || "",
      priceCents: String(plan.priceCents),
      vehicleLimit:
        typeof plan.vehicleLimit === "number" && plan.vehicleLimit > 0
          ? String(plan.vehicleLimit)
          : "",
      interval: plan.billingCycle,
    });
    setIsPlanModalOpen(true);
  }

  async function handleSelectPlan(
    planId: string,
    initialStatus: Extract<SubscriptionStatus, "ACTIVE" | "TRIALING"> = "TRIALING",
  ) {
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setSubmittingPlanId(planId);
      setErrorMessage("");
      await selectCompanyPlan(data.companyId, planId, initialStatus);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível selecionar o plano.",
      );
    } finally {
      setSubmittingPlanId(null);
    }
  }

  function getPlanHighlights(plan: SubscriptionPlan) {
    const descriptionParts = String(plan.description || "")
      .split(/\n|,|;|\|/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const normalized = descriptionParts.slice(0, 6);

    if (typeof plan.vehicleLimit === "number" && plan.vehicleLimit > 0) {
      normalized.unshift(`Limite de ${plan.vehicleLimit} veículo(s) por empresa.`);
    } else {
      normalized.unshift("Sem limite de veículos no cadastro.");
    }

    if (normalized.length === 0) {
      normalized.push("Acesso completo ao módulo de gestão de frota.");
      normalized.push("Suporte para operação multiempresa.");
      normalized.push("Relatórios e acompanhamento financeiro.");
    }

    return normalized;
  }

  async function handleSelectPlanAndPay() {
    if (!selectedPlanForCheckout?.id) return;
    if (paymentWindowBlocked) {
      setErrorMessage(paymentWindowBlockedMessage || "Pagamento ja confirmado para o ciclo atual.");
      return;
    }
    if (!canManagePlans) {
      setErrorMessage("Somente administrador pode alterar o plano.");
      return;
    }
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setRedirectingToCheckout(true);
      setErrorMessage("");
      await selectCompanyPlan(
        data.companyId,
        selectedPlanForCheckout.id,
        selectedPlanActivationStatus,
      );
      const refreshed = await getSubscriptionPageData();
      setData(refreshed);

      const subscriptionId = refreshed.overview?.subscriptionId;
      if (!subscriptionId) {
        throw new Error("Assinatura não encontrada para gerar o checkout.");
      }

      const checkoutUrl = await generateSubscriptionPayment(subscriptionId);
      redirectToCheckout(checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível selecionar o plano e redirecionar para pagamento.",
      );
    } finally {
      setRedirectingToCheckout(false);
    }
  }

  function getPlanActionLabel(plan: SubscriptionPlan) {
    if (canManagePlans && !hasCompanyScope) return "Selecione empresa";
    if (plan.isCurrent && overview) return "Ver assinatura";
    return "Selecionar plano";
  }

  function getSelfServicePlanStatus(): Extract<SubscriptionStatus, "ACTIVE" | "TRIALING"> {
    return overview?.status === "TRIALING" ? "TRIALING" : "ACTIVE";
  }

  async function handlePayNow() {
    if (!overview?.subscriptionId) return;
    if (paymentWindowBlocked) {
      setErrorMessage(paymentWindowBlockedMessage || "Pagamento ja confirmado para o ciclo atual.");
      return;
    }
    try {
      setPayingNow(true);
      setErrorMessage("");
      const checkoutUrl = await generateSubscriptionPayment(overview.subscriptionId);
      redirectToCheckout(checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar o pagamento agora.",
      );
    } finally {
      setPayingNow(false);
    }
  }

  async function handleCreatePlan(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSavingPlan(true);
      setErrorMessage("");
      const payload = {
        code: newPlan.code,
        name: newPlan.name,
        description: newPlan.description,
        priceCents: Number(newPlan.priceCents),
        vehicleLimit: newPlan.vehicleLimit ? Number(newPlan.vehicleLimit) : undefined,
        interval: newPlan.interval,
        currency: "BRL",
        active: true,
      };
      if (editingPlan?.id) {
        await updateBillingPlan(editingPlan.id, payload);
      } else {
        await createBillingPlan(payload);
      }
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      setNewPlan({
        code: "",
        name: "",
        description: "",
        priceCents: "",
        vehicleLimit: "",
        interval: "MONTHLY",
      });
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : editingPlan
            ? "Não foi possível atualizar o plano."
            : "Não foi possível adicionar o plano.",
      );
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan() {
    if (!planToDelete?.id) return;
    try {
      setDeletingPlan(true);
      setErrorMessage("");
      await deleteBillingPlan(planToDelete.id);
      setPlanToDelete(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível remover o plano.");
    } finally {
      setDeletingPlan(false);
    }
  }

  async function handleCancelSubscription() {
    if (!data?.companyId) return;
    try {
      setCancelingSubscription(true);
      setErrorMessage("");
      await cancelCompanySubscription(data.companyId);
      setIsCancelSubscriptionOpen(false);
      await loadData();
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível desabilitar a assinatura.",
      );
    } finally {
      setCancelingSubscription(false);
    }
  }

  async function handleActivateSubscription() {
    if (!data?.companyId) return;
    try {
      setActivatingSubscription(true);
      setErrorMessage("");
      await activateCompanySubscription(data.companyId);
      setIsCancelSubscriptionOpen(false);
      await loadData();
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível ativar a assinatura.",
      );
    } finally {
      setActivatingSubscription(false);
    }
  }

  async function handleClearPayments() {
    if (!data?.companyId) return;
    try {
      setClearingPayments(true);
      setErrorMessage("");
      await clearCompanyPayments(data.companyId);
      setIsClearPaymentsOpen(false);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível limpar o histórico de pagamentos.",
      );
    } finally {
      setClearingPayments(false);
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
          {canManagePlans ? (
            <button
              type="button"
              onClick={openCreatePlanModal}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              Adicionar plano
            </button>
          ) : null}
          {overview && data?.canPayNow && overview.status !== "CANCELED" ? (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={payingNow || paymentWindowBlocked}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payingNow ? "Redirecionando..." : paymentWindowBlocked ? "Pago no ciclo atual" : "Pagar agora"}
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
      {paymentWindowBlockedMessage ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
          {paymentWindowBlockedMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando dados da assinatura...</p>
        ) : !overview ? (
          <p className="text-sm text-slate-600">
            {canManagePlans && !hasCompanyScope
              ? "Selecione uma empresa no escopo para consultar a assinatura."
              : "Nenhuma assinatura encontrada para esta empresa."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  {canManagePlans && hasCompanyScope ? (
                    <button
                      type="button"
                      onClick={() => setIsCancelSubscriptionOpen(true)}
                      title={
                        overview.status === "CANCELED"
                          ? "Ativar assinatura da empresa"
                          : "Desabilitar assinatura da empresa"
                      }
                      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition ${
                        overview.status === "CANCELED"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      }`}
                    >
                      <Power size={15} />
                    </button>
                  ) : null}
                </div>
                <p
                  className={`mt-2 text-lg font-bold ${
                    overview.status === "ACTIVE"
                      ? "text-emerald-700"
                      : overview.status === "TRIALING"
                        ? "text-amber-700"
                        : overview.status === "PAST_DUE"
                          ? "text-orange-700"
                          : "text-slate-700"
                  }`}
                >
                  {subscriptionStatusLabel(overview.status)}
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
                  <div className="flex items-center gap-2">
                    {plan.isCurrent ? <span className="status-pill status-pending">Plano atual</span> : null}
                    {canManagePlans ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditPlanModal(plan)}
                          disabled={isSubmitting}
                          title="Editar plano"
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanToDelete(plan)}
                          disabled={isSubmitting}
                          title="Remover plano"
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {formatCurrency(plan.priceCents, plan.currency)}
                  <span className="text-sm font-medium text-slate-500">
                    /{plan.billingCycle === "MONTHLY" ? "mês" : "ano"}
                  </span>
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {typeof plan.vehicleLimit === "number" && plan.vehicleLimit > 0
                    ? `Limite de ${plan.vehicleLimit} veículo(s)`
                    : "Sem limite de veículos"}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanForCheckout(plan);
                    setSelectedPlanActivationStatus("TRIALING");
                  }}
                  disabled={(canManagePlans && !hasCompanyScope) || isSubmitting || redirectingToCheckout}
                  className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    (canManagePlans && !hasCompanyScope)
                      ? "cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-500"
                      : "cursor-pointer bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  }`}
                >
                  {isSubmitting || redirectingToCheckout ? "Carregando..." : getPlanActionLabel(plan)}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {selectedPlanForCheckout ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Detalhes do plano</h2>
                <p className="mt-1 text-sm text-slate-500">Revise as informações antes de ir para o pagamento.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPlanForCheckout(null);
                  setSelectedPlanActivationStatus("TRIALING");
                }}
                className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Plano selecionado</p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">{selectedPlanForCheckout.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPlanForCheckout.description || "Plano corporativo para gestão completa da operação."}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-700">
                      {formatCurrency(selectedPlanForCheckout.priceCents, selectedPlanForCheckout.currency)}
                    </p>
                    <p className="text-sm text-slate-600">
                      Cobrança {selectedPlanForCheckout.billingCycle === "MONTHLY" ? "mensal" : "anual"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Código</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedPlanForCheckout.code}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ciclo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedPlanForCheckout.billingCycle === "MONTHLY" ? "Mensal" : "Anual"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Disponível</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limite de veículos</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {typeof selectedPlanForCheckout.vehicleLimit === "number" &&
                    selectedPlanForCheckout.vehicleLimit > 0
                      ? `${selectedPlanForCheckout.vehicleLimit} veículo(s)`
                      : "Ilimitado"}
                  </p>
                </div>
              </div>

              {canManagePlans ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Tipo de ativação ao vincular o plano
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlanActivationStatus("TRIALING")}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        selectedPlanActivationStatus === "TRIALING"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Período de teste
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPlanActivationStatus("ACTIVE")}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        selectedPlanActivationStatus === "ACTIVE"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Assinatura ativa
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">O que este plano oferece</p>
                <ul className="mt-3 space-y-2">
                  {getPlanHighlights(selectedPlanForCheckout).map((item, index) => (
                    <li key={`${selectedPlanForCheckout.id}-feature-${index}`} className="text-sm text-slate-700">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4">
              {canManagePlans ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedPlanForCheckout?.id) return;
                    await handleSelectPlan(
                      selectedPlanForCheckout.id,
                      selectedPlanActivationStatus,
                    );
                    setSelectedPlanForCheckout(null);
                    setSelectedPlanActivationStatus("TRIALING");
                  }}
                  disabled={redirectingToCheckout}
                  className="cursor-pointer rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Selecionar sem pagar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSelectedPlanForCheckout(null);
                  setSelectedPlanActivationStatus("TRIALING");
                }}
                disabled={redirectingToCheckout}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              {canManagePlans ? (
                <button
                  type="button"
                  onClick={handleSelectPlanAndPay}
                  disabled={redirectingToCheckout}
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {redirectingToCheckout ? "Redirecionando..." : "Ir para pagamento"}
                </button>
              ) : selectedPlanForCheckout.isCurrent ? (
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={payingNow || !data?.canPayNow || paymentWindowBlocked}
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payingNow ? "Redirecionando..." : paymentWindowBlocked ? "Pago no ciclo atual" : "Pagar agora"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedPlanForCheckout?.id) return;
                    await handleSelectPlan(
                      selectedPlanForCheckout.id,
                      getSelfServicePlanStatus(),
                    );
                    setSelectedPlanForCheckout(null);
                    setSelectedPlanActivationStatus("TRIALING");
                  }}
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Selecionar plano
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Histórico de pagamentos</h2>
        {canManagePlans ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsClearPaymentsOpen(true)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100"
              title="Limpar histórico de pagamentos"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Data</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Descrição</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Referência</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Valor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Comprovante</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
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
                    <td className="px-4 py-3 text-sm">
                      {invoice.invoiceUrl ? (
                        <a
                          href={invoice.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                          Abrir comprovante
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isPlanModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingPlan ? "Editar plano" : "Adicionar plano"}
                </h2>
                <p className="text-sm text-slate-500">
                  {editingPlan ? "Atualize os dados do plano." : "Crie um novo plano de assinatura."}
                </p>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <form onSubmit={handleCreatePlan} className="space-y-4 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Código</label>
                  <input
                    required
                    value={newPlan.code}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, code: event.target.value }))
                    }
                    placeholder="Ex: PRO"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    required
                    value={newPlan.name}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Ex: Plano Corporativo"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Descrição</label>
                  <input
                    value={newPlan.description}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Descrição do plano"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Valor (centavos)</label>
                  <input
                    required
                    type="number"
                    min={100}
                    value={newPlan.priceCents}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, priceCents: event.target.value }))
                    }
                    placeholder="Ex: 59900"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Limite de veículos permitidos</label>
                  <input
                    type="number"
                    min={1}
                    value={newPlan.vehicleLimit}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, vehicleLimit: event.target.value }))
                    }
                    placeholder="Ex: 20 (deixe vazio para ilimitado)"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Intervalo</label>
                  <select
                    value={newPlan.interval}
                    onChange={(event) =>
                      setNewPlan((prev) => ({
                        ...prev,
                        interval: event.target.value as PlanInterval,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingPlan ? "Salvando..." : editingPlan ? "Atualizar plano" : "Salvar plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ConfirmDeleteModal
        isOpen={Boolean(planToDelete)}
        title="Remover plano"
        description={planToDelete ? `Deseja remover o plano ${planToDelete.name}?` : "Deseja remover este plano?"}
        loading={deletingPlan}
        onCancel={() => setPlanToDelete(null)}
        onConfirm={handleDeletePlan}
      />
      <ConfirmDeleteModal
        isOpen={isCancelSubscriptionOpen}
        title={overview?.status === "CANCELED" ? "Ativar assinatura" : "Desabilitar assinatura"}
        description={
          overview?.status === "CANCELED"
            ? "Deseja ligar novamente a assinatura da empresa selecionada?"
            : "Deseja desabilitar a assinatura da empresa selecionada?"
        }
        confirmText={overview?.status === "CANCELED" ? "Ativar" : "Desabilitar"}
        loading={overview?.status === "CANCELED" ? activatingSubscription : cancelingSubscription}
        onCancel={() => setIsCancelSubscriptionOpen(false)}
        onConfirm={overview?.status === "CANCELED" ? handleActivateSubscription : handleCancelSubscription}
      />
      <ConfirmDeleteModal
        isOpen={isClearPaymentsOpen}
        title="Limpar histórico de pagamentos"
        description="Deseja remover todos os pagamentos desta empresa? Esta ação não poderá ser desfeita."
        confirmText="Limpar histórico"
        loading={clearingPayments}
        onCancel={() => setIsClearPaymentsOpen(false)}
        onConfirm={handleClearPayments}
      />
    </div>
  );
}
