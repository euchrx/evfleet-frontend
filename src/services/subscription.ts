import { COMPANY_SCOPE_STORAGE_KEY } from "../contexts/CompanyScopeContext";
import { readAuthToken } from "./authToken";
import { api } from "./api";
import { readSoftwareSettings } from "./adminSettings";

export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";
export type PlanInterval = "MONTHLY" | "YEARLY";
export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUNDED" | "CANCELED";

type BillingPlanApi = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  interval: PlanInterval;
  isActive?: boolean;
  active?: boolean;
};

type BillingSubscriptionApi = {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingAt?: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    currency: string;
    interval: PlanInterval;
  };
};

type BillingPaymentApi = {
  id: string;
  amount?: number;
  amountCents?: number;
  currency?: string;
  status: PaymentStatus;
  dueAt?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  checkoutUrl?: string | null;
  gatewayReference?: string | null;
};

export type SubscriptionOverview = {
  companyId: string;
  companyName: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: PlanInterval;
  amountCents: number;
  currency: string;
  startedAt?: string;
  nextBillingDate?: string;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  currency: string;
  billingCycle: PlanInterval;
  description: string;
  isCurrent: boolean;
};

export type SubscriptionInvoice = {
  id: string;
  date?: string;
  description: string;
  amountCents: number;
  status: PaymentStatus;
  reference?: string;
  checkoutUrl?: string;
};

export type SubscriptionPageData = {
  overview: SubscriptionOverview | null;
  plans: SubscriptionPlan[];
  invoices: SubscriptionInvoice[];
  companyId: string;
  canPayNow: boolean;
  pendingCheckoutUrl?: string;
};

export type CreateBillingPlanInput = {
  code: string;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  interval: PlanInterval;
  active?: boolean;
};

export type UpdateBillingPlanInput = CreateBillingPlanInput;

function decodeTokenPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as { companyId?: string; role?: string; sub?: string };
  } catch {
    return null;
  }
}

function readCompanyIdFromToken() {
  const token = readAuthToken();
  if (!token) return "";
  return decodeTokenPayload(token)?.companyId?.trim() || "";
}

function getSelectedCompanyScopeId() {
  return localStorage.getItem(COMPANY_SCOPE_STORAGE_KEY)?.trim() || "";
}

function getUserContext() {
  const token = readAuthToken();
  const payload = token ? decodeTokenPayload(token) : null;
  const role = String(payload?.role || "").trim().toUpperCase();
  const isAdmin = role === "ADMIN";
  const tokenCompanyId = payload?.companyId?.trim() || readCompanyIdFromToken();
  const selectedCompanyId = getSelectedCompanyScopeId();
  const effectiveCompanyId = isAdmin ? selectedCompanyId : tokenCompanyId;
  return { role, isAdmin, tokenCompanyId, selectedCompanyId, effectiveCompanyId };
}

function toPlanView(plan: BillingPlanApi, currentPlanId?: string): SubscriptionPlan {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    priceCents: Number(plan.priceCents || 0),
    currency: plan.currency || "BRL",
    billingCycle: plan.interval,
    description: (plan.description || "Plano corporativo de assinatura.").trim(),
    isCurrent: currentPlanId === plan.id,
  };
}

function toInvoiceView(payment: BillingPaymentApi, planName: string): SubscriptionInvoice {
  const amountCents =
    typeof payment.amountCents === "number"
      ? payment.amountCents
      : typeof payment.amount === "number"
        ? payment.amount
        : 0;

  return {
    id: payment.id,
    date: payment.createdAt || payment.dueAt || payment.dueDate || payment.paidAt || undefined,
    description: `Assinatura - ${planName}`,
    amountCents: Number(amountCents || 0),
    status: payment.status,
    reference: payment.gatewayReference || payment.id,
    checkoutUrl: payment.checkoutUrl || undefined,
  };
}

