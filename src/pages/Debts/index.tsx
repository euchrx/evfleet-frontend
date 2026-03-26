import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Debt } from "../../types/debt";
import type { Vehicle } from "../../types/vehicle";
import {
  createDebt,
  deleteDebt,
  getDebts,
  updateDebt,
} from "../../services/debts";
import { getVehicles } from "../../services/vehicles";
import { useBranch } from "../../contexts/BranchContext";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type DebtCategory = Debt["category"];
type DebtSortBy =
  | "category"
  | "description"
  | "vehicle"
  | "debtDate"
  | "dueDate"
  | "amount"
  | "status";

type DebtFormData = {
  description: string;
  category: DebtCategory | "";
  amount: string;
  points: string;
  debtDate: string;
  dueDate: string;
  creditor: string;
  isRecurring: boolean;
  status: string;
  vehicleId: string;
};
type DebtFieldErrors = Partial<Record<"description" | "category" | "amount" | "debtDate" | "dueDate" | "status" | "vehicleId", string>>;

const initialForm: DebtFormData = {
  description: "",
  category: "",
  amount: "",
  points: "",
  debtDate: "",
  dueDate: "",
  creditor: "",
  isRecurring: false,
  status: "",
  vehicleId: "",
};
const TABLE_PAGE_SIZE = 10;

const debtCategoryOptions: Array<{ value: DebtCategory; label: string }> = [
  { value: "FINE", label: "Multa" },
  { value: "IPVA", label: "IPVA" },
  { value: "LICENSING", label: "Licenciamento" },
  { value: "INSURANCE", label: "Seguro" },
  { value: "TOLL", label: "Pedagio" },
  { value: "TAX", label: "Imposto" },
  { value: "OTHER", label: "Outro" },
];

function categoryLabel(value?: DebtCategory | null) {
  return (
    debtCategoryOptions.find((item) => item.value === value)?.label || "Outro"
  );
}

