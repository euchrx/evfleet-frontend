import { useEffect, useMemo, useState } from "react";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import {
  createCompany,
  deleteCompany,
  getCompanies,
  updateCompany,
} from "../../services/companies";
import type { Company } from "../../types/company";
import { formatDate } from "../../utils/formatters";

type CompanyFormData = {
  name: string;
  document: string;
  slug: string;
  active: boolean;
};

type CompanyFieldErrors = Partial<Record<keyof CompanyFormData, string>>;
type CompanySortBy = "name" | "document" | "slug" | "active" | "createdAt";

const TABLE_PAGE_SIZE = 10;

const initialForm: CompanyFormData = {
  name: "",
  document: "",
  slug: "",
  active: true,
};

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatCnpj(value?: string | null) {
  const digits = onlyDigits(String(value || "")).slice(0, 14);
  if (!digits) return "-";
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function applyCnpjMask(value: string) {
  return formatCnpj(value).replace("-", "");
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CompanyFieldErrors>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortBy, setSortBy] = useState<CompanySortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormData>(initialForm);

  async function loadCompanies() {
    try {
      setLoading(true);
      setErrorMessage("");
      const data = await getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
      setErrorMessage("Não foi possível carregar as empresas.");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  function openCreateModal() {
    setEditingCompany(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(company: Company) {
    setEditingCompany(company);
    setForm({
      name: company.name,
      document: applyCnpjMask(company.document || ""),
      slug: company.slug || "",
      active: company.active,
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingCompany(null);
    setForm(initialForm);
    setFieldErrors({});
  }

  function handleChange<K extends keyof CompanyFormData>(field: K, value: CompanyFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function inputClass(field: keyof CompanyFormData) {
    if (fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setErrorMessage("");

    const name = form.name.trim();
    const document = onlyDigits(form.document);
    const slug = form.slug.trim();

    const nextErrors: CompanyFieldErrors = {};
    if (!name) nextErrors.name = "Informe o nome da empresa.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name,
          document,
          slug,
          active: form.active,
        });
      } else {
        await createCompany({
          name,
          document,
          slug,
        });
      }

      closeModal();
      await loadCompanies();
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Não foi possível salvar a empresa.";
      const message = Array.isArray(apiMessage) ? apiMessage.join(", ") : String(apiMessage);
      if (/slug/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, slug: message }));
      } else if (/nome/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, name: message }));
      } else {
        setErrorMessage(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteCompany() {
    if (!companyToDelete) return;
    try {
      setDeleting(true);
      await deleteCompany(companyToDelete.id);
      setCompanyToDelete(null);
      await loadCompanies();
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Não foi possível excluir a empresa.";
      setErrorMessage(Array.isArray(apiMessage) ? apiMessage.join(", ") : String(apiMessage));
    } finally {
      setDeleting(false);
    }
  }

  function handleSort(column: CompanySortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: CompanySortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  const filteredCompanies = useMemo(() => {
    let filtered = companies;

    if (statusFilter !== "ALL") {
      const isActive = statusFilter === "ACTIVE";
      filtered = filtered.filter((company) => company.active === isActive);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter((company) => {
        const haystack = [
          company.name,
          company.document || "",
          company.slug || "",
          company.active ? "ativa" : "inativa",
          formatDate(company.createdAt),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "document") {
        return (a.document || "").localeCompare(b.document || "", "pt-BR") * direction;
      }
      if (sortBy === "slug") {
        return (a.slug || "").localeCompare(b.slug || "", "pt-BR") * direction;
      }
      if (sortBy === "active") {
        return (Number(a.active) - Number(b.active)) * direction;
      }
      if (sortBy === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      }
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [companies, search, sortBy, sortDirection, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCompanies.length / TABLE_PAGE_SIZE)),
    [filteredCompanies.length],
  );

  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredCompanies.slice(start, start + TABLE_PAGE_SIZE);
  }, [currentPage, filteredCompanies]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortBy, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const summary = useMemo(
    () => ({
      total: companies.length,
      active: companies.filter((company) => company.active).length,
      inactive: companies.filter((company) => !company.active).length,
    }),
    [companies],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500">
            Cadastre, visualize, edite e remova empresas do sistema multiempresa.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Cadastrar empresa
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ativas</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Inativas</p>
          <p className="mt-1 text-2xl font-bold text-red-800">{summary.inactive}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Buscar por nome, documento ou slug"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativas</option>
            <option value="INACTIVE">Inativas</option>
          </select>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("name")} className="cursor-pointer">
                    Nome {getSortArrow("name")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("document")}
                    className="cursor-pointer"
                  >
                    Documento {getSortArrow("document")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("slug")} className="cursor-pointer">
                    Slug {getSortArrow("slug")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("active")} className="cursor-pointer">
                    Status {getSortArrow("active")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleSort("createdAt")}
                    className="cursor-pointer"
                  >
                    Criada em {getSortArrow("createdAt")}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando empresas...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((company) => (
                  <tr key={company.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{company.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatCnpj(company.document)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{company.slug || "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`status-pill ${company.active ? "status-active" : "status-inactive"}`}
                      >
                        {company.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(company.createdAt)}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(company)} className="btn-ui btn-ui-neutral">
                          Editar
                        </button>
                        <button
                          onClick={() => setCompanyToDelete(company)}
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
        {!loading && filteredCompanies.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCompanies.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="empresas"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingCompany ? "Editar empresa" : "Cadastrar empresa"}
                </h2>
                <p className="text-sm text-slate-500">Preencha as informações da empresa.</p>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => handleChange("name", event.target.value)}
                    className={inputClass("name")}
                    placeholder="Ex: EvFleet Transportes"
                  />
                  {fieldErrors.name ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Documento</label>
                  <input
                    type="text"
                    value={form.document}
                    onChange={(event) => handleChange("document", applyCnpjMask(event.target.value))}
                    className={inputClass("document")}
                    placeholder="Ex: 12.345.678/0001-90"
                    maxLength={18}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Slug</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(event) => handleChange("slug", event.target.value)}
                    className={inputClass("slug")}
                    placeholder="Ex: evfleet-transportes"
                  />
                  {fieldErrors.slug ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.slug}</p>
                  ) : null}
                </div>

                {editingCompany ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={form.active ? "ACTIVE" : "INACTIVE"}
                      onChange={(event) =>
                        handleChange("active", event.target.value === "ACTIVE")
                      }
                      className={inputClass("active")}
                    >
                      <option value="ACTIVE">Ativa</option>
                      <option value="INACTIVE">Inativa</option>
                    </select>
                  </div>
                ) : null}
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
                    : editingCompany
                      ? "Salvar alterações"
                      : "Cadastrar empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(companyToDelete)}
        title="Excluir empresa"
        description={
          companyToDelete
            ? `Deseja excluir a empresa ${companyToDelete.name}?`
            : "Deseja excluir esta empresa?"
        }
        loading={deleting}
        onCancel={() => setCompanyToDelete(null)}
        onConfirm={confirmDeleteCompany}
      />
    </div>
  );
}
