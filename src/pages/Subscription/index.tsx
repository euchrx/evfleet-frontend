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
  resetCompanySubscriptionOperationalState,
  selectCompanyPlan,
  setCompanySubscriptionActive,
  setCompanySubscriptionSetup,
  setCompanySubscriptionTrial,
  updateBillingPlan,
  type BillingAccessStatus,
  type PlanInterval,
  type PaymentStatus,
  type SelectCompanyPlanInput,
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
  if (status === "DRAFT") return "Em configuração";
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIALING") return "Período de teste";
  if (status === "PAST_DUE") return "Inadimplente";
  return "Cancelada";
}

function accessStatusLabel(status?: BillingAccessStatus | null) {
  if (status === "NO_PLAN") return "Sem plano";
  if (status === "SETUP_REQUIRED") return "Configuração pendente";
  if (status === "TRIALING") return "Período de teste";
  if (status === "ACTIVE") return "Assinatura ativa";
  if (status === "GRACE_PERIOD") return "Em tolerância";
  if (status === "BLOCKED") return "Bloqueado";
  return "Sem status";
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

function getAccessStatusAlert(status?: BillingAccessStatus | null, message?: string) {
  if (!status) return null;

  if (status === "NO_PLAN") {
    return {
      className: "border-slate-300 bg-slate-50 text-slate-700",
      message: message || "Nenhum plano vinculado a esta empresa.",
    };
  }

  if (status === "SETUP_REQUIRED") {
    return {
      className: "border-blue-200 bg-blue-50 text-blue-800",
      message: message || "A assinatura foi criada, mas ainda depende de configuração final.",
    };
  }

  if (status === "TRIALING") {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      message: message || "Período de teste ativo.",
    };
  }

  if (status === "ACTIVE") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      message: message || "Assinatura ativa.",
    };
  }

  if (status === "GRACE_PERIOD") {
    return {
      className: "border-orange-200 bg-orange-50 text-orange-800",
      message:
        message || "Pagamento pendente, mas a empresa ainda está dentro do período de tolerância.",
    };
  }

  if (status === "BLOCKED") {
    return {
      className: "border-red-200 bg-red-50 text-red-700",
      message: message || "Acesso operacional bloqueado por inadimplência.",
    };
  }

  return null;
}

function getAccessStatusTextClass(status?: BillingAccessStatus | null) {
  if (status === "ACTIVE") return "text-emerald-700";
  if (status === "TRIALING") return "text-amber-700";
  if (status === "GRACE_PERIOD") return "text-orange-700";
  if (status === "BLOCKED") return "text-red-700";
  if (status === "SETUP_REQUIRED") return "text-blue-700";
  return "text-slate-700";
}

function parseDateSafe(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isStarterPlan(plan?: Pick<SubscriptionPlan, "code" | "name"> | null) {
  const code = String(plan?.code || "").trim().toUpperCase();
  const name = String(plan?.name || "").trim().toUpperCase();
  return code === "STA" || code === "STARTER" || name.includes("STARTER");
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as {
    response?: {
      data?: {
        message?: string | string[];
      };
    };
    message?: string;
  };

  const apiMessage = axiosError?.response?.data?.message;
  if (Array.isArray(apiMessage) && apiMessage.length > 0) {
    return apiMessage.join(", ");
  }
  if (typeof apiMessage === "string" && apiMessage.trim()) {
    return apiMessage;
  }
  if (typeof axiosError?.message === "string" && axiosError.message.trim()) {
    return axiosError.message;
  }
  return fallback;
}


type PlanSelectionConfig = {
  trialDays: string;
  graceDays: string;
  customPriceCents: string;
  customVehicleLimit: string;
  useSnapshot: boolean;
};

function buildPlanSelectionDefaults(plan?: SubscriptionPlan | null): PlanSelectionConfig {
  return {
    trialDays:
      typeof plan?.defaultTrialDays === "number" && plan.defaultTrialDays >= 0
        ? String(plan.defaultTrialDays)
        : "",
    graceDays:
      typeof plan?.defaultGraceDays === "number" && plan.defaultGraceDays >= 0
        ? String(plan.defaultGraceDays)
        : "",
    customPriceCents: "",
    customVehicleLimit: "",
    useSnapshot: true,
  };
}

function parseOptionalNonNegativeInt(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("Informe apenas números válidos.");
  }
  return Math.max(0, Math.floor(parsed));
}

