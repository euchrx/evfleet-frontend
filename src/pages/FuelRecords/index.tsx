import { useEffect, useMemo, useState } from "react";
import type { Vehicle } from "../../types/vehicle";
import type { Driver } from "../../types/driver";
import {
  acknowledgeFuelRecordAnomaly,
  createFuelRecord,
  deleteFuelRecord,
  getFuelInsights,
  getFuelRecords,
  updateFuelRecord,
  type FuelInsights,
  type FuelRecord,
} from "../../services/fuelRecords";
import {
  detectFuelAnomalies,
} from "../../services/fuelAnomalies";
import { getVehicles } from "../../services/vehicles";
import { getDrivers } from "../../services/drivers";
import { useBranch } from "../../contexts/BranchContext";
import { useLocation } from "react-router-dom";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";

type FuelFormData = {
  liters: string;
  totalValue: string;
  km: string;
  fuelDate: string;
  fuelType: "GASOLINE" | "ETHANOL" | "DIESEL" | "FLEX" | "ELECTRIC" | "HYBRID" | "CNG";
  vehicleId: string;
  driverId: string;
};

type FuelFieldErrors = Partial<Record<keyof FuelFormData, string>>;

const initialForm: FuelFormData = {
  liters: "",
  totalValue: "",
  km: "",
  fuelDate: "",
  fuelType: "DIESEL",
  vehicleId: "",
  driverId: "",
};
const TABLE_PAGE_SIZE = 10;

