import { useEffect, useMemo, useState } from "react";
import type { Driver } from "../../types/driver";
import type { Vehicle } from "../../types/vehicle";
import { createDriver, deleteDriver, getDrivers, updateDriver } from "../../services/drivers";
import { getVehicles } from "../../services/vehicles";
import { useBranch } from "../../contexts/BranchContext";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";

type DriverFormData = {
  name: string;
  cpf: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiresAt: string;
  phone: string;
  status: string;
  vehicleId: string;
};

type DriverFieldErrors = Partial<Record<keyof DriverFormData, string>>;
type DriverSortBy = "name" | "cpf" | "cnh" | "cnhCategory" | "vehicle" | "status";

const initialForm: DriverFormData = {
  name: "",
  cpf: "",
  cnh: "",
  cnhCategory: "",
  cnhExpiresAt: "",
  phone: "",
  status: "ACTIVE",
  vehicleId: "",
};
const TABLE_PAGE_SIZE = 10;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function getDriverStatusLabel(status: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "INACTIVE") return "Inativo";
  return status;
}

export function DriversPage() {
  const { selectedBranchId } = useBranch();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<DriverFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<DriverSortBy>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState(false);
  const [form, setForm] = useState<DriverFormData>(initialForm);

  async function loadData() {
    try {
      setLoading(true);
      setPageErrorMessage("");
      const [driversData, vehiclesData] = await Promise.all([getDrivers(), getVehicles()]);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (error) {
      console.error("Erro ao carregar motoristas:", error);
      setPageErrorMessage("Não foi possível carregar os motoristas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingDriver(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(driver: Driver) {
    setEditingDriver(driver);
    setForm({
      name: driver.name,
      cpf: formatCpf(driver.cpf),
      cnh: driver.cnh,
      cnhCategory: driver.cnhCategory,
      cnhExpiresAt: driver.cnhExpiresAt.slice(0, 10),
      phone: driver.phone ? formatPhone(driver.phone) : "",
      status: driver.status,
      vehicleId: driver.vehicleId || "",
    });
    setFormErrorMessage("");
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingDriver(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof DriverFormData>(field: K, value: DriverFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSort(column: DriverSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: DriverSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function inputClass(field: keyof DriverFormData) {
    if (fieldErrors[field]) {
      return "mt-1 w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200";
    }
    return "mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setFormErrorMessage("");
      setFieldErrors({});

      const payload = {
        name: form.name.trim(),
        cpf: onlyDigits(form.cpf),
        cnh: form.cnh.trim(),
        cnhCategory: form.cnhCategory.trim().toUpperCase(),
        cnhExpiresAt: form.cnhExpiresAt,
        phone: form.phone ? onlyDigits(form.phone) : undefined,
        status: form.status,
        vehicleId: form.vehicleId || null,
      };

      const nextErrors: DriverFieldErrors = {};
      if (!payload.name) nextErrors.name = "Informe o nome.";
      if (!payload.cpf) nextErrors.cpf = "Informe o CPF.";
      if (!payload.cnh) nextErrors.cnh = "Informe a CNH.";
      if (!payload.cnhCategory) nextErrors.cnhCategory = "Informe a categoria da CNH.";
      if (!payload.cnhExpiresAt) nextErrors.cnhExpiresAt = "Informe a validade da CNH.";
      if (!payload.status) nextErrors.status = "Informe o status.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      if (payload.cpf.length !== 11) {
        setFieldErrors({ cpf: "Informe um CPF válido com 11 dígitos." });
        return;
      }

      if (editingDriver) await updateDriver(editingDriver.id, payload);
      else await createDriver(payload);

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error("Erro ao salvar motorista:", error);
      const apiMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
      const apiText = typeof apiMessage === "string" ? apiMessage : "";
      if (/cpf/i.test(apiText)) setFieldErrors((prev) => ({ ...prev, cpf: "CPF ja cadastrado." }));
      if (/cnh/i.test(apiText)) setFieldErrors((prev) => ({ ...prev, cnh: "CNH ja cadastrada." }));
      setFormErrorMessage(Array.isArray(apiMessage) ? apiMessage.join(", ") : apiText || "Não foi possível salvar o motorista.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(driver: Driver) {
    setDriverToDelete(driver);
  }

  async function confirmDeleteDriver() {
    if (!driverToDelete) return;
    try {
      setDeletingDriver(true);
      setPageErrorMessage("");
      await deleteDriver(driverToDelete.id);
      setDriverToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir motorista:", error);
      setPageErrorMessage("Não foi possível excluir o motorista.");
    } finally {
      setDeletingDriver(false);
    }
  }

  const availableVehicles = useMemo(() => {
    const filtered = selectedBranchId
      ? vehicles.filter((vehicle) => vehicle.branchId === selectedBranchId)
      : vehicles;
    const sorted = [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" })
    );

    if (editingDriver && form.vehicleId) {
      return sorted.filter(
        (vehicle) => vehicle.status === "ACTIVE" || vehicle.id === form.vehicleId
      );
    }

    return sorted.filter((vehicle) => vehicle.status === "ACTIVE");
  }, [vehicles, selectedBranchId, editingDriver, form.vehicleId]);

  const filteredDrivers = useMemo(() => {
    let filtered = selectedBranchId
      ? drivers.filter((driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId)
      : drivers;

    if (statusFilter !== "ALL") filtered = filtered.filter((driver) => driver.status === statusFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (driver) => {
          const haystack = [
            driver.name,
            driver.cpf,
            driver.cnh,
            driver.cnhCategory,
            driver.phone || "",
            getDriverStatusLabel(driver.status),
            driver.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model}` : "",
            driver.vehicle?.plate || "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(term) || driver.cpf.includes(onlyDigits(search));
        }
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "cpf") return a.cpf.localeCompare(b.cpf, "pt-BR") * direction;
      if (sortBy === "cnh") return a.cnh.localeCompare(b.cnh, "pt-BR") * direction;
      if (sortBy === "cnhCategory") return a.cnhCategory.localeCompare(b.cnhCategory, "pt-BR") * direction;
      if (sortBy === "vehicle") {
        const aVehicle = a.vehicle ? `${a.vehicle.brand} ${a.vehicle.model}` : "";
        const bVehicle = b.vehicle ? `${b.vehicle.brand} ${b.vehicle.model}` : "";
        return aVehicle.localeCompare(bVehicle, "pt-BR", { sensitivity: "base" }) * direction;
      }
      if (sortBy === "status") return a.status.localeCompare(b.status, "pt-BR") * direction;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [drivers, selectedBranchId, statusFilter, search, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDrivers.length / TABLE_PAGE_SIZE)),
    [filteredDrivers.length]
  );

  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredDrivers.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredDrivers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortBy, sortDirection, selectedBranchId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const scoped = selectedBranchId
      ? drivers.filter((driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId)
      : drivers;

    return {
      total: scoped.length,
      active: scoped.filter((driver) => driver.status === "ACTIVE").length,
      inactive: scoped.filter((driver) => driver.status !== "ACTIVE").length,
    };
  }, [drivers, selectedBranchId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Motoristas</h1>
          <p className="text-sm text-slate-500">Gerencie os motoristas cadastrados no sistema</p>
        </div>
        <button onClick={openCreateModal} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">+ Cadastrar motorista</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ativos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{summary.active}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Inativos</p>
          <p className="mt-1 text-2xl font-bold text-red-800">{summary.inactive}</p>
        </div>
        <div className="hidden rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Com veículo</p>
        </div>
        <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Sem vinculo</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input type="text" placeholder="Buscar por nome, CPF ou CNH" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200">
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
      </div>

      {pageErrorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageErrorMessage}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("name")} className="cursor-pointer">Nome {getSortArrow("name")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("cpf")} className="cursor-pointer">CPF {getSortArrow("cpf")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("cnh")} className="cursor-pointer">CNH {getSortArrow("cnh")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("cnhCategory")} className="cursor-pointer">Categoria {getSortArrow("cnhCategory")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("vehicle")} className="cursor-pointer">Veículo {getSortArrow("vehicle")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600"><button type="button" onClick={() => handleSort("status")} className="cursor-pointer">Status {getSortArrow("status")}</button></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Carregando motoristas...</td></tr>
              ) : filteredDrivers.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">Nenhum motorista encontrado.</td></tr>
              ) : (
                paginatedDrivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{driver.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatCpf(driver.cpf)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{driver.cnh}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{driver.cnhCategory}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{driver.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model}` : "Sem vinculo"}</td>
                    <td className="px-6 py-4 text-sm"><span className={`status-pill ${driver.status === "ACTIVE" ? "status-active" : "status-inactive"}`}>{getDriverStatusLabel(driver.status)}</span></td>
                    <td className="px-6 py-4 text-sm"><div className="flex gap-2"><button onClick={() => openEditModal(driver)} className="btn-ui btn-ui-neutral">Editar</button><button onClick={() => handleDelete(driver)} className="btn-ui btn-ui-danger">Excluir</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredDrivers.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDrivers.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="motoristas"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingDriver ? "Editar motorista" : "Cadastrar motorista"}</h2>
                <p className="text-sm text-slate-500">Preencha as informações do motorista</p>
              </div>
              <button onClick={closeModal} className="cursor-pointer rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100">Fechar</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Nome</label><input type="text" value={form.name} onChange={(e) => handleChange("name", e.target.value)} className={inputClass("name")} placeholder="Nome completo" />{fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">CPF</label><input type="text" value={form.cpf} onChange={(e) => handleChange("cpf", formatCpf(e.target.value))} className={inputClass("cpf")} placeholder="000.000.000-00" />{fieldErrors.cpf ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cpf}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Telefone</label><input type="text" value={form.phone} onChange={(e) => handleChange("phone", formatPhone(e.target.value))} className={inputClass("phone")} placeholder="(00) 00000-0000" />{fieldErrors.phone ? <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">CNH</label><input type="text" value={form.cnh} onChange={(e) => handleChange("cnh", e.target.value)} className={inputClass("cnh")} placeholder="Numero da CNH" />{fieldErrors.cnh ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cnh}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Categoria CNH</label><input type="text" value={form.cnhCategory} onChange={(e) => handleChange("cnhCategory", e.target.value.toUpperCase())} className={`${inputClass("cnhCategory")} uppercase`} placeholder="AB" />{fieldErrors.cnhCategory ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cnhCategory}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Vencimento da CNH</label><input type="date" value={form.cnhExpiresAt} onChange={(e) => handleChange("cnhExpiresAt", e.target.value)} className={inputClass("cnhExpiresAt")} />{fieldErrors.cnhExpiresAt ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cnhExpiresAt}</p> : null}</div>
                <div><label className="block text-sm font-medium text-slate-700">Status</label><select value={form.status} onChange={(e) => handleChange("status", e.target.value)} className={inputClass("status")}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select>{fieldErrors.status ? <p className="mt-1 text-xs text-red-600">{fieldErrors.status}</p> : null}</div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700">Veículo vinculado</label><select value={form.vehicleId} onChange={(e) => handleChange("vehicleId", e.target.value)} className={inputClass("vehicleId")}><option value="">Sem vinculo</option>{availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model}</option>)}</select>{fieldErrors.vehicleId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleId}</p> : null}</div>
              </div>

              {formErrorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formErrorMessage}</div> : null}

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button type="button" onClick={closeModal} className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70">{saving ? "Salvando..." : editingDriver ? "Salvar alterações" : "Cadastrar motorista"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(driverToDelete)}
        title="Excluir motorista"
        description={
          driverToDelete
            ? `Deseja excluir o motorista ${driverToDelete.name}?`
            : ""
        }
        loading={deletingDriver}
        onCancel={() => setDriverToDelete(null)}
        onConfirm={confirmDeleteDriver}
      />
    </div>
  );
}
