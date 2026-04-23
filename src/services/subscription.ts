import { COMPANY_SCOPE_STORAGE_KEY } from "../contexts/CompanyScopeContext";
import { readAuthToken } from "./authToken";
import { api } from "./api";
import { readSoftwareSettings } from "./adminSettings";

export type SubscriptionStatus =
  | "DRAFT"
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED";

export type BillingAccessStatus =
  | "NO_PLAN"
  | "SETUP_REQUIRED"
  | "TRIALING"
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "BLOCKED";

export type PlanInterval = "MONTHLY" | "YEARLY";
export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELED";

type BillingPlanApi = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceCents: number;
  vehicleLimit?: number | null;
  currency: string;
  interval: PlanInterval;
  active?: boolean;
  isPublic?: boolean;
  isEnterprise?: boolean;
  companyId?: string | null;
  defaultTrialDays?: number | null;
  defaultGraceDays?: number | null;
  allowsCustomPrice?: boolean;
  allowsCustomVehicleLimit?: boolean;
  sortOrder?: number | null;
};

type BillingSubscriptionApi = {
  id: string;
  status: SubscriptionStatus;
  startedAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingAt?: string | null;
  trialDays?: number | null;
  graceDays?: number | null;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
  accessBlockedAt?: string | null;
  isCustomConfiguration?: boolean;
  customPriceCents?: number | null;
  customVehicleLimit?: number | null;
  planNameSnapshot?: string | null;
  planCodeSnapshot?: string | null;
  priceCentsSnapshot?: number | null;
  vehicleLimitSnapshot?: number | null;
  currencySnapshot?: string | null;
  intervalSnapshot?: PlanInterval | null;
  plan?: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    currency: string;
    interval: PlanInterval;
  } | null;
};

type BillingAccessStatusApi = {
  companyId: string;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  accessStatus: BillingAccessStatus;
  isBlocked: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  nextBillingAt: string | null;
  graceEndsAt: string | null;
  accessBlockedAt: string | null;
  message: string;
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
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
  gatewayReference?: string | null;
};

export type SubscriptionAccessOverview = {
  companyId: string;
  subscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus | null;
  accessStatus: BillingAccessStatus;
  isBlocked: boolean;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  nextBillingAt?: string;
  graceEndsAt?: string;
  accessBlockedAt?: string;
  message: string;
};

export type SubscriptionOverview = {
  companyId: string;
  companyName: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  planCode?: string;
  status: SubscriptionStatus;
  billingCycle: PlanInterval;
  amountCents: number;
  currency: string;
  startedAt?: string;
  currentPeriodEnd?: string;
  nextBillingDate?: string;
  trialDays?: number;
  graceDays?: number;
  trialEndsAt?: string;
  graceEndsAt?: string;
  accessBlockedAt?: string;
  isCustomConfiguration: boolean;
  customPriceCents?: number;
  customVehicleLimit?: number;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  vehicleLimit?: number | null;
  currency: string;
  billingCycle: PlanInterval;
  description: string;
  isCurrent: boolean;
  active?: boolean;
  isPublic?: boolean;
  isEnterprise?: boolean;
  companyId?: string | null;
  defaultTrialDays?: number | null;
  defaultGraceDays?: number | null;
  allowsCustomPrice?: boolean;
  allowsCustomVehicleLimit?: boolean;
  sortOrder?: number | null;
};

export type SubscriptionInvoice = {
  id: string;
  date?: string;
  paidAt?: string;
  description: string;
  amountCents: number;
  status: PaymentStatus;
  reference?: string;
  checkoutUrl?: string;
  invoiceUrl?: string;
};

export type SubscriptionPageData = {
  overview: SubscriptionOverview | null;
  access: SubscriptionAccessOverview | null;
  plans: SubscriptionPlan[];
  invoices: SubscriptionInvoice[];
  companyId: string;
  canPayNow: boolean;
  pendingCheckoutUrl?: string;
};