function formatMoney(value: string) {
  const digits = value.replace(/\D/g, "");
  const number = Number(digits) / 100;

  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatLocalDate(dateValue: string) {
  const raw = String(dateValue || "").slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const fallback = new Date(dateValue);
    if (Number.isNaN(fallback.getTime())) return "-";
    return fallback.toLocaleDateString("pt-BR");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString("pt-BR");
}

export function FuelRecordsPage() {
  const location = useLocation();
  const { selectedBranchId, branches } = useBranch();
  type FuelSortBy =
    | "branch"
    | "vehicle"
    | "driver"
    | "fuelDate"
    | "fuelType"
    | "liters"
    | "totalValue"
    | "km"
    | "avgConsumption";

  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [insights, setInsights] = useState<FuelInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FuelFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<FuelSortBy>("vehicle");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FuelRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [form, setForm] = useState<FuelFormData>(initialForm);
  const [anomalyRefreshSeed, setAnomalyRefreshSeed] = useState(0);

  function notifyHeaderNotifications() {
    window.dispatchEvent(new CustomEvent("evfleet-notifications-updated"));
  }

  async function loadData() {
    try {
      setLoading(true);
      setPageErrorMessage("");

      const [recordsData, vehiclesData, driversData, insightsData] = await Promise.all([
        getFuelRecords(),
        getVehicles(),
        getDrivers(),
        getFuelInsights(),
      ]);

      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setInsights(insightsData || null);
    } catch (error) {
      console.error("Erro ao carregar abastecimentos:", error);
      setPageErrorMessage("Não foi possível carregar os abastecimentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.hash !== "#deteccao-anomalias") return;
    window.setTimeout(() => {
      const element = document.getElementById("deteccao-anomalias");
      if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [location.hash, loading]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const plateParam = query.get("plate");
    const driverParam = query.get("driver");
    if (!plateParam && !driverParam) return;
    setSearch(plateParam || driverParam || "");
  }, [location.search]);

  useEffect(() => {
    function refreshAnomalies() {
      setAnomalyRefreshSeed((prev) => prev + 1);
    }

    window.addEventListener("evfleet-fuel-anomalies-updated", refreshAnomalies);
    return () => {
      window.removeEventListener("evfleet-fuel-anomalies-updated", refreshAnomalies);
    };
  }, []);

  function getBranchNameByVehicleId(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return "Filial";

    return (
      branches.find((branch) => branch.id === vehicle.branchId)?.name || "Filial"
    );
  }

  function getRecordBranchName(record: FuelRecord) {
    if (record.vehicle?.branch.name) return record.vehicle.branch.name;
    return getBranchNameByVehicleId(record.vehicleId);
  }

  function openCreateModal() {
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(record: FuelRecord) {
    setEditingRecord(record);
    setForm({
      liters: String(record.liters).replace(".", ","),
      totalValue: String(record.totalValue).replace(".", ","),
      km: String(record.km),
      fuelDate: record.fuelDate.slice(0, 10),
      fuelType: record.fuelType || "DIESEL",
      vehicleId: record.vehicleId,
      driverId: record.driverId || "",
    });
    setFormErrorMessage("");
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrorMessage("");
    setFieldErrors({});
    setIsModalOpen(false);
  }

  function handleChange<K extends keyof FuelFormData>(
    field: K,
    value: FuelFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function inputClass(field: keyof FuelFormData) {
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
        liters: Number(form.liters.replace(/\./g, "").replace(",", ".")),
        totalValue: Number(form.totalValue.replace(/\./g, "").replace(",", ".")),
        km: Number(form.km),
        fuelDate: form.fuelDate,
        fuelType: form.fuelType,
        vehicleId: form.vehicleId,
        driverId: form.driverId || null,
      };

      const nextErrors: FuelFieldErrors = {};
      if (!payload.vehicleId) nextErrors.vehicleId = "Selecione um veículo.";
      if (!payload.fuelDate) nextErrors.fuelDate = "Informe a data.";
      if (Number.isNaN(payload.liters) || payload.liters <= 0) {
        nextErrors.liters = "Informe os litros corretamente.";
      }
      if (Number.isNaN(payload.totalValue) || payload.totalValue <= 0) {
        nextErrors.totalValue = "Informe o valor total corretamente.";
      }
      if (Number.isNaN(payload.km) || payload.km < 0) {
        nextErrors.km = "Informe o KM corretamente.";
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }

      const branchName = getBranchNameByVehicleId(payload.vehicleId);

      const payloadWithBranch = {
        ...payload,
        station: branchName,
      };

      if (editingRecord) {
        await updateFuelRecord(editingRecord.id, payloadWithBranch);
      } else {
        await createFuelRecord(payloadWithBranch);
      }

      closeModal();
      await loadData();
      notifyHeaderNotifications();
    } catch (error: any) {
      console.error("Erro ao salvar abastecimento:", error);

      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "";

      if (Array.isArray(apiMessage)) {
        setFormErrorMessage(apiMessage.join(", "));
        return;
      }

      const apiText = typeof apiMessage === "string" ? apiMessage : "";
      if (/litro/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, liters: "Litros inválidos." }));
      }
      if (/valor|total/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, totalValue: "Valor total inválido." }));
      }
      if (/km|odometro/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, km: "KM inválido." }));
      }
      if (/data|date/i.test(apiText)) {
        setFieldErrors((prev) => ({ ...prev, fuelDate: "Data invalida." }));
      }

      setFormErrorMessage(
        typeof apiMessage === "string" && apiMessage.trim()
          ? apiMessage
          : "Não foi possível salvar o abastecimento."
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRecord() {
    if (!recordToDelete) return;

    try {
      setDeletingRecord(true);
      setPageErrorMessage("");

      await deleteFuelRecord(recordToDelete.id);
      setRecordToDelete(null);
      await loadData();
      notifyHeaderNotifications();
    } catch (error) {
      console.error("Erro ao excluir abastecimento:", error);
      setPageErrorMessage("Não foi possível excluir o abastecimento.");
    } finally {
      setDeletingRecord(false);
    }
  }


  const availableVehicles = useMemo(() => {
    let filtered = vehicles;

    if (selectedBranchId) {
      filtered = filtered.filter((vehicle) => vehicle.branchId === selectedBranchId);
    }

    const sorted = [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" })
    );

    if (editingRecord && form.vehicleId) {
      return sorted.filter(
        (vehicle) => vehicle.status === "ACTIVE" || vehicle.id === form.vehicleId
      );
    }

    return sorted.filter((vehicle) => vehicle.status === "ACTIVE");
  }, [vehicles, selectedBranchId, editingRecord, form.vehicleId]);

  const availableDrivers = useMemo(() => {
    let filtered = drivers;

    if (selectedBranchId) {
      filtered = filtered.filter(
        (driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId
      );
    }

    const sorted = [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );

    if (editingRecord && form.driverId) {
      return sorted.filter(
        (driver) => driver.status === "ACTIVE" || driver.id === form.driverId
      );
    }

    return sorted.filter((driver) => driver.status === "ACTIVE");
  }, [drivers, selectedBranchId, editingRecord, form.driverId]);

  const latestKmByVehicle = useMemo(
    () => resolveLatestVehicleKmMap({ vehicles, fuelRecords: records }),
    [vehicles, records],
  );

  function handleVehicleChange(vehicleId: string) {
    if (editingRecord) {
      handleChange("vehicleId", vehicleId);
      return;
    }
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    const latestKm = latestKmByVehicle.get(vehicleId);
    setForm((prev) => ({
      ...prev,
      vehicleId,
      km: typeof latestKm === "number" ? String(latestKm) : "",
      fuelType: selectedVehicle?.fuelType || prev.fuelType,
    }));
    setFieldErrors((prev) => ({ ...prev, vehicleId: undefined, km: undefined }));
  }

  const filteredRecords = useMemo(() => {
    let filtered = records;

    if (selectedBranchId) {
      filtered = filtered.filter(
        (record) =>
          record.vehicle?.branchId === selectedBranchId ||
          vehicles.find((vehicle) => vehicle.id === record.vehicleId)?.branchId ===
          selectedBranchId
      );
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();

      filtered = filtered.filter(
        (record) => {
          const avgText = record.averageConsumptionKmPerLiter
            ? record.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
            : "";
          const haystack = [
            getRecordBranchName(record),
            record.station || "",
            record.vehicle?.plate || "",
            record.vehicle ? `${record.vehicle.brand} ${record.vehicle.model}` : "",
            record.driver?.name || "",
            record.fuelType,
            formatLocalDate(record.fuelDate),
            String(record.liters),
            String(record.totalValue),
            String(record.km),
            avgText,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(searchLower);
        }
      );
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "branch") {
        return (
          getRecordBranchName(a).localeCompare(getRecordBranchName(b), "pt-BR", {
            sensitivity: "base",
          }) * direction
        );
      }
      if (sortBy === "driver") {
        return ((a.driver?.name || "").localeCompare(b.driver?.name || "", "pt-BR", {
          sensitivity: "base",
        })) * direction;
      }
      if (sortBy === "fuelDate") {
        return (new Date(a.fuelDate).getTime() - new Date(b.fuelDate).getTime()) * direction;
      }
      if (sortBy === "fuelType") return a.fuelType.localeCompare(b.fuelType, "pt-BR") * direction;
      if (sortBy === "liters") return (a.liters - b.liters) * direction;
      if (sortBy === "totalValue") return (a.totalValue - b.totalValue) * direction;
      if (sortBy === "km") return (a.km - b.km) * direction;
      if (sortBy === "avgConsumption") {
        const aHasValue = typeof a.averageConsumptionKmPerLiter === "number";
        const bHasValue = typeof b.averageConsumptionKmPerLiter === "number";

        if (!aHasValue && !bHasValue) return 0;
        if (!aHasValue) return 1;
        if (!bHasValue) return -1;

        return (
          ((a.averageConsumptionKmPerLiter as number) -
            (b.averageConsumptionKmPerLiter as number)) * direction
        );
      }

      const plateA = a.vehicle?.plate || "";
      const plateB = b.vehicle?.plate || "";
      return plateA.localeCompare(plateB, "pt-BR", { sensitivity: "base" }) * direction;
    });
  }, [records, search, selectedBranchId, vehicles, branches, sortBy, sortDirection]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRecords.length / TABLE_PAGE_SIZE)),
    [filteredRecords.length]
  );

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return filteredRecords.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedBranchId, sortBy, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const anomalyMapByRecordId = useMemo(() => {
    const list = detectFuelAnomalies(filteredRecords, vehicles);
    return list.reduce<Record<string, (typeof list)[number]>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [filteredRecords, vehicles, anomalyRefreshSeed]);

  const detectedAnomalies = useMemo(
    () => Object.values(anomalyMapByRecordId),
    [anomalyMapByRecordId]
  );

  const summary = useMemo(() => {
    const totalLiters = filteredRecords.reduce((sum, record) => sum + (record.liters || 0), 0);
    const totalValue = filteredRecords.reduce((sum, record) => sum + (record.totalValue || 0), 0);
    const anomalyCount = detectedAnomalies.length;

    return {
      total: filteredRecords.length,
      liters: totalLiters,
      totalValue,
      anomalies: anomalyCount,
      normal: Math.max(filteredRecords.length - anomalyCount, 0),
    };
  }, [filteredRecords, detectedAnomalies]);

  async function handleConfirmAnomaly(recordId: string) {
    try {
      await acknowledgeFuelRecordAnomaly(recordId);
      await loadData();
      window.dispatchEvent(new CustomEvent("evfleet-fuel-anomalies-updated"));
      notifyHeaderNotifications();
    } catch {
      setPageErrorMessage("Não foi possível marcar a anomalia como conferida.");
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Abastecimentos</h1>
          <p className="text-sm text-slate-500">
            Gerencie os registros de abastecimento da frota
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Cadastrar abastecimento
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Litros</p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            {summary.liters.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Valor total</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {summary.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por filial ou placa"
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
                  <button type="button" onClick={() => handleSort("branch")} className="cursor-pointer">Filial {getSortArrow("branch")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("vehicle")} className="cursor-pointer">Veículo {getSortArrow("vehicle")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("driver")} className="cursor-pointer">Motorista {getSortArrow("driver")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("fuelDate")} className="cursor-pointer">Data {getSortArrow("fuelDate")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("fuelType")} className="cursor-pointer">Combustível {getSortArrow("fuelType")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("liters")} className="cursor-pointer">Litros {getSortArrow("liters")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("totalValue")} className="cursor-pointer">Valor total {getSortArrow("totalValue")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("km")} className="cursor-pointer">KM {getSortArrow("km")}</button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  <button type="button" onClick={() => handleSort("avgConsumption")} className="cursor-pointer">Consumo médio {getSortArrow("avgConsumption")}</button>
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
                    colSpan={10}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Carregando abastecimentos...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhum abastecimento encontrado.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr key={record.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {getRecordBranchName(record)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.vehicle
                        ? `${record.vehicle.brand} ${record.vehicle.model}`
                        : record.vehicleId}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.driver?.name || "Sem motorista"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatLocalDate(record.fuelDate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.fuelType}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.liters.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {record.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{record.km}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {record.averageConsumptionKmPerLiter
                        ? `${record.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} km/L`
                        : "-"}
                      {anomalyMapByRecordId[record.id] && (
                        <span className="status-pill status-anomaly ml-2">
                          Anomalia
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(record)}
                          className="btn-ui btn-ui-neutral"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setRecordToDelete(record)}
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
        {!loading && filteredRecords.length > 0 ? (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRecords.length}
            pageSize={TABLE_PAGE_SIZE}
            itemLabel="abastecimentos"
            onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          />
        ) : null}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingRecord ? "Editar abastecimento" : "Cadastrar abastecimento"}
                </h2>
                <p className="text-sm text-slate-500">
                  Preencha as informações do abastecimento
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
                    Veículo
                  </label>
                  <select
                    value={form.vehicleId}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className={inputClass("vehicleId")}
                  >
                    <option value="">Selecione um veículo</option>
                    {availableVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.vehicleId ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleId}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Motorista
                  </label>
                  <select
                    value={form.driverId}
                    onChange={(e) => handleChange("driverId", e.target.value)}
                    className={inputClass("driverId")}
                  >
                    <option value="">Selecione um motorista</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.driverId ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.driverId}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Tipo de combustível
                  </label>
                  <select
                    value={form.fuelType}
                    onChange={(e) =>
                      handleChange(
                        "fuelType",
                        e.target.value as FuelFormData["fuelType"]
                      )
                    }
                    className={inputClass("fuelType")}
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="GASOLINE">Gasolina</option>
                    <option value="ETHANOL">Etanol</option>
                    <option value="FLEX">Flex</option>
                    <option value="ELECTRIC">Elétrico</option>
                    <option value="HYBRID">Híbrido</option>
                    <option value="CNG">GNV</option>
                  </select>
                  {fieldErrors.fuelType ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.fuelType}</p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Filial (automatica)
                  </label>
                  <input
                    type="text"
                    value={form.vehicleId ? getBranchNameByVehicleId(form.vehicleId) : ""}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-700 outline-none"
                    placeholder="Selecione um veículo para identificar a filial"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Litros
                  </label>
                  <input
                    type="text"
                    value={form.liters}
                    onChange={(e) =>
                      handleChange(
                        "liters",
                        e.target.value.replace(/[^0-9,\\.]/g, "")
                      )
                    }
                    className={inputClass("liters")}
                    placeholder="0,00"
                  />
                  {fieldErrors.liters ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.liters}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Valor total
                  </label>
                  <input
                    type="text"
                    value={form.totalValue}
                    onChange={(e) =>
                      handleChange("totalValue", formatMoney(e.target.value))
                    }
                    className={inputClass("totalValue")}
                    placeholder="0,00"
                  />
                  {fieldErrors.totalValue ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.totalValue}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    KM
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.km}
                    onChange={(e) => handleChange("km", e.target.value)}
                    className={inputClass("km")}
                    placeholder="50000"
                  />
                  {fieldErrors.km ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.km}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Data
                  </label>
                  <input
                    type="date"
                    value={form.fuelDate}
                    onChange={(e) => handleChange("fuelDate", e.target.value)}
                    className={inputClass("fuelDate")}
                  />
                  {fieldErrors.fuelDate ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.fuelDate}</p>
                  ) : null}
                </div>
              </div>

              {formErrorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formErrorMessage}
                </div>
              )}

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
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving
                    ? "Salvando..."
                    : editingRecord
                      ? "Salvar alterações"
                      : "Cadastrar abastecimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {insights && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Comparacao entre veículos
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Custos e consumo medio por veículo.
            </p>
            <div className="mt-3 space-y-2">
              {insights.comparison.slice(0, 5).map((item) => (
                <div
                  key={item.vehicleId}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-slate-600">
                    {item.averageConsumptionKmPerLiter
                      ? `${item.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} km/L`
                      : "Sem consumo medio"}{" "}
                    •{" "}
                    {item.totalValue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div id="deteccao-anomalias" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Detecção de anomalias
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {detectedAnomalies.length} anomalia(s) detectada(s).
            </p>
            <div className="mt-3 space-y-2">
              {detectedAnomalies.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma anomalia no momento.
                </p>
              ) : (
                detectedAnomalies.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800"
                  >
                    <p className="font-semibold">{item.vehicle}</p>
                    <p>{item.reason}</p>
                    <p className="text-xs">
                      {formatLocalDate(item.date)} -{" "}
                      {item.driver}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConfirmAnomaly(item.id)}
                      className="btn-ui btn-ui-neutral mt-2"
                    >
                      Conferido
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(recordToDelete)}
        title="Excluir abastecimento"
        description={
          recordToDelete
            ? `Deseja excluir o abastecimento da filial ${getRecordBranchName(recordToDelete)}?`
            : ""
        }
        loading={deletingRecord}
        onCancel={() => setRecordToDelete(null)}
        onConfirm={confirmDeleteRecord}
      />
    </div>
  );
  function handleSort(column: FuelSortBy) {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection("asc");
  }

  function getSortArrow(column: FuelSortBy) {
    if (sortBy !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }
}
