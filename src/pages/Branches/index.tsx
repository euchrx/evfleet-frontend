import { useEffect, useMemo, useState } from "react";
import type { Branch } from "../../types/branch";
import {
  createBranch,
  deleteBranch,
  getBranches,
  updateBranch,
} from "../../services/branches";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useStatusToast } from "../../contexts/StatusToastContext";

type BranchFormData = {
  name: string;
  city: string;
  state: string;
};
type BranchFieldErrors = Partial<Record<keyof BranchFormData, string>>;

const initialForm: BranchFormData = {
  name: "",
  city: "",
  state: "",
};
const TABLE_PAGE_SIZE = 10;

export function BranchesPage() {
  type BranchSortBy = "name" | "city" | "state" | "createdAt";
  const { canSelectCompanyScope, selectedCompanyId, currentCompany } = useCompanyScope();
  const { showToast } = useStatusToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<BranchFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<BranchSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [deletingSelectedBranches, setDeletingSelectedBranches] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<BranchFormData>(initialForm);
  const effectiveCompanyId = String(selectedCompanyId || currentCompany?.id || "").trim();

  async function loadBranchesData() {
    if (canSelectCompanyScope && !effectiveCompanyId) {
      setBranches([]);
      setLoading(false);
      setPageErrorMessage("Selecione uma empresa no escopo para carregar as filiais.");
      return;
    }

    try {
      setLoading(true);
      setPageErrorMessage("");
      const data = await getBranches(effectiveCompanyId || undefined);
      const nextBranches = Array.isArray(data) ? data : [];
      setBranches(
        effectiveCompanyId
          ? nextBranches.filter(
              (branch) => String(branch.companyId || "").trim() === effectiveCompanyId,
            )
          : nextBranches,
      );
    } catch (error) {
      console.error("Erro ao carregar filiais:", error);
      setPageErrorMessage("Não foi possível carregar as filiais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranchesData();
  }, [effectiveCompanyId]);

  function openCreateModal() {
    if (canSelectCompanyScope && !effectiveCompanyId) {
      setPageErrorMessage("Selecione uma empresa no escopo para cadastrar filial.");
      return;
    }

    setEditingBranch(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      city: branch.city,
      state: branch.state,
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingBranch(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof BranchFormData>(
    field: K,
    value: BranchFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function inputClass(field: keyof BranchFormData) {
    if (fieldErrors[field]) {
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
        name: form.name.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        companyId: effectiveCompanyId || undefined,
      };

      const nextErrors: BranchFieldErrors = {};
      if (!payload.name) nextErrors.name = "Informe o nome.";
      if (!payload.city) nextErrors.city = "Informe a cidade.";
      if (!payload.state) nextErrors.state = "Informe o estado.";
      if (canSelectCompanyScope && !payload.companyId) {
        nextErrors.name = "Selecione uma empresa no escopo para continuar.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      if (editingBranch) {
        await updateBranch(editingBranch.id, payload);
      } else {
        await createBranch(payload);
      }

      closeModal();
      await loadBranchesData();
    } catch (error: any) {
      console.error("Erro ao salvar filial:", error);

      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      setFieldErrors((prev) => ({
        ...prev,
        name:
          Array.isArray(apiMessage)
            ? apiMessage.join(", ")
            : typeof apiMessage === "string" && apiMessage.trim()
              ? apiMessage
              : "Não foi possível salvar. Revise os campos.",
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(branch: Branch) {
    setBranchToDelete(branch);
  }

  async function confirmDeleteBranch() {
    if (!branchToDelete) return;
    try {
      setDeletingBranch(true);
      setPageErrorMessage("");
      await deleteBranch(branchToDelete.id);
      setSelectedBranchIds((prev) => prev.filter((id) => id !== branchToDelete.id));
      setBranchToDelete(null);
      await loadBranchesData();
    } catch (error: any) {
      console.error("Erro ao excluir filial:", error);

      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      setPageErrorMessage(
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : typeof apiMessage === "string" && apiMessage.trim()
          ? apiMessage
          : "Não foi possível excluir a filial."
      );
    } finally {
      setDeletingBranch(false);
    }
  }

  function toggleBranchSelection(branchId: string) {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  }

  function toggleSelectAllBranchesOnPage() {
    const pageIds = paginatedBranches.map((branch) => branch.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedBranchIds.includes(id));

    setSelectedBranchIds((prev) => {
      if (allSelected) return prev.filter((id) => !pageIds.includes(id));
      return Array.from(new Set([...prev, ...pageIds]));
    });
  }

  async function confirmDeleteSelectedBranches() {
    if (selectedBranchIds.length === 0) return;

    try {
      setDeletingSelectedBranches(true);
      setPageErrorMessage("");

      const results = await Promise.allSettled(
        selectedBranchIds.map((id) => deleteBranch(id))
      );
      const failedCount = results.filter((result) => result.status === "rejected").length;

      if (failedCount > 0) {
        setPageErrorMessage(
          failedCount === selectedBranchIds.length
            ? "Não foi possível excluir as filiais selecionadas."
            : `${failedCount} filial(is) não puderam ser excluídas.`
        );
      }

      setSelectedBranchIds([]);
      setIsBulkDeleteModalOpen(false);
      await loadBranchesData();
    } catch (error) {
      console.error("Erro ao excluir filiais em lote:", error);
      setPageErrorMessage("Não foi possível concluir a exclusão em lote das filiais.");
    } finally {
      setDeletingSelectedBranches(false);
    }
  }

  const filteredBranches = useMemo(() => {
    const searchLower = search.toLowerCase();
    const filtered = !search.trim()
      ? branches
      : branches.filter(
          (branch) =>
            branch.name.toLowerCase().includes(searchLower) ||
            branch.city.toLowerCase().includes(searchLower) ||
            branch.state.toLowerCase().includes(searchLower) ||
            new Date(branch.createdAt).toLocaleDateString("pt-BR").toLowerCase().includes(searchLower)
        );

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "city") {
        return a.city.localeCompare(b.city, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "state") return a.state.localeCompare(b.state, "pt-BR") * direction;
      if (sortBy === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      }
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [branches, search, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredBranches.length / TABLE_PAGE_SIZE)),
    [filteredBranches.length]
  );

  const paginatedBranches = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredBranches.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredBranches, currentPage]);

  const allBranchesOnPageSelected =
    paginatedBranches.length > 0 &&
    paginatedBranches.every((branch) => selectedBranchIds.includes(branch.id));

  useEffect(() => {
    setCurrentPage(1);
    setSelectedBranchIds([]);
  }, [search, sortBy, sortDirection, effectiveCompanyId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: branches.length,
      cities: new Set(branches.map((branch) => branch.city.toLowerCase())).size,
      states: new Set(branches.map((branch) => branch.state.toUpperCase())).size,
      createdMonth: branches.filter((branch) => new Date(branch.createdAt) >= monthStart).length,
      createdToday: branches.filter((branch) => new Date(branch.createdAt) >= todayStart).length,
    };
  }, [branches]);

  useEffect(() => {
    if (!pageErrorMessage) return;

    const normalized = pageErrorMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const tone = /sucesso|concluid|excluid/.test(normalized) ? "success" : "error";

    showToast({
      tone,
      title: tone === "success" ? "Operação concluída" : "Atenção",
      message: pageErrorMessage,
    });
    setPageErrorMessage("");
  }, [pageErrorMessage, showToast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Filiais</h1>
          <p className="text-sm text-slate-500">
            Gerencie as filiais cadastradas no sistema
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Cadastrar filial
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Cidades</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">{summary.cities}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Estados</p>
          <p className="mt-1 text-2xl font-bold text-indigo-800">{summary.states}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Novas no mes</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.createdMonth}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Novas hoje</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.createdToday}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por nome, cidade ou estado"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {selectedBranchIds.length > 0
                ? `${selectedBranchIds.length} filial(is) selecionada(s)`
                : "Selecione registros para excluir em lote"}
            </p>
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={selectedBranchIds.length === 0}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Excluir selecionados
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-12 px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={allBranchesOnPageSelected}
                    onChange={toggleSelectAllBranchesOnPage}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                    aria-label="Selecionar filiais da página"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("name")} className="cursor-pointer">Nome {getSortArrow("name")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("city")} className="cursor-pointer">Cidade {getSortArrow("city")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("state")} className="cursor-pointer">Estado {getSortArrow("state")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("createdAt")} className="cursor-pointer">Criada em {getSortArrow("createdAt")}</button>
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
                    colSpan={6}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando filiais...
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhuma filial encontrada.
                  </td>
                </tr>
              ) : (
                paginatedBranches.map((branch) => (
                  <tr key={branch.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedBranchIds.includes(branch.id)}
                        onChange={() => toggleBranchSelection(branch.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label={`Selecionar filial ${branch.name}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {branch.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {branch.city}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {branch.state}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(branch.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(branch)}
                          className="btn-ui btn-ui-neutral"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleDelete(branch)}
                          className="btn-ui btn-ui-danger"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredBranches.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredBranches.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="filiais"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingBranch ? "Editar filial" : "Cadastrar filial"}
                </h2>
                <p className="text-sm text-slate-500">
                  Preencha as informações da filial
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
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={inputClass("name")}
                    placeholder="Nome da filial"
                  />
                  {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    className={inputClass("city")}
                    placeholder="Cidade"
                  />
                  {fieldErrors.city ? <p className="mt-1 text-xs text-red-600">{fieldErrors.city}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Estado
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={form.state}
                    onChange={(e) =>
                      handleChange("state", e.target.value.toUpperCase())
                    }
                    className={`${inputClass("state")} uppercase`}
                    placeholder="PR"
                  />
                  {fieldErrors.state ? <p className="mt-1 text-xs text-red-600">{fieldErrors.state}</p> : null}
                </div>
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
                    : editingBranch
                    ? "Salvar alterações"
                    : "Cadastrar filial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(branchToDelete)}
        title="Excluir filial"
        description={
          branchToDelete
            ? `Deseja excluir a filial ${branchToDelete.name}?`
            : ""
        }
        loading={deletingBranch}
        onCancel={() => setBranchToDelete(null)}
        onConfirm={confirmDeleteBranch}
      />
      <ConfirmDeleteModal
        isOpen={isBulkDeleteModalOpen}
        title="Excluir filiais selecionadas"
        description={`Deseja excluir ${selectedBranchIds.length} filial(is) selecionada(s)?`}
        loading={deletingSelectedBranches}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={confirmDeleteSelectedBranches}
      />
    </div>
  );
  function handleSort(column: BranchSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: BranchSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }
}