export type CheckPaymentResult = {
  confirmed: boolean;
  paymentStatus?: string;
  message?: string;
  paymentId?: string;
  orderNsu?: string;
  transactionNsu?: string;
  receiptUrl?: string;
};

export type CreateBillingPlanInput = {
  code: string;
  name: string;
  description?: string;
  priceCents: number;
  vehicleLimit?: number;
  currency?: string;
  interval: PlanInterval;
  active?: boolean;
  isPublic?: boolean;
  isEnterprise?: boolean;
  companyId?: string;
  defaultTrialDays?: number;
  defaultGraceDays?: number;
  allowsCustomPrice?: boolean;
  allowsCustomVehicleLimit?: boolean;
  sortOrder?: number;
};

export type UpdateBillingPlanInput = CreateBillingPlanInput;

export type SelectCompanyPlanInput = {
  initialStatus?: Extract<SubscriptionStatus, "DRAFT" | "ACTIVE" | "TRIALING">;
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
};

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
    vehicleLimit:
      typeof plan.vehicleLimit === "number" && plan.vehicleLimit > 0
        ? Number(plan.vehicleLimit)
        : null,
    currency: plan.currency || "BRL",
    billingCycle: plan.interval,
    description: (plan.description || "Plano corporativo de assinatura.").trim(),
    isCurrent: currentPlanId === plan.id,
    active: plan.active ?? true,
    companyId: typeof plan.companyId === "string" ? plan.companyId : null,
    isPublic: plan.isPublic,
    isEnterprise: plan.isEnterprise,
    defaultTrialDays:
      typeof plan.defaultTrialDays === "number" ? plan.defaultTrialDays : null,
    defaultGraceDays:
      typeof plan.defaultGraceDays === "number" ? plan.defaultGraceDays : null,
    allowsCustomPrice: Boolean(plan.allowsCustomPrice),
    allowsCustomVehicleLimit: Boolean(plan.allowsCustomVehicleLimit),
    sortOrder: typeof plan.sortOrder === "number" ? plan.sortOrder : null,
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
    paidAt: payment.paidAt || undefined,
    description: `Assinatura - ${planName}`,
    amountCents: Number(amountCents || 0),
    status: payment.status,
    reference: payment.gatewayReference || payment.id,
    checkoutUrl: payment.checkoutUrl || undefined,
    invoiceUrl: payment.invoiceUrl || payment.receiptUrl || undefined,
  };
}


function buildFallbackAccessFromSubscription(
  subscription: BillingSubscriptionApi | null,
  companyId: string,
): SubscriptionAccessOverview | null {
  if (!subscription) {
    return {
      companyId,
      accessStatus: "NO_PLAN",
      subscriptionStatus: null,
      isBlocked: false,
      message: "Nenhum plano vinculado.",
    };
  }

  const status = subscription.status;
  const accessStatus: BillingAccessStatus =
    status === "ACTIVE"
      ? "ACTIVE"
      : status === "TRIALING"
        ? "TRIALING"
        : status === "PAST_DUE"
          ? "BLOCKED"
          : "NO_PLAN";

  return {
    companyId,
    subscriptionId: subscription.id,
    subscriptionStatus: status,
    accessStatus,
    isBlocked: accessStatus === "BLOCKED",
    trialEndsAt: subscription.trialEndsAt || undefined,
    currentPeriodEnd: subscription.currentPeriodEnd || undefined,
    nextBillingAt: subscription.nextBillingAt || undefined,
    graceEndsAt: subscription.graceEndsAt || undefined,
    accessBlockedAt: subscription.accessBlockedAt || undefined,
    message:
      accessStatus === "ACTIVE"
        ? "Assinatura ativa."
        : accessStatus === "TRIALING"
          ? "Período de teste ativo."
          : accessStatus === "BLOCKED"
            ? "Acesso bloqueado por pendência de pagamento."
            : "Nenhum plano vinculado.",
  };
}

