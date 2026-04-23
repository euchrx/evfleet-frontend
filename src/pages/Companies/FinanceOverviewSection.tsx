import { useEffect, useMemo, useState } from "react";
import { BanknoteArrowDown, Building2, RefreshCw } from "lucide-react";
import { TablePagination } from "../../components/TablePagination";
import { getFinanceOverview, type FinanceCompanyItem } from "../../services/finance";
import { formatCurrency, formatDate } from "../../utils/formatters";

type AccessStatusFilter =
  | "ALL"
  | "NO_PLAN"
  | "SETUP_REQUIRED"
  | "TRIALING"
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "BLOCKED";

type FinanceSortBy =
  | "companyName"
  | "accessStatus"
  | "subscriptionStatus"
  | "planName"
  | "amountCents"
  | "currentPeriodStart"
  | "currentPeriodEnd"
  | "nextBillingAt"
  | "paymentsCount"
  | "lastPaymentDate";

type FinanceOverviewSectionProps = {
  focusedCompanyId?: string | null;
};

const PAGE_SIZE = 10;

function subscriptionStatusLabel(status?: string) {
  if (status === "DRAFT") return "Em configuração";
  if (status === "ACTIVE") return "Ativa";
  if (status === "TRIALING") return "Período de teste";
  if (status === "PAST_DUE") return "Inadimplente";
  if (status === "CANCELED") return "Cancelada";
  return "Sem assinatura";
}

