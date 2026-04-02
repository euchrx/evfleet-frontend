import { useEffect, useMemo, useState } from "react";
import { Headset, RefreshCw } from "lucide-react";
import { StatusToast } from "../../components/StatusToast";
import { TablePagination } from "../../components/TablePagination";
import { useAuth } from "../../contexts/AuthContext";
import {
  completeSupportRequest,
  createSupportRequest,
  getSupportRequests,
  respondSupportRequest,
  type CreateSupportRequestInput,
  type SupportRequest,
  type SupportRequestCategory,
  type SupportRequestStatus,
} from "../../services/support";

const PAGE_SIZE = 10;

const categoryOptions: Array<{ value: SupportRequestCategory; label: string }> = [
  { value: "BUG", label: "Bug" },
  { value: "IMPROVEMENT", label: "Melhoria" },
  { value: "REQUEST", label: "Pedido" },
];

function categoryLabel(category: SupportRequestCategory) {
  return categoryOptions.find((item) => item.value === category)?.label || "Pedido";
}

function statusLabel(status: SupportRequestStatus) {
  if (status === "OPEN") return "Aberto";
  if (status === "IN_PROGRESS") return "Em atendimento";
  return "Concluído";
}

function statusClass(status: SupportRequestStatus) {
  if (status === "OPEN") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function getApiErrorMessage(error: any, fallback: string) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback;

  return Array.isArray(message) ? message.join(", ") : String(message);
}