async function fetchAccessStatusWithFallback(companyId?: string): Promise<SubscriptionAccessOverview | null> {
  const context = getUserContext();
  const resolvedCompanyId = context.isAdmin
    ? String(companyId || context.effectiveCompanyId || "").trim()
    : "";

  try {
    if (context.isAdmin) {
      if (!resolvedCompanyId) return null;
      const { data } = await api.get<BillingSubscriptionApi | null>(
        `/billing/companies/${resolvedCompanyId}/subscription`,
      );
      return buildFallbackAccessFromSubscription(data, resolvedCompanyId);
    }

    const { data } = await api.get<BillingSubscriptionApi | null>("/billing/me/subscription");
    return buildFallbackAccessFromSubscription(data, "me");
  } catch {
    return null;
  }
}
export function toAccessOverview(access: BillingAccessStatusApi | null): SubscriptionAccessOverview | null {
  if (!access) return null;

  return {
    companyId: access.companyId,
    subscriptionId: access.subscriptionId || undefined,
    subscriptionStatus: access.subscriptionStatus ?? null,
    accessStatus: access.accessStatus,
    isBlocked: Boolean(access.isBlocked),
    trialEndsAt: access.trialEndsAt || undefined,
    currentPeriodEnd: access.currentPeriodEnd || undefined,
    nextBillingAt: access.nextBillingAt || undefined,
    graceEndsAt: access.graceEndsAt || undefined,
    accessBlockedAt: access.accessBlockedAt || undefined,
    message: String(access.message || "").trim(),
  };
}

function normalizeSubscriptionCommandPayload(options?: SelectCompanyPlanInput) {
  return {
    ...(options?.planNameSnapshot ? { planNameSnapshot: options.planNameSnapshot.trim() } : {}),
    ...(options?.planCodeSnapshot ? { planCodeSnapshot: options.planCodeSnapshot.trim() } : {}),
    ...(typeof options?.trialDays === "number" ? { trialDays: options.trialDays } : {}),
    ...(typeof options?.graceDays === "number" ? { graceDays: options.graceDays } : {}),
    ...(typeof options?.customPriceCents === "number"
      ? { customPriceCents: options.customPriceCents }
      : {}),
    ...(typeof options?.customVehicleLimit === "number"
      ? { customVehicleLimit: options.customVehicleLimit }
      : {}),
    ...(typeof options?.isCustomConfiguration === "boolean"
      ? { isCustomConfiguration: options.isCustomConfiguration }
      : {}),
    ...(typeof options?.priceCentsSnapshot === "number"
      ? { priceCentsSnapshot: options.priceCentsSnapshot }
      : {}),
    ...(typeof options?.vehicleLimitSnapshot === "number"
      ? { vehicleLimitSnapshot: options.vehicleLimitSnapshot }
      : {}),
    ...(options?.currencySnapshot
      ? { currencySnapshot: options.currencySnapshot.trim().toUpperCase() }
      : {}),
    ...(options?.intervalSnapshot ? { intervalSnapshot: options.intervalSnapshot } : {}),
  };
}

export async function getBillingAccessStatus(
  companyId?: string,
): Promise<SubscriptionAccessOverview | null> {
  return fetchAccessStatusWithFallback(companyId);
}

