import { useEffect, useMemo, useState } from "react";
import type { User } from "../../types/user";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from "../../services/users";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";

type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "FLEET_MANAGER";
  companyId: string;
};
type UserFieldErrors = Partial<Record<keyof UserFormData, string>>;

const initialForm: UserFormData = {
  name: "",
  email: "",
  password: "",
  role: "FLEET_MANAGER",
  companyId: "",
};
const TABLE_PAGE_SIZE = 10;

export function UsersPage() {
  type UserSortBy = "name" | "email" | "company" | "role" | "createdAt";
  const { canSelectCompanyScope, selectedCompanyId, options } = useCompanyScope();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<UserFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<UserSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [deletingSelectedUsers, setDeletingSelectedUsers] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<UserFormData>(initialForm);
  const companyNameById = useMemo(
    () => new Map(options.map((company) => [company.id, company.name])),
    [options],
  );

  async function loadUsersData() {
    try {
      setLoading(true);
      setPageErrorMessage("");
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      setPageErrorMessage("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsersData();
  }, [selectedCompanyId]);

  function openCreateModal() {
    if (canSelectCompanyScope && !selectedCompanyId && options.length === 0) {
      setPageErrorMessage("Selecione uma empresa no escopo para cadastrar usuário.");
      return;
    }

    setEditingUser(null);
    setForm({
      ...initialForm,
      companyId: "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      companyId: user.companyId || selectedCompanyId || "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingUser(null);
    setForm(initialForm);
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof UserFormData>(
    field: K,
    value: UserFormData[K]
  ) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "role" && value === "ADMIN") {
        next.companyId = "";
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "role" && value === "ADMIN") {
      setFieldErrors((prev) => ({ ...prev, companyId: undefined }));
    }
  }

  function inputClass(field: keyof UserFormData) {
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

      const basePayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        companyId: form.companyId.trim() || undefined,
      };

      const nextErrors: UserFieldErrors = {};
      if (!basePayload.name) nextErrors.name = "Informe o nome.";
      if (!basePayload.email) nextErrors.email = "Informe o e-mail.";
      if (!basePayload.role) nextErrors.role = "Selecione o perfil.";
      if (basePayload.role !== "ADMIN" && !basePayload.companyId) {
        nextErrors.companyId = "Selecione uma empresa.";
      }
      if (!editingUser && !form.password.trim()) nextErrors.password = "Informe a senha.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      if (editingUser) {
        await updateUser(editingUser.id, basePayload);
      } else {
        await createUser({
          ...basePayload,
          password: form.password.trim(),
        });
      }

      closeModal();
      await loadUsersData();
    } catch (error: any) {
      console.error("Erro ao salvar usuário:", error);

      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      const apiText =
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : typeof apiMessage === "string" && apiMessage.trim()
            ? apiMessage
            : "Não foi possível salvar. Revise os campos.";
      if (/email/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, email: apiText }));
      } else if (/senha|password/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, password: apiText }));
      } else {
        setFieldErrors((prev) => ({ ...prev, name: apiText }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: User) {
    setUserToDelete(user);
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;
    try {
      setDeletingUser(true);
      await deleteUser(userToDelete.id);
      setSelectedUserIds((prev) => prev.filter((id) => id !== userToDelete.id));
      setUserToDelete(null);
      await loadUsersData();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      setPageErrorMessage("Não foi possível excluir o usuário.");
    } finally {
      setDeletingUser(false);
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function toggleSelectAllUsersOnPage() {
    const pageIds = paginatedUsers.map((user) => user.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedUserIds.includes(id));

    setSelectedUserIds((prev) => {
      if (allSelected) return prev.filter((id) => !pageIds.includes(id));
      return Array.from(new Set([...prev, ...pageIds]));
    });
  }

  async function confirmDeleteSelectedUsers() {
    if (selectedUserIds.length === 0) return;

    try {
      setDeletingSelectedUsers(true);
      setPageErrorMessage("");

      const results = await Promise.allSettled(
        selectedUserIds.map((id) => deleteUser(id))
      );
      const failedCount = results.filter((result) => result.status === "rejected").length;

      if (failedCount > 0) {
        setPageErrorMessage(
          failedCount === selectedUserIds.length
            ? "Não foi possível excluir os usuários selecionados."
            : `${failedCount} usuário(s) não puderam ser excluídos.`
        );
      }

      setSelectedUserIds([]);
      setIsBulkDeleteModalOpen(false);
      await loadUsersData();
    } catch (error) {
      console.error("Erro ao excluir usuários em lote:", error);
      setPageErrorMessage("Não foi possível concluir a exclusão em lote dos usuários.");
    } finally {
      setDeletingSelectedUsers(false);
    }
  }

  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (roleFilter !== "ALL") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();

      filtered = filtered.filter(
        (user) => {
          const roleLabel = user.role === "ADMIN" ? "administrador" : "gestor";
          const haystack = [
            user.name,
            user.email,
            companyNameById.get(user.companyId || "") || "sem empresa vinculada",
            user.role,
            roleLabel,
            new Date(user.createdAt).toLocaleDateString("pt-BR"),
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(searchLower);
        }
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "email") {
        return a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "company") {
        const companyA = companyNameById.get(a.companyId || "") || "";
        const companyB = companyNameById.get(b.companyId || "") || "";
        return companyA.localeCompare(companyB, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "role") return a.role.localeCompare(b.role, "pt-BR") * direction;
      if (sortBy === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      }
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [companyNameById, users, roleFilter, search, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / TABLE_PAGE_SIZE)),
    [filteredUsers.length]
  );

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredUsers.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  const allUsersOnPageSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((user) => selectedUserIds.includes(user.id));

  useEffect(() => {
    setCurrentPage(1);
    setSelectedUserIds([]);
  }, [search, roleFilter, sortBy, sortDirection, selectedCompanyId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      managers: users.filter((user) => user.role === "FLEET_MANAGER").length,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">
            Gerencie acessos e perfis do sistema
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Cadastrar usuário
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Administradores</p>
          <p className="mt-1 text-2xl font-bold text-orange-800">{summary.admins}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Gestores</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">{summary.managers}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos os perfis</option>
            <option value="ADMIN">Administrador</option>
            <option value="FLEET_MANAGER">Gestor</option>
          </select>
        </div>
      </div>

      {pageErrorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageErrorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {selectedUserIds.length > 0
                ? `${selectedUserIds.length} usuário(s) selecionado(s)`
                : "Selecione registros para excluir em lote"}
            </p>
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={selectedUserIds.length === 0}
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
                    checked={allUsersOnPageSelected}
                    onChange={toggleSelectAllUsersOnPage}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                    aria-label="Selecionar usuários da página"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("name")} className="cursor-pointer">Nome {getSortArrow("name")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("email")} className="cursor-pointer">E-mail {getSortArrow("email")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("company")} className="cursor-pointer">Empresa {getSortArrow("company")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("role")} className="cursor-pointer">Perfil {getSortArrow("role")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("createdAt")} className="cursor-pointer">Criado em {getSortArrow("createdAt")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                        aria-label={`Selecionar usuário ${user.name}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {companyNameById.get(user.companyId || "") || "Sem empresa vinculada"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.role === "ADMIN" ? "Administrador" : "Gestor"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="btn-ui btn-ui-neutral"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleDelete(user)}
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
        {!loading && filteredUsers.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="usuários"
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
                  {editingUser ? "Editar usuário" : "Cadastrar usuário"}
                </h2>
                <p className="text-sm text-slate-500">
                  Preencha as informações do usuário
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Empresa {form.role === "ADMIN" ? <span className="text-slate-400">(opcional)</span> : null}
                  </label>
                  <select
                    value={form.companyId}
                    onChange={(e) => handleChange("companyId", e.target.value)}
                    className={inputClass("companyId")}
                    disabled={!canSelectCompanyScope || form.role === "ADMIN"}
                  >
                    <option value="">
                      {form.role === "ADMIN" ? "Sem empresa vinculada" : "Selecione uma empresa"}
                    </option>
                    {options.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.companyId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.companyId}</p> : null}
                  {form.role === "ADMIN" ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Administradores podem ser cadastrados sem vínculo com uma empresa.
                    </p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={inputClass("name")}
                    placeholder="Nome completo"
                  />
                  {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={inputClass("email")}
                    placeholder="usuario@empresa.com"
                  />
                  {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
                </div>

                {!editingUser && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Senha</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      className={inputClass("password")}
                      placeholder="Senhá do usuário"
                    />
                    {fieldErrors.password ? <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Perfil</label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      handleChange(
                        "role",
                        e.target.value as "ADMIN" | "FLEET_MANAGER"
                      )
                    }
                    className={inputClass("role")}
                  >
                    <option value="FLEET_MANAGER">Gestor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                  {fieldErrors.role ? <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p> : null}
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
                    : editingUser
                    ? "Salvar alterações"
                    : "Cadastrar usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(userToDelete)}
        title="Excluir usuário"
        description={
          userToDelete ? `Deseja excluir o usuário ${userToDelete.name}?` : ""
        }
        loading={deletingUser}
        onCancel={() => setUserToDelete(null)}
        onConfirm={confirmDeleteUser}
      />
      <ConfirmDeleteModal
        isOpen={isBulkDeleteModalOpen}
        title="Excluir usuários selecionados"
        description={`Deseja excluir ${selectedUserIds.length} usuário(s) selecionado(s)?`}
        loading={deletingSelectedUsers}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={confirmDeleteSelectedUsers}
      />
    </div>
  );
  function handleSort(column: UserSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: UserSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }
}
