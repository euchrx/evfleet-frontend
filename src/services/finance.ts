import { api } from "./api";
import { getCompanies } from "./companies";
import type { Company } from "../types/company";
import type { PaymentStatus, SubscriptionStatus } from "./subscription";

type CompanySubscriptionApi = {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  plan?: {
    id: string;
    code: string;
    name: string;
    priceCents: number;
    currency: string;
    interval: "MONTHLY" | "YEARLY";
  } | null;
} | null;

type CompanyPaymentApi = {
  id: string;
  amountCents?: number;
  amount?: number;
  status: PaymentStatus;
  dueAt?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  checkoutUrl?: string | null;
  invoiceUrl?: string | null;
  gatewayReference?: string | null;
}[];

export type FinanceCompanyItem = {
  companyId: string;
  companyName: string;
  companyDocument?: string;
  companyActive: boolean;
  subscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  planName?: string;
  billingCycle?: "MONTHLY" | "YEARLY";
  amountCents: number;
  currency: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  nextBillingAt?: string;
  subscriptionCreatedAt?: string;
  subscriptionUpdatedAt?: string;
  paymentsCount: number;
  pendingPaymentsCount: number;
  paidPaymentsCount: number;
  expiredPaymentsCount: number;
  lastPaymentDate?: string;
  lastPaymentStatus?: PaymentStatus;
  lastPaymentAmountCents?: number;
};

async function fetchCompanySubscription(companyId: string) {
  try {
    const { data } = await api.get<CompanySubscriptionApi>(
      `/billing/companies/${companyId}/subscription`,
      { headers: { "x-company-scope": "__ALL__" } },
    );
    return data;
  } catch {
    return null;
  }
}

async function fetchCompanyPayments(companyId: string) {
  try {
    const { data } = await api.get<CompanyPaymentApi>(
      `/billing/companies/${companyId}/payments`,
      { headers: { "x-company-scope": "__ALL__" } },
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function toAmountCents(value: { amountCents?: number; amount?: number }) {
  if (typeof value.amountCents === "number") return value.amountCents;
  if (typeof value.amount === "number") return value.amount;
  return 0;
}

function toFinanceItem(company: Company, subscription: CompanySubscriptionApi, payments: CompanyPaymentApi): FinanceCompanyItem {
  const sortedPayments = [...payments].sort((a, b) => {
    const aTime = new Date(a.paidAt || a.createdAt || a.dueAt || 0).getTime();
    const bTime = new Date(b.paidAt || b.createdAt || b.dueAt || 0).getTime();
    return bTime - aTime;
  });
  const lastPayment = sortedPayments[0];

  return {
    companyId: company.id,
    companyName: company.name,
    companyDocument: company.document || undefined,
    companyActive: Boolean(company.active),
    subscriptionId: subscription?.id || undefined,
    subscriptionStatus: subscription?.status || undefined,
    planName: subscription?.plan?.name || undefined,
    billingCycle: subscription?.plan?.interval,
    amountCents: Number(subscription?.plan?.priceCents || 0),
    currency: subscription?.plan?.currency || "BRL",
    currentPeriodStart: subscription?.currentPeriodStart || undefined,
    currentPeriodEnd: subscription?.currentPeriodEnd || undefined,
    nextBillingAt: subscription?.nextBillingAt || undefined,
    subscriptionCreatedAt: subscription?.createdAt || undefined,
    subscriptionUpdatedAt: subscription?.updatedAt || undefined,
    paymentsCount: payments.length,
    pendingPaymentsCount: payments.filter((item) => item.status === "PENDING").length,
    paidPaymentsCount: payments.filter((item) => item.status === "PAID").length,
    expiredPaymentsCount: payments.filter((item) => item.status === "EXPIRED").length,
    lastPaymentDate: lastPayment?.paidAt || lastPayment?.createdAt || lastPayment?.dueAt || undefined,
    lastPaymentStatus: lastPayment?.status,
    lastPaymentAmountCents: lastPayment ? toAmountCents(lastPayment) : undefined,
  };
}

export async function getFinanceOverview() {
  const companies = await getCompanies();
  const tasks = companies.map(async (company: Company) => {
    const [subscription, payments] = await Promise.all([
      fetchCompanySubscription(company.id),
      fetchCompanyPayments(company.id),
    ]);
    return toFinanceItem(company, subscription, payments);
  });

  const result = await Promise.all(tasks);
  return result.sort((a, b) => a.companyName.localeCompare(b.companyName, "pt-BR"));
}