export async function getSubscriptionPageData(): Promise<SubscriptionPageData> {
  const context = getUserContext();
  const companyId = context.effectiveCompanyId;

  const plansPromise = context.isAdmin
    ? api.get<BillingPlanApi[]>("/billing/plans", {
        params: {
          scope: "ADMIN",
          includeInactive: true,
          ...(companyId ? { companyId } : {}),
        },
      })
    : api.get<BillingPlanApi[]>("/billing/plans");

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

  const accessPromise = getBillingAccessStatus(companyId || undefined);

  const [subscriptionResponse, plansResponse, paymentsResponse, accessOverview] = await Promise.all([
    subscriptionPromise,
    plansPromise,
    paymentsPromise,
    accessPromise,
  ]);

  const subscription = subscriptionResponse.data;
  const access = accessOverview;
  const plansData = Array.isArray(plansResponse.data) ? plansResponse.data : [];
  const paymentsData = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];

  const plans = plansData.map((plan) => toPlanView(plan, subscription?.plan?.id || undefined));

  const amountCents = Number(
    subscription?.customPriceCents ??
      subscription?.priceCentsSnapshot ??
      subscription?.plan?.priceCents ??
      0,
  );

  const currency =
    subscription?.currencySnapshot ||
    subscription?.plan?.currency ||
    "BRL";

  const billingCycle =
    subscription?.intervalSnapshot ||
    subscription?.plan?.interval ||
    "MONTHLY";

  const overview: SubscriptionOverview | null =
    subscription && subscription.plan
      ? {
          companyId,
          companyName: readSoftwareSettings().companyName || "Empresa",
          subscriptionId: subscription.id,
          planId: subscription.plan.id,
          planName: subscription.planNameSnapshot || subscription.plan.name,
          planCode: subscription.planCodeSnapshot || subscription.plan.code,
          status: subscription.status,
          billingCycle,
          amountCents,
          currency,
          startedAt: subscription.startedAt || subscription.currentPeriodStart || undefined,
          currentPeriodEnd: subscription.currentPeriodEnd || undefined,
          nextBillingDate: access?.nextBillingAt || subscription.nextBillingAt || undefined,
          trialDays:
            typeof subscription.trialDays === "number" ? subscription.trialDays : undefined,
          graceDays:
            typeof subscription.graceDays === "number" ? subscription.graceDays : undefined,
          trialEndsAt: access?.trialEndsAt || subscription.trialEndsAt || undefined,
          graceEndsAt: access?.graceEndsAt || subscription.graceEndsAt || undefined,
          accessBlockedAt:
            access?.accessBlockedAt || subscription.accessBlockedAt || undefined,
          isCustomConfiguration: Boolean(subscription.isCustomConfiguration),
          customPriceCents:
            typeof subscription.customPriceCents === "number"
              ? subscription.customPriceCents
              : undefined,
          customVehicleLimit:
            typeof subscription.customVehicleLimit === "number"
              ? subscription.customVehicleLimit
              : undefined,
        }
      : null;

  const invoices = paymentsData.map((payment) =>
    toInvoiceView(payment, subscription?.planNameSnapshot || subscription?.plan?.name || "Plano"),
  );

  const pendingPayment = paymentsData.find((payment) => payment.status === "PENDING");
  const canPayNow = Boolean(
    overview &&
      access &&
      (access.accessStatus === "GRACE_PERIOD" ||
        access.accessStatus === "BLOCKED" ||
        overview.status === "PAST_DUE" ||
        overview.status === "CANCELED"),
  );

  return {
    overview,
    access,
    plans,
    invoices,
    companyId,
    canPayNow,
    pendingCheckoutUrl: pendingPayment?.checkoutUrl || undefined,
  };
}

export async function selectCompanyPlan(
  companyId: string,
  planId: string,
  options?: Extract<SubscriptionStatus, "DRAFT" | "ACTIVE" | "TRIALING"> | SelectCompanyPlanInput,
) {
  const context = getUserContext();

  const payload =
    typeof options === "string"
      ? { initialStatus: options }
      : {
          ...(options?.initialStatus ? { initialStatus: options.initialStatus } : {}),
          ...normalizeSubscriptionCommandPayload(options),
        };

  if (context.isAdmin) {
    const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
    if (!targetCompanyId) {
      throw new Error("Selecione uma empresa no escopo para continuar.");
    }

    await api.post(`/billing/companies/${targetCompanyId}/subscription`, {
      planId,
      ...payload,
    });
    return;
  }

  await api.post("/billing/me/subscription", {
    planId,
    ...payload,
  });
}

export async function setCompanySubscriptionSetup(
  companyId: string,
  planId: string,
  options?: Omit<SelectCompanyPlanInput, "initialStatus" | "trialDays">,
) {
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }

  await api.post(`/billing/companies/${targetCompanyId}/subscription`, {
    planId,
    initialStatus: "DRAFT",
    ...normalizeSubscriptionCommandPayload(options),
  });
}