function accessStatusLabel(status?: string) {
  if (status === "NO_PLAN") return "Sem plano";
  if (status === "SETUP_REQUIRED") return "Configuração pendente";
  if (status === "TRIALING") return "Período de teste";
  if (status === "ACTIVE") return "Assinatura ativa";
  if (status === "GRACE_PERIOD") return "Em tolerância";
  if (status === "BLOCKED") return "Bloqueado";
  return "Sem status";
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

function accessStatusClass(status?: string) {
  if (status === "ACTIVE") return "status-active";
  if (status === "TRIALING") return "status-pending";
  if (status === "GRACE_PERIOD") return "status-anomaly";
  if (status === "BLOCKED") return "status-inactive";
  if (status === "SETUP_REQUIRED") return "status-pending";
  if (status === "NO_PLAN") return "status-inactive";
  return "status-inactive";
}

function cycleLabel(cycle?: string) {
  if (cycle === "MONTHLY") return "Mensal";
  if (cycle === "YEARLY") return "Anual";
  return "-";
}

function toSortableTime(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function FinanceOverviewSection({
  focusedCompanyId = null,
}: FinanceOverviewSectionProps) {
  const [items, setItems] = useState<FinanceCompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccessStatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<FinanceSortBy>("companyName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedCompanyId, setHighlightedCompanyId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!focusedCompanyId || items.length === 0) return;

    const target = items.find((item) => item.companyId === focusedCompanyId);
    if (!target) return;

    setSearch(target.companyName);
    setStatusFilter("ALL");
    setCurrentPage(1);
    setHighlightedCompanyId(target.companyId);

    const timer = window.setTimeout(() => {
      setHighlightedCompanyId((current) =>
        current === target.companyId ? null : current,
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [focusedCompanyId, items]);

  const filteredItems = useMemo(() => {
    let base = [...items];

    if (statusFilter !== "ALL") {
      base = base.filter((item) => item.accessStatus === statusFilter);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      base = base.filter((item) =>
        [
          item.companyName,
          item.companyDocument || "",
          item.planName || "",
          accessStatusLabel(item.accessStatus),
          subscriptionStatusLabel(item.subscriptionStatus),
          cycleLabel(item.billingCycle),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;

    return base.sort((a, b) => {
      if (sortBy === "accessStatus") {
        return (
          accessStatusLabel(a.accessStatus).localeCompare(
            accessStatusLabel(b.accessStatus),
            "pt-BR",
          ) * direction
        );
      }

      if (sortBy === "subscriptionStatus") {
        return (
          subscriptionStatusLabel(a.subscriptionStatus).localeCompare(
            subscriptionStatusLabel(b.subscriptionStatus),
            "pt-BR",
          ) * direction
        );
      }

      if (sortBy === "planName") {
        return (
          String(a.planName || "").localeCompare(String(b.planName || ""), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }

      if (sortBy === "amountCents") {
        return (Number(a.amountCents || 0) - Number(b.amountCents || 0)) * direction;
      }

      if (sortBy === "currentPeriodStart") {
        return (
          toSortableTime(a.currentPeriodStart) - toSortableTime(b.currentPeriodStart)
        ) * direction;
      }

      if (sortBy === "currentPeriodEnd") {
        return (
          toSortableTime(a.currentPeriodEnd) - toSortableTime(b.currentPeriodEnd)
        ) * direction;
      }

      if (sortBy === "nextBillingAt") {
        return (toSortableTime(a.nextBillingAt) - toSortableTime(b.nextBillingAt)) * direction;
      }

      if (sortBy === "paymentsCount") {
        return (Number(a.paymentsCount || 0) - Number(b.paymentsCount || 0)) * direction;
      }

      if (sortBy === "lastPaymentDate") {
        return (toSortableTime(a.lastPaymentDate) - toSortableTime(b.lastPaymentDate)) * direction;
      }

      return (
        a.companyName.localeCompare(b.companyName, "pt-BR", {
          sensitivity: "base",
        }) * direction
      );
    });
  }, [items, search, sortBy, sortDirection, statusFilter]);

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
  }, [search, sortBy, sortDirection, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function handleSort(column: FinanceSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: FinanceSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  const summary = useMemo(
    () => ({
      companies: items.length,
      active: items.filter((item) => item.accessStatus === "ACTIVE").length,
      trialing: items.filter((item) => item.accessStatus === "TRIALING").length,
      grace: items.filter((item) => item.accessStatus === "GRACE_PERIOD").length,
      blocked: items.filter((item) => item.accessStatus === "BLOCKED").length,
      monthlyRevenueCents: items.reduce((sum, item) => {
        if (item.accessStatus !== "ACTIVE" && item.accessStatus !== "TRIALING") {
          return sum;
        }
        return sum + item.amountCents;
      }, 0),
    }),
    [items],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500">
            Visão administrativa das empresas, assinaturas, status operacional e cobrança.
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresas</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{summary.companies}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Operação ativa</p>
          <p className="mt-1 text-3xl font-bold text-emerald-900">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Em teste</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">{summary.trialing}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Em tolerância</p>
          <p className="mt-1 text-3xl font-bold text-orange-900">{summary.grace}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Bloqueadas</p>
          <p className="mt-1 text-3xl font-bold text-rose-900">{summary.blocked}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Receita mensal prevista</p>
          <p className="mt-1 text-3xl font-bold text-blue-900">
            {formatCurrency(summary.monthlyRevenueCents)}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por empresa, plano, status operacional ou assinatura..."
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AccessStatusFilter)}
            className="rounded-xl border border-slate-300 px-3 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos os status</option>
            <option value="NO_PLAN">Sem plano</option>
            <option value="SETUP_REQUIRED">Configuração pendente</option>
            <option value="TRIALING">Período de teste</option>
            <option value="ACTIVE">Assinatura ativa</option>
            <option value="GRACE_PERIOD">Em tolerância</option>
            <option value="BLOCKED">Bloqueado</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1450px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("companyName")} className="cursor-pointer">
                    Empresa {getSortArrow("companyName")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("accessStatus")} className="cursor-pointer">
                    Operação {getSortArrow("accessStatus")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("subscriptionStatus")} className="cursor-pointer">
                    Assinatura {getSortArrow("subscriptionStatus")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("planName")} className="cursor-pointer">
                    Plano {getSortArrow("planName")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("amountCents")} className="cursor-pointer">
                    Valor {getSortArrow("amountCents")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("currentPeriodStart")} className="cursor-pointer">
                    Início {getSortArrow("currentPeriodStart")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("currentPeriodEnd")} className="cursor-pointer">
                    Fim do período {getSortArrow("currentPeriodEnd")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("nextBillingAt")} className="cursor-pointer">
                    Próxima cobrança {getSortArrow("nextBillingAt")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Trial / tolerância</th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("paymentsCount")} className="cursor-pointer">
                    Pagamentos {getSortArrow("paymentsCount")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button type="button" onClick={() => handleSort("lastPaymentDate")} className="cursor-pointer">
                    Último pagamento {getSortArrow("lastPaymentDate")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    Carregando dados financeiros...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    Nenhum registro financeiro encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr
                    key={item.companyId}
                    className={`border-t border-slate-100 align-top transition-colors ${
                      highlightedCompanyId === item.companyId
                        ? "bg-amber-50/80 ring-1 ring-inset ring-amber-300"
                        : ""
                    }`}
                  >
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
                      <span className={accessStatusClass(item.accessStatus)}>
                        {accessStatusLabel(item.accessStatus)}
                      </span>
                      {item.accessMessage ? (
                        <p className="mt-2 max-w-[220px] text-xs text-slate-500">{item.accessMessage}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={accessStatusClass(item.subscriptionStatus)}>
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
                    <td className="px-4 py-3 text-slate-700">
                      <div className="space-y-1 text-xs">
                        <p>Trial: {formatDate(item.trialEndsAt)}</p>
                        <p>Tolerância: {formatDate(item.graceEndsAt)}</p>
                        <p>Bloqueio: {formatDate(item.accessBlockedAt)}</p>
                      </div>
                    </td>
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
    </section>
  );
}