function parseOptionalPositiveInt(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Informe apenas valores maiores que zero.");
  }
  return Math.floor(parsed);
}

type PlanFormState = {
  code: string;
  name: string;
  description: string;
  priceCents: string;
  vehicleLimit: string;
  interval: PlanInterval;
  isPublic: boolean;
  isEnterprise: boolean;
  companyId: string;
  defaultTrialDays: string;
  defaultGraceDays: string;
  allowsCustomPrice: boolean;
  allowsCustomVehicleLimit: boolean;
  sortOrder: string;
};

function buildEmptyPlanForm(companyId = ""): PlanFormState {
  return {
    code: "",
    name: "",
    description: "",
    priceCents: "",
    vehicleLimit: "",
    interval: "MONTHLY",
    isPublic: true,
    isEnterprise: false,
    companyId,
    defaultTrialDays: "",
    defaultGraceDays: "",
    allowsCustomPrice: false,
    allowsCustomVehicleLimit: false,
    sortOrder: "0",
  };
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
  const [isResetOperationalStateOpen, setIsResetOperationalStateOpen] = useState(false);
  const [resettingOperationalState, setResettingOperationalState] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [selectedPlanActivationStatus, setSelectedPlanActivationStatus] =
    useState<Extract<SubscriptionStatus, "ACTIVE" | "TRIALING">>("TRIALING");
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [planSelectionConfig, setPlanSelectionConfig] = useState<PlanSelectionConfig>(
    buildPlanSelectionDefaults(),
  );
  const [newPlan, setNewPlan] = useState<PlanFormState>(buildEmptyPlanForm(selectedCompanyId || ""));

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

  useEffect(() => {
    setPlanSelectionConfig(buildPlanSelectionDefaults(selectedPlanForCheckout));
  }, [selectedPlanForCheckout?.id]);
  useEffect(() => {
    setNewPlan((current) => {
      const scopedCompanyId = selectedCompanyId || data?.companyId || "";
      if (!current.isEnterprise) return current;
      if (current.companyId === scopedCompanyId) return current;
      return { ...current, companyId: scopedCompanyId };
    });
  }, [selectedCompanyId, data?.companyId]);

  const overview = data?.overview || null;
  const access = data?.access || null;
  const plans = data?.plans || [];
  const invoices = data?.invoices || [];
  const canManagePlans = user?.role === "ADMIN";
  const hasCompanyScope = Boolean(data?.companyId);
  const statusAlert = getAccessStatusAlert(access?.accessStatus, access?.message);
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
      access?.accessStatus !== "GRACE_PERIOD" &&
      access?.accessStatus !== "BLOCKED" &&
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
  const trialEnded =
    access?.accessStatus === "GRACE_PERIOD" || access?.accessStatus === "BLOCKED";

  function canStartTrialForPlan(plan?: SubscriptionPlan | null) {
    if (!plan) return false;
    if (!isStarterPlan(plan)) return false;

    return (
      !access ||
      access.accessStatus === "NO_PLAN" ||
      access.accessStatus === "SETUP_REQUIRED" ||
      access.accessStatus === "TRIALING"
    );
  }

  function getSuggestedActivationStatus(plan?: SubscriptionPlan | null) {
    return canStartTrialForPlan(plan) ? "TRIALING" : "ACTIVE";
  }

  function requiresCheckoutOnSelection(plan?: SubscriptionPlan | null) {
    if (!plan) return false;

    if (plan.isCurrent) {
      return access?.accessStatus === "BLOCKED" || overview?.status === "CANCELED";
    }

    return getSuggestedActivationStatus(plan) === "ACTIVE";
  }

  function redirectToCheckout(checkoutUrl: string) {
    const normalizedUrl = String(checkoutUrl || "").trim();
    if (!normalizedUrl) {
      throw new Error("Checkout não disponível no momento.");
    }

    window.location.href = normalizedUrl;
  }

  function openCreatePlanModal() {
    setEditingPlan(null);
    setNewPlan(buildEmptyPlanForm(selectedCompanyId || data?.companyId || ""));
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
      isPublic: Boolean(plan.isPublic),
      isEnterprise: Boolean(plan.isEnterprise),
      companyId: plan.companyId || selectedCompanyId || data?.companyId || "",
      defaultTrialDays:
        typeof plan.defaultTrialDays === "number" && plan.defaultTrialDays >= 0
          ? String(plan.defaultTrialDays)
          : "",
      defaultGraceDays:
        typeof plan.defaultGraceDays === "number" && plan.defaultGraceDays >= 0
          ? String(plan.defaultGraceDays)
          : "",
      allowsCustomPrice: Boolean(plan.allowsCustomPrice),
      allowsCustomVehicleLimit: Boolean(plan.allowsCustomVehicleLimit),
      sortOrder:
        typeof plan.sortOrder === "number" && Number.isFinite(plan.sortOrder)
          ? String(plan.sortOrder)
          : "0",
    });
    setIsPlanModalOpen(true);
  }

  async function handleSelectPlan(
    planId: string,
    initialStatus: Extract<SubscriptionStatus, "ACTIVE" | "TRIALING" | "DRAFT"> = "TRIALING",
    overrides?: {
      trialDays?: number;
      graceDays?: number;
      customPriceCents?: number;
      customVehicleLimit?: number;
      isCustomConfiguration?: boolean;
      planNameSnapshot?: string;
      planCodeSnapshot?: string;
      priceCentsSnapshot?: number;
      vehicleLimitSnapshot?: number;
      currencySnapshot?: string;
      intervalSnapshot?: PlanInterval;
    },
  ) {
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setSubmittingPlanId(planId);
      setErrorMessage("");
      await selectCompanyPlan(data.companyId, planId, {
        initialStatus,
        ...overrides,
      });
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível selecionar o plano.",
      );
    } finally {
      setSubmittingPlanId(null);
    }
  }

  function buildSelectedPlanOverrides(plan?: SubscriptionPlan | null) {
    if (!plan) return undefined;

    const trialDays = parseOptionalNonNegativeInt(planSelectionConfig.trialDays);
    const graceDays = parseOptionalNonNegativeInt(planSelectionConfig.graceDays);
    const customPriceCents = plan.allowsCustomPrice
      ? parseOptionalPositiveInt(planSelectionConfig.customPriceCents)
      : undefined;
    const customVehicleLimit = plan.allowsCustomVehicleLimit
      ? parseOptionalPositiveInt(planSelectionConfig.customVehicleLimit)
      : undefined;

    const hasCustomConfiguration =
      trialDays !== undefined ||
      graceDays !== undefined ||
      customPriceCents !== undefined ||
      customVehicleLimit !== undefined;

    return {
      ...(trialDays !== undefined ? { trialDays } : {}),
      ...(graceDays !== undefined ? { graceDays } : {}),
      ...(customPriceCents !== undefined ? { customPriceCents } : {}),
      ...(customVehicleLimit !== undefined ? { customVehicleLimit } : {}),
      ...(hasCustomConfiguration ? { isCustomConfiguration: true } : {}),
      ...(planSelectionConfig.useSnapshot
        ? {
            planNameSnapshot: plan.name,
            planCodeSnapshot: plan.code,
            priceCentsSnapshot: customPriceCents ?? plan.priceCents,
            vehicleLimitSnapshot: customVehicleLimit ?? plan.vehicleLimit ?? undefined,
            currencySnapshot: plan.currency,
            intervalSnapshot: plan.billingCycle,
          }
        : {}),
    };
  }

  function buildPlanCommandPayload(plan?: SubscriptionPlan | null): Omit<
    SelectCompanyPlanInput,
    "initialStatus"
  > | undefined {
    if (!plan) return undefined;
    return buildSelectedPlanOverrides(plan);
  }

  async function handleSetPlanSetup(plan: SubscriptionPlan) {
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setSubmittingPlanId(plan.id);
      setErrorMessage("");
      await setCompanySubscriptionSetup(
        data.companyId,
        plan.id,
        buildPlanCommandPayload(plan),
      );
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível colocar a assinatura em setup.",
      );
    } finally {
      setSubmittingPlanId(null);
    }
  }

  async function handleSetPlanTrial(plan: SubscriptionPlan) {
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setSubmittingPlanId(plan.id);
      setErrorMessage("");
      await setCompanySubscriptionTrial(
        data.companyId,
        plan.id,
        buildPlanCommandPayload(plan),
      );
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar o período de teste.",
      );
    } finally {
      setSubmittingPlanId(null);
    }
  }

  async function handleSetPlanActive(plan: SubscriptionPlan) {
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setSubmittingPlanId(plan.id);
      setErrorMessage("");
      await setCompanySubscriptionActive(
        data.companyId,
        plan.id,
        buildPlanCommandPayload(plan),
      );
      await loadData();
    } catch (error) {
      setErrorMessage(
        getRequestErrorMessage(error, "Não foi possível ativar a assinatura."),
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
    if (!data?.companyId) {
      setErrorMessage("Selecione uma empresa no escopo para continuar.");
      return;
    }

    try {
      setRedirectingToCheckout(true);
      setErrorMessage("");
      let subscriptionId = data.overview?.subscriptionId;
      if (!subscriptionId) {
        const initialStatus = canStartTrialForPlan(selectedPlanForCheckout) ? "TRIALING" : "ACTIVE";
        await handleSelectPlan(
          selectedPlanForCheckout.id,
          initialStatus,
          buildSelectedPlanOverrides(selectedPlanForCheckout),
        );
        const refreshed = await getSubscriptionPageData();
        setData(refreshed);
        subscriptionId = refreshed.overview?.subscriptionId;
      }

      if (!subscriptionId) {
        throw new Error("Assinatura não encontrada para gerar o checkout.");
      }

      const checkoutUrl = await generateSubscriptionPayment(
        subscriptionId,
        selectedPlanForCheckout.id,
      );
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
    if (plan.isCurrent && access?.accessStatus === "BLOCKED") return "Regularizar e pagar";
    if (plan.isCurrent && overview?.status === "CANCELED") return "Reativar e pagar";
    if (plan.isCurrent && overview) return "Ver assinatura";
    return requiresCheckoutOnSelection(plan) ? "Selecionar e pagar" : "Selecionar plano";
  }

  function getSelfServicePlanStatus(): Extract<SubscriptionStatus, "ACTIVE" | "TRIALING"> {
    return getSuggestedActivationStatus(selectedPlanForCheckout);
  }

  const selectedPlanAllowsTrial = canStartTrialForPlan(selectedPlanForCheckout);
  const selectedPlanRequiresCheckout = requiresCheckoutOnSelection(
    selectedPlanForCheckout,
  );
  const selectedPlanIsStarter = isStarterPlan(selectedPlanForCheckout);
  const selectedPlanIsCanceledCurrent =
    Boolean(selectedPlanForCheckout?.isCurrent) &&
    (overview?.status === "CANCELED" || access?.accessStatus === "BLOCKED");

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
        ...(newPlan.description.trim()
          ? { description: newPlan.description.trim() }
          : {}),
        priceCents: Number(newPlan.priceCents),
        vehicleLimit: newPlan.vehicleLimit ? Number(newPlan.vehicleLimit) : undefined,
        interval: newPlan.interval,
        currency: "BRL",
        active: true,
        isPublic: newPlan.isPublic,
        isEnterprise: newPlan.isEnterprise,
        ...(newPlan.isEnterprise && newPlan.companyId.trim()
          ? { companyId: newPlan.companyId.trim() }
          : {}),
      };
      if (editingPlan?.id) {
        await updateBillingPlan(editingPlan.id, payload);
      } else {
        await createBillingPlan(payload);
      }
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      setNewPlan(buildEmptyPlanForm(selectedCompanyId || data?.companyId || ""));
      await loadData();
    } catch (error) {
      setErrorMessage(
        getRequestErrorMessage(
          error,
          editingPlan
            ? "Não foi possível atualizar o plano."
            : "Não foi possível adicionar o plano.",
        ),
      );
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleResetOperationalState() {
    if (!data?.companyId) return;
    try {
      setResettingOperationalState(true);
      setErrorMessage("");
      await resetCompanySubscriptionOperationalState(data.companyId);
      setIsResetOperationalStateOpen(false);
      await loadData();
    } catch (error) {
      setErrorMessage(
        getRequestErrorMessage(error, "Não foi possível resetar o estado operacional."),
      );
    } finally {
      setResettingOperationalState(false);
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
      setErrorMessage(getRequestErrorMessage(error, "Não foi possível remover o plano."));
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
        getRequestErrorMessage(error, "Não foi possível desabilitar a assinatura."),
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
        getRequestErrorMessage(error, "Não foi possível ativar a assinatura."),
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
          {overview && data?.canPayNow && access?.accessStatus !== "NO_PLAN" ? (
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
              : access?.accessStatus === "NO_PLAN"
                ? "Esta empresa ainda não possui plano vinculado."
                : "Nenhuma assinatura encontrada para esta empresa."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status operacional
                  </p>

                </div>
                <p className={`mt-2 text-lg font-bold ${getAccessStatusTextClass(access?.accessStatus)}`}>
                  {accessStatusLabel(access?.accessStatus)}
                </p>
                {overview ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Assinatura: {subscriptionStatusLabel(overview.status)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Plano atual</p>
                <p className="mt-1 text-lg font-bold text-blue-900">{overview.planName}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {access?.accessStatus === "TRIALING"
                    ? "Fim do trial"
                    : access?.accessStatus === "GRACE_PERIOD"
                      ? "Fim da tolerância"
                      : access?.accessStatus === "BLOCKED"
                        ? "Bloqueado em"
                        : "Próxima cobrança"}
                </p>
                <p className="mt-1 text-lg font-bold text-amber-900">
                  {formatDate(
                    access?.accessStatus === "TRIALING"
                      ? access?.trialEndsAt
                      : access?.accessStatus === "GRACE_PERIOD"
                        ? access?.graceEndsAt
                        : access?.accessStatus === "BLOCKED"
                          ? access?.accessBlockedAt
                          : overview.nextBillingDate,
                  )}
                </p>
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
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.isCurrent ? <span className="status-pill status-pending">Plano atual</span> : null}
                    {canManagePlans ? (
                      <>
                        {plan.isCurrent && hasCompanyScope && overview ? (
                          <button
                            type="button"
                            onClick={() => setIsCancelSubscriptionOpen(true)}
                            disabled={isSubmitting}
                            title={
                              overview.status === "CANCELED"
                                ? "Ativar assinatura da empresa"
                                : "Desabilitar assinatura da empresa"
                            }
                            className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              overview.status === "CANCELED"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            <Power size={15} />
                          </button>
                        ) : null}
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
                    setSelectedPlanActivationStatus(getSuggestedActivationStatus(plan));
                    setPlanSelectionConfig(buildPlanSelectionDefaults(plan));
                  }}
                  disabled={(canManagePlans && !hasCompanyScope) || isSubmitting || redirectingToCheckout || plan.active === false}
                  title={plan.active === false ? "Plano inativo não pode ser usado." : undefined}
                  className={`mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    (canManagePlans && !hasCompanyScope) || plan.active === false
                      ? "cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-500"
                      : "cursor-pointer bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  }`}
                >
                  {isSubmitting || redirectingToCheckout ? "Carregando..." : getPlanActionLabel(plan)}
                </button>

                {canManagePlans && hasCompanyScope ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handleSetPlanTrial(plan)}
                      disabled={isSubmitting || redirectingToCheckout || plan.active === false}
                      title={plan.active === false ? "Plano inativo não pode ser usado." : undefined}
                      className="cursor-pointer rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Forçar trial
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPlanActive(plan)}
                      disabled={isSubmitting || redirectingToCheckout || plan.active === false}
                      title={plan.active === false ? "Plano inativo não pode ser usado." : undefined}
                      className="cursor-pointer rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Setar pago
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPlanSetup(plan)}
                      disabled={isSubmitting || redirectingToCheckout || plan.active === false}
                      title={plan.active === false ? "Plano inativo não pode ser usado." : undefined}
                      className="cursor-pointer rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Voltar setup
                    </button>
                  </div>
                ) : null}
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
                  setSelectedPlanActivationStatus("ACTIVE");
                  setPlanSelectionConfig(buildPlanSelectionDefaults());
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
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedPlanForCheckout.active === false ? "Inativo" : "Disponível"}
                  </p>
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

              {canManagePlans && selectedPlanAllowsTrial ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Tipo de ativação ao vincular o plano
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
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

              {!selectedPlanAllowsTrial ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  {selectedPlanIsStarter
                    ? trialEnded || selectedPlanIsCanceledCurrent
                      ? "O periodo de teste do plano Starter ja foi encerrado. Para continuar, o checkout sera iniciado na proxima etapa."
                      : "Este plano seguira diretamente para pagamento."
                    : "O periodo de teste esta disponivel apenas para o plano Starter. Este plano seguira diretamente para pagamento."}
                </div>
              ) : null}

              {canManagePlans ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Configuração da assinatura</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Use estes campos para setup, trial customizado ou assinatura enterprise com snapshot comercial.
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedPlanForCheckout.isEnterprise ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"}`}>
                      {selectedPlanForCheckout.isEnterprise ? "Enterprise" : "Plano público"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trial (dias)</span>
                      <input
                        type="number"
                        min={0}
                        value={planSelectionConfig.trialDays}
                        onChange={(event) =>
                          setPlanSelectionConfig((current) => ({ ...current, trialDays: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400"
                        placeholder={selectedPlanForCheckout.defaultTrialDays != null ? String(selectedPlanForCheckout.defaultTrialDays) : "0"}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grace (dias)</span>
                      <input
                        type="number"
                        min={0}
                        value={planSelectionConfig.graceDays}
                        onChange={(event) =>
                          setPlanSelectionConfig((current) => ({ ...current, graceDays: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400"
                        placeholder={selectedPlanForCheckout.defaultGraceDays != null ? String(selectedPlanForCheckout.defaultGraceDays) : "5"}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preço customizado (centavos)</span>
                      <input
                        type="number"
                        min={1}
                        value={planSelectionConfig.customPriceCents}
                        onChange={(event) =>
                          setPlanSelectionConfig((current) => ({ ...current, customPriceCents: event.target.value }))
                        }
                        disabled={!selectedPlanForCheckout.allowsCustomPrice}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                        placeholder={selectedPlanForCheckout.allowsCustomPrice ? String(selectedPlanForCheckout.priceCents) : "Plano não permite"}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limite customizado de veículos</span>
                      <input
                        type="number"
                        min={1}
                        value={planSelectionConfig.customVehicleLimit}
                        onChange={(event) =>
                          setPlanSelectionConfig((current) => ({ ...current, customVehicleLimit: event.target.value }))
                        }
                        disabled={!selectedPlanForCheckout.allowsCustomVehicleLimit}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-orange-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                        placeholder={selectedPlanForCheckout.allowsCustomVehicleLimit ? String(selectedPlanForCheckout.vehicleLimit || "") : "Plano não permite"}
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={planSelectionConfig.useSnapshot}
                      onChange={(event) =>
                        setPlanSelectionConfig((current) => ({ ...current, useSnapshot: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                    />
                    Salvar snapshot comercial da configuração aplicada nesta assinatura.
                  </label>
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
              {canManagePlans && selectedPlanAllowsTrial ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedPlanForCheckout?.id) return;
                    await handleSelectPlan(
                      selectedPlanForCheckout.id,
                      selectedPlanActivationStatus,
                      buildSelectedPlanOverrides(selectedPlanForCheckout),
                    );
                    setSelectedPlanForCheckout(null);
                    setSelectedPlanActivationStatus("ACTIVE");
                    setPlanSelectionConfig(buildPlanSelectionDefaults());
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
                    setSelectedPlanActivationStatus("ACTIVE");
                    setPlanSelectionConfig(buildPlanSelectionDefaults());
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
                  {redirectingToCheckout
                    ? "Redirecionando..."
                    : selectedPlanAllowsTrial
                      ? "Ir para pagamento"
                      : "Selecionar plano e pagar"}
                </button>
              ) : selectedPlanForCheckout.isCurrent ? (
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={payingNow || !data?.canPayNow || paymentWindowBlocked}
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payingNow
                    ? "Redirecionando..."
                    : paymentWindowBlocked
                      ? "Pago no ciclo atual"
                      : access?.accessStatus === "BLOCKED" || overview?.status === "CANCELED"
                        ? "Regularizar e pagar"
                        : "Pagar agora"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    selectedPlanRequiresCheckout
                      ? handleSelectPlanAndPay
                      : async () => {
                          if (!selectedPlanForCheckout?.id) return;
                          await handleSelectPlan(
                            selectedPlanForCheckout.id,
                            getSelfServicePlanStatus(),
                            buildSelectedPlanOverrides(selectedPlanForCheckout),
                          );
                          setSelectedPlanForCheckout(null);
                          setSelectedPlanActivationStatus("ACTIVE");
                          setPlanSelectionConfig(buildPlanSelectionDefaults());
                        }
                  }
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  {selectedPlanRequiresCheckout
                    ? "Selecionar plano e pagar"
                    : "Selecionar plano"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Histórico de pagamentos</h2>
        {canManagePlans ? (
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsResetOperationalStateOpen(true)}
              className="inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              title="Resetar state operacional da assinatura"
            >
              Reset operacional
            </button>
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
                  <textarea
                    rows={3}
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
                    min={1}
                    value={newPlan.priceCents}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, priceCents: event.target.value }))
                    }
                    placeholder="Ex: 59900"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Limite de veículos</label>
                  <input
                    type="number"
                    min={1}
                    value={newPlan.vehicleLimit}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, vehicleLimit: event.target.value }))
                    }
                    placeholder="Ex: 20 (vazio = ilimitado)"
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
                <div>
                  <label className="block text-sm font-medium text-slate-700">Ordem</label>
                  <input
                    type="number"
                    min={0}
                    value={newPlan.sortOrder}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, sortOrder: event.target.value }))
                    }
                    placeholder="0"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Trial padrão (dias)</label>
                  <input
                    type="number"
                    min={0}
                    value={newPlan.defaultTrialDays}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, defaultTrialDays: event.target.value }))
                    }
                    placeholder="Ex: 7"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Grace padrão (dias)</label>
                  <input
                    type="number"
                    min={0}
                    value={newPlan.defaultGraceDays}
                    onChange={(event) =>
                      setNewPlan((prev) => ({ ...prev, defaultGraceDays: event.target.value }))
                    }
                    placeholder="Ex: 5"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-800">Classificação do plano</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newPlan.isPublic}
                        onChange={(event) =>
                          setNewPlan((prev) => ({ ...prev, isPublic: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">Plano público</span>
                        <span className="block text-xs text-slate-500">
                          Aparece como opção padrão para seleção comum.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newPlan.isEnterprise}
                        onChange={(event) =>
                          setNewPlan((prev) => ({ ...prev, isEnterprise: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">Plano enterprise</span>
                        <span className="block text-xs text-slate-500">
                          Pode servir como base para contratos customizados.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-sm font-semibold text-slate-800">Capacidade de customização</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newPlan.allowsCustomPrice}
                        onChange={(event) =>
                          setNewPlan((prev) => ({ ...prev, allowsCustomPrice: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">Permite preço customizado</span>
                        <span className="block text-xs text-slate-500">
                          Autoriza sobrescrever o valor na assinatura.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newPlan.allowsCustomVehicleLimit}
                        onChange={(event) =>
                          setNewPlan((prev) => ({ ...prev, allowsCustomVehicleLimit: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">Permite limite customizado</span>
                        <span className="block text-xs text-slate-500">
                          Autoriza sobrescrever o limite de veículos na assinatura.
                        </span>
                      </span>
                    </label>
                  </div>
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
      <ConfirmDeleteModal
        isOpen={isResetOperationalStateOpen}
        title="Resetar estado operacional"
        description="Deseja limpar bloqueios e datas operacionais da assinatura atual? Isso não apaga pagamentos nem remove o histórico comercial."
        confirmText="Resetar"
        loading={resettingOperationalState}
        onCancel={() => setIsResetOperationalStateOpen(false)}
        onConfirm={handleResetOperationalState}
      />
    </div>
  );
}
