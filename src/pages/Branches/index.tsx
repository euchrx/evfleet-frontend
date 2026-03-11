import { useEffect, useMemo, useState } from "react";
import type { Branch } from "../../types/branch";
import {
  createBranch,
  deleteBranch,
  getBranches,
  updateBranch,
} from "../../services/branches";

type BranchFormData = {
  name: string;
  city: string;
  state: string;
};

const initialForm: BranchFormData = {
  name: "",
  city: "",
  state: "",
};

export function BranchesPage() {
  type BranchSortBy = "name" | "city" | "state" | "createdAt";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<BranchSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchFormData>(initialForm);

  async function loadBranchesData() {
    try {
      setLoading(true);
      setPageErrorMessage("");
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar filiais:", error);
      setPageErrorMessage("Não foi possível carregar as filiais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranchesData();
  }, []);

  function openCreateModal() {
    setEditingBranch(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      city: branch.city,
      state: branch.state,
    });
    setFormErrorMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingBranch(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof BranchFormData>(
    field: K,
    value: BranchFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormErrorMessage("");

      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
      };

      if (!payload.name || !payload.city || !payload.state) {
        setFormErrorMessage("Preencha todos os campos obrigatorios.");
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

      setFormErrorMessage(
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : typeof apiMessage === "string" && apiMessage.trim()
          ? apiMessage
          : "Não foi possível salvar a filial."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(branch: Branch) {
    const confirmed = window.confirm(
      `Deseja excluir a filial ${branch.name}?`
    );

    if (!confirmed) return;

    try {
      setPageErrorMessage("");
      await deleteBranch(branch.id);
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

      {pageErrorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageErrorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
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
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando filiais...
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhuma filial encontrada.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id} className="border-t border-slate-200">
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
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
                className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="Nome da filial"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="Cidade"
                  />
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
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="PR"
                  />
                </div>
              </div>

              {formErrorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formErrorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
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
