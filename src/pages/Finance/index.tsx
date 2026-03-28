import { useEffect, useMemo, useState } from "react";
import { BanknoteArrowDown, Building2, RefreshCw } from "lucide-react";
import { TablePagination } from "../../components/TablePagination";
import { getFinanceOverview, type FinanceCompanyItem } from "../../services/finance";
import { formatCurrency, formatDate } from "../../utils/formatters";

type SubscriptionStatusFilter = "ALL" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "NONE";

const PAGE_SIZE = 10;

function subscriptionStatusLabel(status?: string) {
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIALING") return "Período de teste";
  if (status === "PAST_DUE") return "Inadimplente";
  if (status === "CANCELED") return "Cancelada";
  return "Sem assinatura";
}

function paymentStatusLabel(status?: string) {
  if (status === "PAID") return "Pago";
  if (status === "PENDING") return "Pendente";
  if (status === "EXPIRED") return "Expirado";
  if (status === "FAILED") return "Falhou";
  if (status === "CANCELED") return "Cancelado";
  if (status === "REFUNDED") return "Estornado";
  return "-";
}

function subscriptionStatusClass(status?: string) {
  if (status === "ACTIVE") return "status-active";
  if (status === "TRIALING") return "status-pending";
  if (status === "PAST_DUE") return "status-anomaly";
  if (status === "CANCELED") return "status-inactive";
  return "status-inactive";
}

function cycleLabel(cycle?: string) {
  if (cycle === "MONTHLY") return "Mensal";
  if (cycle === "YEARLY") return "Anual";
  return "-";
}

export function FinancePage() {
  const [items, setItems] = useState<FinanceCompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  async function loadFinanceOverview(isManualRefresh = false) {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      setErrorMessage("");
      const data = await getFinanceOverview();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar finanças:", error);
      setErrorMessage("Não foi possível carregar as informações financeiras das empresas.");
      setItems([]);
    } finally {
      if (isManualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadFinanceOverview();
  }, []);

  const filteredItems = useMemo(() => {
    let base = [...items];

    if (statusFilter !== "ALL") {
      base = base.filter((item) => {
        const status = item.subscriptionStatus || "NONE";
        return status === statusFilter;
      });
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      base = base.filter((item) =>
        [
          item.companyName,
          item.companyDocument || "",
          item.planName || "",
          subscriptionStatusLabel(item.subscriptionStatus),
          cycleLabel(item.billingCycle),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    return base.sort((a, b) => a.companyName.localeCompare(b.companyName, "pt-BR"));
  }, [items, search, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE)),
    [filteredItems.length],
  );

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const summary = useMemo(
    () => ({
      companies: items.length,
      active: items.filter((item) => item.subscriptionStatus === "ACTIVE").length,
      trialing: items.filter((item) => item.subscriptionStatus === "TRIALING").length,
      pastDue: items.filter((item) => item.subscriptionStatus === "PAST_DUE").length,
      monthlyRevenueCents: items.reduce((sum, item) => {
        if (item.subscriptionStatus !== "ACTIVE" && item.subscriptionStatus !== "TRIALING") return sum;
        return sum + item.amountCents;
      }, 0),
    }),
    [items],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Finanças</h1>
          <p className="text-sm text-slate-500">
            Visão administrativa das empresas, assinaturas, status de cobrança e datas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadFinanceOverview(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Atualizar dados
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresas</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{summary.companies}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Assinaturas ativas</p>
          <p className="mt-1 text-3xl font-bold text-emerald-900">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Em teste</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">{summary.trialing}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Inadimplentes</p>
          <p className="mt-1 text-3xl font-bold text-rose-900">{summary.pastDue}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Receita mensal prevista</p>
          <p className="mt-1 text-3xl font-bold text-blue-900">{formatCurrency(summary.monthlyRevenueCents)}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por empresa, documento, plano ou status..."
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SubscriptionStatusFilter)}
            className="rounded-xl border border-slate-300 px-3 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativa</option>
            <option value="TRIALING">Período de teste</option>
            <option value="PAST_DUE">Inadimplente</option>
            <option value="CANCELED">Cancelada</option>
            <option value="NONE">Sem assinatura</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                <th className="px-4 py-3 text-left font-semibold">Assinatura</th>
                <th className="px-4 py-3 text-left font-semibold">Plano</th>
                <th className="px-4 py-3 text-left font-semibold">Valor</th>
                <th className="px-4 py-3 text-left font-semibold">Início</th>
                <th className="px-4 py-3 text-left font-semibold">Fim do período</th>
                <th className="px-4 py-3 text-left font-semibold">Próxima cobrança</th>
                <th className="px-4 py-3 text-left font-semibold">Pagamentos</th>
                <th className="px-4 py-3 text-left font-semibold">Último pagamento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Carregando dados financeiros...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Nenhum registro financeiro encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.companyId} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Building2 size={16} className="mt-0.5 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-900">{item.companyName}</p>
                          <p className="text-xs text-slate-500">
                            {item.companyDocument || "Documento não informado"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={subscriptionStatusClass(item.subscriptionStatus)}>
                        {subscriptionStatusLabel(item.subscriptionStatus)}
                      </span>
                      {item.subscriptionId ? (
                        <p className="mt-2 text-xs text-slate-500">ID: {item.subscriptionId}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.planName || "-"}</p>
                      <p className="text-xs text-slate-500">{cycleLabel(item.billingCycle)}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {item.amountCents > 0 ? formatCurrency(item.amountCents) : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(item.currentPeriodStart)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(item.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(item.nextBillingAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.paymentsCount}</p>
                      <p className="text-xs text-slate-500">
                        Pagos: {item.paidPaymentsCount} • Pendentes: {item.pendingPaymentsCount} • Expirados:{" "}
                        {item.expiredPaymentsCount}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <BanknoteArrowDown size={16} className="mt-0.5 text-slate-400" />
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.lastPaymentAmountCents
                              ? formatCurrency(item.lastPaymentAmountCents)
                              : "-"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {paymentStatusLabel(item.lastPaymentStatus)} • {formatDate(item.lastPaymentDate)}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          pageSize={PAGE_SIZE}
          itemLabel="empresa(s)"
          onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        />
      </div>
    </div>
  );
}