function formatMoney(value: string) {
  const digits = value.replace(/\D/g, "");
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function toDateText(value?: string | null) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function getEffectiveDebtStatus(debt: Debt) {
  const dueDate = parseLocalDate(debt.dueDate || debt.debtDate);
  if (!dueDate) return debt.status;
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  return debt.status === "PENDING" && dueDate.getTime() < today.getTime()
    ? "OVERDUE"
    : debt.status;
}

function statusLabel(status: string) {
  if (status === "OVERDUE") return "Vencida";
  if (status === "PENDING") return "Pendente";
  if (status === "PAID") return "Paga";
  if (status === "APPEALED") return "Recorrida";
  return status;
}

function statusClass(status: string) {
  if (status === "OVERDUE") return "status-inactive";
  if (status === "PENDING") return "status-pending";
  if (status === "PAID") return "status-active";
  if (status === "APPEALED") return "status-anomaly";
  return "status-pending";
}

export function DebtsPage() {
  const location = useLocation();
  const { selectedBranchId } = useBranch();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<DebtFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | DebtCategory>(
    "ALL",
  );
  const [sortBy, setSortBy] = useState<DebtSortBy>("debtDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [deletingDebt, setDeletingDebt] = useState(false);
  const [form, setForm] = useState<DebtFormData>(initialForm);
  const [highlightedDebtId, setHighlightedDebtId] = useState<string | null>(
    null,
  );

  function notifyHeaderNotifications() {
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setPageErrorMessage("");
        const [debtsData, vehiclesData] = await Promise.all([
          getDebts(),
          getVehicles(),
        ]);
        setDebts(Array.isArray(debtsData) ? debtsData : []);
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      } catch (error) {
        console.error("Erro ao carregar débitos:", error);
        setPageErrorMessage("Não foi possível carregar os débitos.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const plateParam = query.get("plate");
    const highlightId = query.get("highlight");
    if (plateParam) setSearch(plateParam);
    if (!highlightId) return;
    setHighlightedDebtId(highlightId);
    const timer = window.setTimeout(() => {
      document.getElementById(`debt-row-${highlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    query.delete("highlight");
    const nextSearch = query.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!highlightedDebtId) return;
    const clear = () => setHighlightedDebtId(null);
    document.addEventListener("pointerdown", clear, { passive: true });
    document.addEventListener("keydown", clear);
    return () => {
      document.removeEventListener("pointerdown", clear);
      document.removeEventListener("keydown", clear);
    };
  }, [highlightedDebtId]);

  const availableVehicles = useMemo(() => {
    let filtered = vehicles;
    if (selectedBranchId)
      filtered = filtered.filter(
        (vehicle) => vehicle.branchId === selectedBranchId,
      );
    return filtered
      .filter(
        (vehicle) =>
          vehicle.status === "ACTIVE" || vehicle.id === form.vehicleId,
      )
      .sort((a, b) =>
        a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
      );
  }, [vehicles, selectedBranchId, form.vehicleId]);

  const filteredDebts = useMemo(() => {
    let filtered = debts;
    if (selectedBranchId)
      filtered = filtered.filter(
        (debt) => debt.vehicle?.branchId === selectedBranchId,
      );
    if (statusFilter !== "ALL")
      filtered = filtered.filter(
        (debt) => getEffectiveDebtStatus(debt) === statusFilter,
      );
    if (categoryFilter !== "ALL")
      filtered = filtered.filter((debt) => debt.category === categoryFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((debt) => {
        const text = [
          debt.description,
          categoryLabel(debt.category),
          statusLabel(getEffectiveDebtStatus(debt)),
          debt.vehicle?.plate || "",
          debt.vehicle ? formatVehicleLabel(debt.vehicle) : "",
          String(debt.amount),
          toDateText(debt.debtDate),
          toDateText(debt.dueDate || debt.debtDate),
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(term);
      });
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "category")
        return (
          categoryLabel(a.category).localeCompare(
            categoryLabel(b.category),
            "pt-BR",
          ) * direction
        );
      if (sortBy === "vehicle") {
        const av = a.vehicle ? formatVehicleLabel(a.vehicle) : "";
        const bv = b.vehicle ? formatVehicleLabel(b.vehicle) : "";
        return av.localeCompare(bv, "pt-BR") * direction;
      }
      if (sortBy === "debtDate")
        return (
          ((parseLocalDate(a.debtDate)?.getTime() || 0) -
            (parseLocalDate(b.debtDate)?.getTime() || 0)) *
          direction
        );
      if (sortBy === "dueDate")
        return (
          ((parseLocalDate(a.dueDate || a.debtDate)?.getTime() || 0) -
            (parseLocalDate(b.dueDate || b.debtDate)?.getTime() || 0)) *
          direction
        );
      if (sortBy === "amount") return (a.amount - b.amount) * direction;
      if (sortBy === "status")
        return (
          statusLabel(getEffectiveDebtStatus(a)).localeCompare(
            statusLabel(getEffectiveDebtStatus(b)),
            "pt-BR",
          ) * direction
        );
      return a.description.localeCompare(b.description, "pt-BR") * direction;
    });
  }, [
    debts,
    selectedBranchId,
    statusFilter,
    categoryFilter,
    search,
    sortBy,
    sortDirection,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDebts.length / TABLE_PAGE_SIZE)),
    [filteredDebts.length]
  );

  const paginatedDebts = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredDebts.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredDebts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, sortBy, sortDirection, selectedBranchId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const scoped = selectedBranchId
      ? debts.filter((debt) => debt.vehicle?.branchId === selectedBranchId)
      : debts;
    const totals = {
      total: scoped.length,
      overdue: 0,
      pending: 0,
      paid: 0,
      appealed: 0,
      totalAmount: 0,
    };
    scoped.forEach((debt) => {
      const status = getEffectiveDebtStatus(debt);
      totals.totalAmount += debt.amount || 0;
      if (status === "OVERDUE") totals.overdue += 1;
      else if (status === "PENDING") totals.pending += 1;
      else if (status === "PAID") totals.paid += 1;
      else if (status === "APPEALED") totals.appealed += 1;
    });
    return totals;
  }, [debts, selectedBranchId]);

  function handleSort(column: DebtSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: DebtSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function openCreateModal() {
    setEditingDebt(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(debt: Debt) {
    setEditingDebt(debt);
    setForm({
      description: debt.description,
      category: debt.category || "FINE",
      amount: String(debt.amount).replace(".", ","),
      points: String(debt.points || 0),
      debtDate: String(debt.debtDate).slice(0, 10),
      dueDate: debt.dueDate ? String(debt.dueDate).slice(0, 10) : "",
      creditor: debt.creditor || "",
      isRecurring: Boolean(debt.isRecurring),
      status: debt.status,
      vehicleId: debt.vehicleId,
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingDebt(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof DebtFormData>(
    field: K,
    value: DebtFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in { description:1, category:1, amount:1, debtDate:1, dueDate:1, status:1, vehicleId:1 }) {
      setFieldErrors((prev) => ({ ...prev, [field as keyof DebtFieldErrors]: undefined }));
    }
  }

  function inputClass(field?: keyof DebtFieldErrors) {
    if (field && fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setFieldErrors({});
      const payload = {
        description: form.description.trim(),
        category: form.category as DebtCategory,
        amount: Number(form.amount.replace(/\./g, "").replace(",", ".")),
        points: form.category === "FINE" ? Number(form.points || 0) : 0,
        debtDate: form.debtDate,
        dueDate: form.dueDate || undefined,
        creditor: form.creditor.trim() || undefined,
        isRecurring: form.isRecurring,
        status: form.status,
        vehicleId: form.vehicleId,
      };
      const nextErrors: DebtFieldErrors = {};
      if (!form.category) nextErrors.category = "Selecione uma categoria.";
      if (!form.status) nextErrors.status = "Selecione um status.";
      if (!payload.description) nextErrors.description = "Informe a descrição.";
      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione um veículo.";
      if (!payload.debtDate)
        nextErrors.debtDate = "Informe a data de lancamento.";
      if (!payload.dueDate)
        nextErrors.dueDate = "Informe a data de vencimento.";
      if (Number.isNaN(payload.amount) || payload.amount <= 0)
        nextErrors.amount = "Informe um valor válido.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      if (editingDebt) await updateDebt(editingDebt.id, payload);
      else await createDebt(payload);

      closeModal();
      notifyHeaderNotifications();
      const [debtsData] = await Promise.all([getDebts()]);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
    } catch (error: any) {
      console.error("Erro ao salvar débito:", error);
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";
      setFieldErrors((prev) => ({
        ...prev,
        description: Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : String(apiMessage || "Não foi possível salvar o débito."),
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(debt: Debt) {
    setDebtToDelete(debt);
  }

  async function confirmDeleteDebt() {
    if (!debtToDelete) return;
    try {
      setDeletingDebt(true);
      await deleteDebt(debtToDelete.id);
      setDebtToDelete(null);
      notifyHeaderNotifications();
      setDebts((prev) => prev.filter((item) => item.id !== debtToDelete.id));
    } catch (error) {
      console.error("Erro ao excluir débito:", error);
      setPageErrorMessage("Não foi possível excluir o débito.");
    } finally {
      setDeletingDebt(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Débitos e Multas
          </h1>
          <p className="text-sm text-slate-500">
            Gestão completa de IPVA, multas e demais custos do veículo.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
        >
          + Cadastrar débito
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totais
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {summary.total}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Vencidas
          </p>
          <p className="mt-1 text-2xl font-bold text-red-800">
            {summary.overdue}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Pendentes
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800">
            {summary.pending}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Pagas
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {summary.paid}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Recorridas
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {summary.appealed}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Valor total
          </p>
          <p className="mt-1 text-lg font-bold text-violet-900">
            {summary.totalAmount.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Buscar por descrição, categoria, status ou placa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as "ALL" | DebtCategory)
            }
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todas as categorias</option>
            {debtCategoryOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="OVERDUE">Vencida</option>
            <option value="PAID">Paga</option>
            <option value="APPEALED">Recorrida</option>
          </select>
        </div>
      </div>

      {pageErrorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageErrorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("category")}
                    className="cursor-pointer"
                  >
                    Categoria {getSortArrow("category")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("description")}
                    className="cursor-pointer"
                  >
                    Descrição {getSortArrow("description")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("vehicle")}
                    className="cursor-pointer"
                  >
                    Veículo {getSortArrow("vehicle")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("debtDate")}
                    className="cursor-pointer"
                  >
                    Lancamento {getSortArrow("debtDate")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("dueDate")}
                    className="cursor-pointer"
                  >
                    Vencimento {getSortArrow("dueDate")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("amount")}
                    className="cursor-pointer"
                  >
                    Valor {getSortArrow("amount")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("status")}
                    className="cursor-pointer"
                  >
                    Status {getSortArrow("status")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando débitos...
                  </td>
                </tr>
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhum débito encontrado.
                  </td>
                </tr>
              ) : (
                paginatedDebts.map((debt) => {
                  const effectiveStatus = getEffectiveDebtStatus(debt);
                  return (
                    <tr
                      id={`debt-row-${debt.id}`}
                      key={debt.id}
                      className={`border-t border-slate-200 transition-colors ${highlightedDebtId === debt.id ? "notification-highlight" : ""}`}
                    >
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {categoryLabel(debt.category)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {debt.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {debt.vehicle
                          ? formatVehicleLabel(debt.vehicle)
                          : debt.vehicleId}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {toDateText(debt.debtDate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {toDateText(debt.dueDate || debt.debtDate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {debt.amount.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`status-pill ${statusClass(effectiveStatus)}`}
                        >
                          {statusLabel(effectiveStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(debt)}
                            className="btn-ui btn-ui-neutral"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(debt)}
                            className="btn-ui btn-ui-danger"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredDebts.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDebts.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="débitos"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>


      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingDebt ? "Editar débito" : "Cadastrar débito"}
                </h2>
                <p className="text-sm text-slate-500">
                  Registre IPVA, multa e demais custos por veículo.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      handleChange("category", e.target.value as DebtCategory)
                    }
                    className={inputClass("category")}
                  >
                    <option value="">Selecione uma categoria</option>
                    {debtCategoryOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category ? <p className="mt-1 text-xs text-red-600">{fieldErrors.category}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className={inputClass("status")}
                  >
                    <option value="">Selecione um status</option>
                    <option value="PENDING">Pendente</option>
                    <option value="PAID">Paga</option>
                    <option value="APPEALED">Recorrida</option>
                  </select>
                  {fieldErrors.status ? <p className="mt-1 text-xs text-red-600">{fieldErrors.status}</p> : null}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      handleChange("description", e.target.value)
                    }
                    className={inputClass("description")}
                    placeholder="Ex: IPVA 2026 cota unica"
                  />
                  {fieldErrors.description ? <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Valor
                  </label>
                  <input
                    type="text"
                    value={form.amount}
                    onChange={(e) =>
                      handleChange("amount", formatMoney(e.target.value))
                    }
                    className={inputClass("amount")}
                    placeholder="0,00"
                  />
                  {fieldErrors.amount ? <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Pontos CNH
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.points}
                    onChange={(e) => handleChange("points", e.target.value)}
                    disabled={form.category !== "FINE"}
                    className={inputClass()}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Data de lancamento
                  </label>
                  <input
                    type="date"
                    value={form.debtDate}
                    onChange={(e) => handleChange("debtDate", e.target.value)}
                    className={inputClass("debtDate")}
                  />
                  {fieldErrors.debtDate ? <p className="mt-1 text-xs text-red-600">{fieldErrors.debtDate}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Data de vencimento
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => handleChange("dueDate", e.target.value)}
                    className={inputClass("dueDate")}
                  />
                  {fieldErrors.dueDate ? <p className="mt-1 text-xs text-red-600">{fieldErrors.dueDate}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Credor/órgão
                  </label>
                  <input
                    type="text"
                    value={form.creditor}
                    onChange={(e) => handleChange("creditor", e.target.value)}
                    className={inputClass()}
                    placeholder="Detran, SEFAZ..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Veículo
                  </label>
                  <select
                    value={form.vehicleId}
                    onChange={(e) => handleChange("vehicleId", e.target.value)}
                    className={inputClass("vehicleId")}
                  >
                    <option value="">Selecione um veículo</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {formatVehicleLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.vehicleId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleId}</p> : null}
                </div>
                <label className="md:col-span-2 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) =>
                      handleChange("isRecurring", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                  />
                  Débito recorrente
                </label>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving
                    ? "Salvando..."
                    : editingDebt
                      ? "Salvar alterações"
                      : "Cadastrar débito"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ConfirmDeleteModal
        isOpen={Boolean(debtToDelete)}
        title="Excluir débito"
        description={
          debtToDelete
            ? `Deseja excluir o débito "${debtToDelete.description}"?`
            : ""
        }
        loading={deletingDebt}
        onCancel={() => setDebtToDelete(null)}
        onConfirm={confirmDeleteDebt}
      />
    </div>
  );
}
