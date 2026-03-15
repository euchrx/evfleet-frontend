import { useEffect, useMemo, useState } from "react";
import type { User } from "../../types/user";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from "../../services/users";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";

type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "FLEET_MANAGER";
};

const initialForm: UserFormData = {
  name: "",
  email: "",
  password: "",
  role: "FLEET_MANAGER",
};

export function UsersPage() {
  type UserSortBy = "name" | "email" | "role" | "createdAt";
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<UserSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [form, setForm] = useState<UserFormData>(initialForm);

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
  }, []);

  function openCreateModal() {
    setEditingUser(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setFormErrorMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingUser(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof UserFormData>(
    field: K,
    value: UserFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormErrorMessage("");

      const basePayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      };

      if (!basePayload.name || !basePayload.email || !basePayload.role) {
        setFormErrorMessage("Preencha todos os campos obrigatórios.");
        return;
      }

      if (editingUser) {
        await updateUser(editingUser.id, basePayload);
      } else {
        if (!form.password.trim()) {
          setFormErrorMessage("Informe a senha do usuário.");
          return;
        }

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

      setFormErrorMessage(
        Array.isArray(apiMessage)
          ? apiMessage.join(", ")
          : typeof apiMessage === "string" && apiMessage.trim()
          ? apiMessage
          : "Não foi possível salvar o usuário."
      );
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
      setUserToDelete(null);
      await loadUsersData();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      setPageErrorMessage("Não foi possível excluir o usuário.");
    } finally {
      setDeletingUser(false);
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
      if (sortBy === "role") return a.role.localeCompare(b.role, "pt-BR") * direction;
      if (sortBy === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      }
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [users, roleFilter, search, sortBy, sortDirection]);

  const summary = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: users.length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      managers: users.filter((user) => user.role === "FLEET_MANAGER").length,
      createdMonth: users.filter((user) => new Date(user.createdAt) >= monthStart).length,
      createdToday: users.filter((user) => new Date(user.createdAt) >= todayStart).length,
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Novos no mes</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.createdMonth}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Novos hoje</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{summary.createdToday}</p>
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
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("name")} className="cursor-pointer">Nome {getSortArrow("name")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("email")} className="cursor-pointer">E-mail {getSortArrow("email")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("role")} className="cursor-pointer">Perfil {getSortArrow("role")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("createdAt")} className="cursor-pointer">Criado em {getSortArrow("createdAt")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
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
                className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="Nome completo"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="usuario@empresa.com"
                  />
                </div>

                {!editingUser && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Senha</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      placeholder="Senhá do usuário"
                    />
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
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                    <option value="FLEET_MANAGER">Gestor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
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