export async function setCompanySubscriptionTrial(
  companyId: string,
  planId: string,
  options?: Omit<SelectCompanyPlanInput, "initialStatus">,
) {
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }

  await api.post(`/billing/companies/${targetCompanyId}/subscription`, {
    planId,
    initialStatus: "TRIALING",
    ...normalizeSubscriptionCommandPayload(options),
    ...(typeof options?.trialDays === "number" ? { trialDays: options.trialDays } : {}),
  });
}

export async function setCompanySubscriptionActive(
  companyId: string,
  planId: string,
  options?: Omit<SelectCompanyPlanInput, "initialStatus" | "trialDays">,
) {
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }

  await api.post(`/billing/companies/${targetCompanyId}/subscription`, {
    planId,
    initialStatus: "ACTIVE",
    ...normalizeSubscriptionCommandPayload(options),
  });
}

export async function resetCompanySubscriptionOperationalState(companyId: string) {
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }

  const { data } = await api.post(
    `/billing/companies/${targetCompanyId}/subscription/reset-operational-state`,
  );
  return data;
}

export async function generateSubscriptionPayment(subscriptionId: string, planId?: string) {
  const context = getUserContext();
  const { data } = context.isAdmin
    ? await api.post<{ checkoutUrl?: string }>(`/billing/subscriptions/${subscriptionId}/pay`, {
        ...(planId ? { planId } : {}),
      })
    : await api.post<{ checkoutUrl?: string }>("/billing/me/pay", {
        ...(planId ? { planId } : {}),
      });

  if (!data?.checkoutUrl) {
    throw new Error("Não foi possível obter a URL de checkout do pagamento.");
  }

  return data.checkoutUrl;
}

export async function createBillingPlan(input: CreateBillingPlanInput) {
  const payload = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    priceCents: Number(input.priceCents),
    vehicleLimit:
      typeof input.vehicleLimit === "number" && Number.isFinite(input.vehicleLimit)
        ? Math.max(1, Math.floor(input.vehicleLimit))
        : undefined,
    currency: (input.currency || "BRL").trim().toUpperCase(),
    interval: input.interval,
    active: input.active ?? true,
    isPublic: input.isPublic ?? true,
    isEnterprise: input.isEnterprise ?? false,
    ...((input.isEnterprise ?? false) && input.companyId?.trim()
      ? { companyId: input.companyId.trim() }
      : {}),
  };

  await api.post("/billing/plans", payload);
}

export async function updateBillingPlan(planId: string, input: UpdateBillingPlanInput) {
  const payload = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    priceCents: Number(input.priceCents),
    vehicleLimit:
      typeof input.vehicleLimit === "number" && Number.isFinite(input.vehicleLimit)
        ? Math.max(1, Math.floor(input.vehicleLimit))
        : undefined,
    currency: (input.currency || "BRL").trim().toUpperCase(),
    interval: input.interval,
    active: input.active ?? true,
    isPublic: input.isPublic ?? true,
    isEnterprise: input.isEnterprise ?? false,
    ...((input.isEnterprise ?? false) && input.companyId?.trim()
      ? { companyId: input.companyId.trim() }
      : {}),
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

export async function clearCompanyPayments(companyId: string) {
  const context = getUserContext();
  if (!context.isAdmin) {
    throw new Error("Somente administrador pode limpar o histórico de pagamentos.");
  }
  const targetCompanyId = getSelectedCompanyScopeId() || companyId || readCompanyIdFromToken();
  if (!targetCompanyId) {
    throw new Error("Selecione uma empresa no escopo para continuar.");
  }
  await api.delete(`/billing/companies/${targetCompanyId}/payments`);
}

export async function checkSubscriptionPayment(input: {
  orderNsu: string;
  transactionNsu?: string;
  slug?: string;
}) {
  const payload = {
    order_nsu: input.orderNsu,
    ...(input.transactionNsu ? { transaction_nsu: input.transactionNsu } : {}),
    ...(input.slug ? { slug: input.slug } : {}),
  };
  const { data } = await api.post<CheckPaymentResult>("/billing/check-payment", payload);
  return data;
}
