import axios from "axios";
import { api } from "./api";

export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";

export type SubscriptionOverview = {
  companyName: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: "MONTHLY" | "YEARLY";
  amount: number;
  currency: string;
  startedAt?: string;
  nextBillingDate?: string;
  paymentMethodLabel?: string;
  gatewayName?: string;
  customerReference?: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: "MONTHLY" | "YEARLY";
  description: string;
  features: string[];
  recommended?: boolean;
};

export type SubscriptionInvoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "PAID" | "PENDING" | "FAILED";
  reference?: string;
};

export type SubscriptionPageData = {
  overview: SubscriptionOverview;
  plans: SubscriptionPlan[];
  invoices: SubscriptionInvoice[];
};

const fallbackData: SubscriptionPageData = {
  overview: {
    companyName: "EvFleet",
    planId: "pro",
    planName: "Plano Pro",
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    amount: 599,
    currency: "BRL",
    startedAt: "2026-01-10",
    nextBillingDate: "2026-04-10",
    paymentMethodLabel: "Cartão final 4821",
    gatewayName: "Gateway não configurado",
    customerReference: "N/A",
  },
  plans: [
    {
      id: "starter",
      name: "Starter",
      price: 299,
      currency: "BRL",
      billingCycle: "MONTHLY",
      description: "Ideal para operação inicial da frota.",
      features: ["Até 50 veículos", "Relatórios padrão", "Suporte em horário comercial"],
    },
    {
      id: "pro",
      name: "Pro",
      price: 599,
      currency: "BRL",
      billingCycle: "MONTHLY",
      description: "Plano corporativo completo para gestão da frota.",
      features: ["Até 250 veículos", "Relatórios avançados", "Alertas e automações", "Suporte prioritário"],
      recommended: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 1299,
      currency: "BRL",
      billingCycle: "MONTHLY",
      description: "Escala para grandes operações e múltiplas unidades.",
      features: ["Veículos ilimitados", "Integrações dedicadas", "SLA e onboarding avançado"],
    },
  ],
  invoices: [
    {
      id: "inv_2026_03",
      date: "2026-03-10",
      description: "Cobrança mensal - Plano Pro",
      amount: 599,
      status: "PAID",
      reference: "FAT-2026-03",
    },
    {
      id: "inv_2026_02",
      date: "2026-02-10",
      description: "Cobrança mensal - Plano Pro",
      amount: 599,
      status: "PAID",
      reference: "FAT-2026-02",
    },
  ],
};

export async function getSubscriptionPageData() {
  try {
    const { data } = await api.get<SubscriptionPageData>("/subscription/overview");
    if (!data?.overview || !Array.isArray(data?.plans) || !Array.isArray(data?.invoices)) {
      return fallbackData;
    }
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return fallbackData;
    }
    return fallbackData;
  }
}

export async function startSubscriptionCheckout(planId: string) {
  const { data } = await api.post<{ checkoutUrl: string }>("/subscription/checkout", { planId });
  if (!data?.checkoutUrl) {
    throw new Error("Gateway de cobrança não retornou URL de checkout.");
  }
  return data.checkoutUrl;
}