export function SupportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [supportLocked, setSupportLocked] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SupportRequestStatus>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [requestToRespond, setRequestToRespond] = useState<SupportRequest | null>(null);
  const [requestToComplete, setRequestToComplete] = useState<SupportRequest | null>(null);
  const [toast, setToast] = useState({
    visible: false,
    tone: "success" as "loading" | "success" | "error",
    title: "",
    message: "",
  });
  const [createForm, setCreateForm] = useState<CreateSupportRequestInput>({
    title: "",
    description: "",
    category: "REQUEST",
  });
  const [responseForm, setResponseForm] = useState({
    responseMessage: "",
    estimatedCompletionAt: "",
  });
  const [completionMessage, setCompletionMessage] = useState("");

  async function loadRequests(manualRefresh = false) {
    try {
      if (manualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");
      const data = await getSupportRequests();
      setRequests(data);
      setSupportLocked(false);
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (!isAdmin && status === 403) {
        setSupportLocked(true);
        setRequests([]);
        setErrorMessage(
          "O suporte direto pelo sistema está disponível apenas para empresas no plano Starter.",
        );
      } else {
        setErrorMessage(
          getApiErrorMessage(error, "Não foi possível carregar os pedidos de suporte."),
        );
      }
    } finally {
      if (manualRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!term) return true;

      const haystack = [
        item.title,
        item.description,
        item.company.name,
        item.createdByUser?.name || "",
        item.responseMessage || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [requests, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredRequests]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      open: requests.filter((item) => item.status === "OPEN").length,
      inProgress: requests.filter((item) => item.status === "IN_PROGRESS").length,
      completed: requests.filter((item) => item.status === "COMPLETED").length,
    }),
    [requests],
  );

  function showToast(
    tone: "loading" | "success" | "error",
    title: string,
    message: string,
    autoHideMs?: number,
  ) {
    setToast({ visible: true, tone, title, message });
    if (autoHideMs) {
      window.setTimeout(
        () => setToast((prev) => ({ ...prev, visible: false })),
        autoHideMs,
      );
    }
  }

  async function handleCreateRequest() {
    try {
      setSaving(true);
      showToast("loading", "Enviando pedido", "Seu pedido de suporte está sendo registrado.");
      await createSupportRequest(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ title: "", description: "", category: "REQUEST" });
      await loadRequests(true);
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
      showToast("success", "Pedido enviado", "O pedido de suporte foi enviado com sucesso.", 4000);
    } catch (error: any) {
      showToast(
        "error",
        "Falha ao enviar",
        getApiErrorMessage(error, "Não foi possível enviar o pedido de suporte."),
        5000,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRespondRequest() {
    if (!requestToRespond) return;

    try {
      setSaving(true);
      showToast("loading", "Respondendo pedido", "A resposta está sendo registrada.");
      await respondSupportRequest(requestToRespond.id, responseForm);
      setRequestToRespond(null);
      setResponseForm({ responseMessage: "", estimatedCompletionAt: "" });
      await loadRequests(true);
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
      showToast("success", "Resposta enviada", "O cliente já pode visualizar a resposta.", 4000);
    } catch (error: any) {
      showToast(
        "error",
        "Falha ao responder",
        getApiErrorMessage(error, "Não foi possível responder o pedido."),
        5000,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteRequest() {
    if (!requestToComplete) return;

    try {
      setSaving(true);
      showToast("loading", "Concluindo pedido", "Estamos finalizando este atendimento.");
      await completeSupportRequest(requestToComplete.id, { completionMessage });
      setRequestToComplete(null);
      setCompletionMessage("");
      await loadRequests(true);
      window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
      showToast("success", "Pedido concluído", "O atendimento foi marcado como concluído.", 4000);
    } catch (error: any) {
      showToast(
        "error",
        "Falha ao concluir",
        getApiErrorMessage(error, "Não foi possível concluir o pedido."),
        5000,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <StatusToast
        visible={toast.visible}
        tone={toast.tone}
        title={toast.title}
        message={toast.message}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suporte</h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? "Atenda pedidos de bugs, melhorias e solicitações de clientes."
              : "Abra pedidos de bugs, melhorias e ajustes do software com poucos cliques."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {!isAdmin ? (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              disabled={supportLocked}
              className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Novo pedido
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => loadRequests(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Atualizar dados
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pedidos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Abertos</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.open}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Em atendimento</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">{summary.inProgress}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Concluídos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.completed}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, empresa, solicitante ou resposta"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | SupportRequestStatus)
              }
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="ALL">Todos os status</option>
              <option value="OPEN">Abertos</option>
              <option value="IN_PROGRESS">Em atendimento</option>
              <option value="COMPLETED">Concluídos</option>
            </select>
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Headset size={16} className="mr-2 text-orange-500" />
              {isAdmin
                ? "Visão administrativa de todos os pedidos."
                : "Disponível apenas para clientes no plano Starter."}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Pedido</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Categoria</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Empresa</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Prazo</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Atualização</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando pedidos de suporte...
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum pedido de suporte encontrado.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-slate-500">{item.description}</p>
                      {item.createdByUser ? (
                        <p className="mt-2 text-xs text-slate-400">
                          Solicitante: {item.createdByUser.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{categoryLabel(item.category)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.company.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatDateTime(item.estimatedCompletionAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.status === "COMPLETED"
                        ? formatDateTime(item.completedAt)
                        : formatDateTime(item.respondedAt || item.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {isAdmin && item.status === "OPEN" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRequestToRespond(item);
                              setResponseForm({ responseMessage: item.responseMessage || "", estimatedCompletionAt: "" });
                            }}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Responder
                          </button>
                        ) : null}
                        {isAdmin && item.status === "IN_PROGRESS" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRequestToComplete(item);
                              setCompletionMessage(item.completionMessage || "");
                            }}
                            className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          >
                            Concluir
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRequests.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRequests.length}
            pageSize={PAGE_SIZE}
            itemLabel="pedidos"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-[105] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-900">Novo pedido de suporte</h2>
              <p className="mt-1 text-sm text-slate-500">
                Descreva o bug, melhoria ou solicitação que você precisa no software.
              </p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Título</label>
                <input
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Ex: Ajuste no relatório de pneus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Categoria</label>
                <select
                  value={createForm.category}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      category: event.target.value as SupportRequestCategory,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Descrição</label>
                <textarea
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={6}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Explique o contexto, o que acontece e o que você espera como resultado."
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateRequest}
                disabled={
                  saving ||
                  createForm.title.trim().length < 3 ||
                  createForm.description.trim().length < 10
                }
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Enviar pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requestToRespond ? (
        <div className="fixed inset-0 z-[105] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-900">Responder pedido</h2>
              <p className="mt-1 text-sm text-slate-500">{requestToRespond.title}</p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Resposta</label>
                <textarea
                  value={responseForm.responseMessage}
                  onChange={(event) =>
                    setResponseForm((prev) => ({
                      ...prev,
                      responseMessage: event.target.value,
                    }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Explique o encaminhamento do pedido e o que será feito."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Prazo estimado de conclusão
                </label>
                <input
                  type="datetime-local"
                  value={responseForm.estimatedCompletionAt}
                  onChange={(event) =>
                    setResponseForm((prev) => ({
                      ...prev,
                      estimatedCompletionAt: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRequestToRespond(null)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRespondRequest}
                disabled={saving || responseForm.responseMessage.trim().length < 5}
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Responder pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {requestToComplete ? (
        <div className="fixed inset-0 z-[105] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-900">Concluir pedido</h2>
              <p className="mt-1 text-sm text-slate-500">{requestToComplete.title}</p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Mensagem final</label>
                <textarea
                  value={completionMessage}
                  onChange={(event) => setCompletionMessage(event.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  placeholder="Descreva o que foi entregue ou como o pedido foi encerrado."
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRequestToComplete(null)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCompleteRequest}
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Concluir pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