export async function getSubscriptionPageData(): Promise<SubscriptionPageData> {
  const context = getUserContext();
  const companyId = context.effectiveCompanyId;

  const plansPromise = api.get<BillingPlanApi[]>("/billing/plans");
  const subscriptionPromise = context.isAdmin
    ? companyId
      ? api.get<BillingSubscriptionApi | null>(`/billing/companies/${companyId}/subscription`)
      : Promise.resolve({ data: null as BillingSubscriptionApi | null })
    : api.get<BillingSubscriptionApi | null>("/billing/me/subscription");

  const paymentsPromise = context.isAdmin
    ? companyId
      ? api.get<BillingPaymentApi[]>(`/billing/companies/${companyId}/payments`)
      : Promise.resolve({ data: [] as BillingPaymentApi[] })
    : api.get<BillingPaymentApi[]>("/billing/me/payments");

  const [subscriptionResponse, plansResponse, paymentsResponse] = await Promise.all([
    subscriptionPromise,
    plansPromise,
    paymentsPromise,
  ]);

  const subscription = subscriptionResponse.data;
  const plansData = Array.isArray(plansResponse.data) ? plansResponse.data : [];
  const paymentsData = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];

  const activePlans = plansData.filter((plan) => plan.isActive !== false && plan.active !== false);
  const plans = activePlans.map((plan) => toPlanView(plan, subscription?.plan?.id));

  const overview: SubscriptionOverview | null = subscription && subscription.plan
    ? {
        companyId,
        companyName: readSoftwareSettings().companyName || "Empresa",
        subscriptionId: subscription.id,
        planId: subscription.plan.id,
        planName: subscription.plan.name,
        status: subscription.status,
        billingCycle: subscription.plan.interval,
        amountCents: Number(subscription.plan.priceCents || 0),
        currency: subscription.plan.currency || "BRL",
        startedAt: subscription.currentPeriodStart || undefined,
        nextBillingDate: subscription.nextBillingAt || undefined,
      }
    : null;

  const invoices = paymentsData.map((payment) => toInvoiceView(payment, subscription?.plan?.name || "Plano"));

  const hasPendingPayment = paymentsData.some((payment) => payment.status === "PENDING");
  const pendingPayment = paymentsData.find((payment) => payment.status === "PENDING");
  const canPayNow = Boolean(subscription && (subscription.status === "PAST_DUE" || !hasPendingPayment));

  return {
    overview,
    plans,
    invoices,
    companyId,
    canPayNow,
    pendingCheckoutUrl: pendingPayment?.checkoutUrl || undefined,
  };
}

export async function selectCompanyPlan(companyId: string, planId: string) {
  const context = getUserContext();
  if (!context.isAdmin) {
    throw new Error("Somente administrador pode alterar o plano da empresa.");
  }

  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }

  await api.post(`/billing/companies/${targetCompanyId}/subscription`, { planId });
}

export async function generateSubscriptionPayment(subscriptionId: string) {
  const context = getUserContext();
  const { data } = context.isAdmin
    ? await api.post<{ checkoutUrl?: string }>(`/billing/subscriptions/${subscriptionId}/pay`)
    : await api.post<{ checkoutUrl?: string }>("/billing/me/pay");

  if (!data?.checkoutUrl) {
    throw new Error("Não foi possível obter a URL de checkout do pagamento.");
  }

  return data.checkoutUrl;
}

export async function createBillingPlan(input: CreateBillingPlanInput) {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    priceCents: Number(input.priceCents),
    currency: (input.currency || "BRL").trim().toUpperCase(),
    interval: input.interval,
    active: input.active ?? true,
  };

  await api.post("/billing/plans", payload);
}

export async function updateBillingPlan(planId: string, input: UpdateBillingPlanInput) {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    priceCents: Number(input.priceCents),
    currency: (input.currency || "BRL").trim().toUpperCase(),
    interval: input.interval,
    active: input.active ?? true,
  };

  await api.patch(`/billing/plans/${planId}`, payload);
}

export async function deleteBillingPlan(planId: string) {
  await api.delete(`/billing/plans/${planId}`);
}

export async function cancelCompanySubscription(companyId: string) {
  const context = getUserContext();
  if (!context.isAdmin) {
    throw new Error("Somente administrador pode desabilitar assinatura.");
  }
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }
  await api.post(`/billing/companies/${targetCompanyId}/subscription/cancel`);
}

export async function activateCompanySubscription(companyId: string) {
  const context = getUserContext();
  if (!context.isAdmin) {
    throw new Error("Somente administrador pode ativar assinatura.");
  }
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }
  await api.post(`/billing/companies/${targetCompanyId}/subscription/activate`);
}
