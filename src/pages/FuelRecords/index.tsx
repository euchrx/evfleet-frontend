import { useEffect, useMemo, useState } from "react";
import type { Vehicle } from "../../types/vehicle";
import { useRef } from "react";
import type { ChangeEvent } from "react";
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
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import { useLocation } from "react-router-dom";
import { AlertTriangle, CarFront, FileSpreadsheet, Gauge } from "lucide-react";
import * as XLSX from "xlsx";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { TablePagination } from "../../components/TablePagination";
import { resolveLatestVehicleKmMap } from "../../utils/vehicle-km";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type FuelFormData = {
  liters: string;
  totalValue: string;
  km: string;
  fuelDate: string;
  fuelType: "" | "GASOLINE" | "ETHANOL" | "DIESEL" | "FLEX" | "ELECTRIC" | "HYBRID" | "CNG";
  vehicleId: string;
  driverId: string;
};

type FuelFieldErrors = Partial<Record<keyof FuelFormData, string>>;

const initialForm: FuelFormData = {
  liters: "",
  totalValue: "",
  km: "",
  fuelDate: "",
  fuelType: "",
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
  const raw = String(dateValue || "").trim();
  if (!raw) return "-";

  const isoMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (isoMatch) {
    const day = isoMatch[3];
    const month = isoMatch[2];
    const year = isoMatch[1];
    const hour = isoMatch[4] || "00";
    const minute = isoMatch[5] || "00";
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const brMatch = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (brMatch) {
    const day = brMatch[1];
    const month = brMatch[2];
    const year = brMatch[3];
    const hour = brMatch[4] || "00";
    const minute = brMatch[5] || "00";
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return "-";
  return fallback.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeHeader(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizePlate(value: unknown) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function extractPlateCandidate(value: unknown) {
  const text = String(value || "").toUpperCase();
  if (!text.trim()) return "";

  const compact = text.replace(/[^A-Z0-9]/g, "");

  const mercosul = compact.match(/[A-Z]{3}[0-9][A-Z][0-9]{2}/);
  if (mercosul) return mercosul[0];

  const antigo = compact.match(/[A-Z]{3}[0-9]{4}/);
  if (antigo) return antigo[0];

  return compact;
}

function findVehicleByPlateCandidate(vehicles: Vehicle[], candidate: string) {
  const normalizedCandidate = normalizePlate(candidate);
  if (!normalizedCandidate) return undefined;

  return vehicles.find((item) => {
    const normalizedVehiclePlate = normalizePlate(item.plate);
    if (!normalizedVehiclePlate) return false;
    return (
      normalizedVehiclePlate === normalizedCandidate ||
      normalizedVehiclePlate.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedVehiclePlate)
    );
  });
}

function parseNumberValue(value: unknown) {
  if (typeof value === "number") return value;
  const normalized = String(value || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseFuelDateValue(dateValue: unknown, timeValue?: unknown) {
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const y = dateValue.getFullYear();
    const m = String(dateValue.getMonth() + 1).padStart(2, "0");
    const d = String(dateValue.getDate()).padStart(2, "0");
    const { hour, minute } = parseTimeParts(timeValue);
    return `${y}-${m}-${d}T${hour}:${minute}:00`;
  }

  if (typeof dateValue === "number") {
    const parsed = XLSX.SSF.parse_date_code(dateValue);
    if (parsed) {
      const y = String(parsed.y).padStart(4, "0");
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      const { hour, minute } = parseTimeParts(timeValue);
      return `${y}-${m}-${d}T${hour}:${minute}:00`;
    }
  }

  const text = String(dateValue || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const { hour, minute } = parseTimeParts(timeValue);
    return `${text}T${hour}:${minute}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text)) {
    const normalized = text.replace(" ", "T");
    return normalized.length === 16 ? `${normalized}:00` : normalized;
  }

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const { hour, minute } = parseTimeParts(timeValue);
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T${hour}:${minute}:00`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const { hour, minute } = parseTimeParts(timeValue);
  return `${y}-${m}-${d}T${hour}:${minute}:00`;
}

function parseTimeParts(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      hour: String(value.getHours()).padStart(2, "0"),
      minute: String(value.getMinutes()).padStart(2, "0"),
    };
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return {
        hour: String(parsed.H || 0).padStart(2, "0"),
        minute: String(parsed.M || 0).padStart(2, "0"),
      };
    }
  }
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    return {
      hour: String(Number(match[1])).padStart(2, "0"),
      minute: match[2],
    };
  }
  return { hour: "00", minute: "00" };
}

function toDateTimeLocalInput(value?: string) {
  if (!value) return "";
  const raw = String(value).trim();
  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (iso) {
    const hh = iso[4] || "00";
    const mm = iso[5] || "00";
    return `${iso[1]}-${iso[2]}-${iso[3]}T${hh}:${mm}`;
  }
  const br = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/,
  );
  if (br) {
    const hh = br[4] || "00";
    const mm = br[5] || "00";
    return `${br[3]}-${br[2]}-${br[1]}T${hh}:${mm}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function mapFuelType(value: unknown): FuelFormData["fuelType"] {
  const text = normalizeHeader(value);
  if (!text) return "";
  if (text.includes("diesel")) return "DIESEL";
  if (text.includes("gasolina")) return "GASOLINE";
  if (text.includes("etanol") || text.includes("alcool")) return "ETHANOL";
  if (text.includes("flex")) return "FLEX";
  if (text.includes("eletric")) return "ELECTRIC";
  if (text.includes("hibrid")) return "HYBRID";
  if (text.includes("gnv") || text.includes("cng")) return "CNG";
  return "";
}

export function FuelRecordsPage() {
  const location = useLocation();
  const { selectedBranchId, branches } = useBranch();
  const { selectedCompanyId } = useCompanyScope();
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
  const [fieldErrors, setFieldErrors] = useState<FuelFieldErrors>({});
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<FuelSortBy>("vehicle");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FuelRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [importingXls, setImportingXls] = useState(false);
  const [form, setForm] = useState<FuelFormData>(initialForm);
  const [anomalyRefreshSeed, setAnomalyRefreshSeed] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
  }, [selectedCompanyId]);

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
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(record: FuelRecord) {
    setEditingRecord(record);
    setForm({
      liters: String(record.liters).replace(".", ","),
      totalValue: String(record.totalValue).replace(".", ","),
      km: String(record.km),
      fuelDate: toDateTimeLocalInput(record.fuelDate),
      fuelType: record.fuelType || "DIESEL",
      vehicleId: record.vehicleId,
      driverId: record.driverId || "",
    });
    setFieldErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingRecord(null);
    setForm(initialForm);
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
      if (!payload.fuelType) nextErrors.fuelType = "Selecione o combustível.";
      if (!payload.fuelDate) nextErrors.fuelDate = "Informe data e hora.";
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
        fuelType: payload.fuelType as Exclude<FuelFormData["fuelType"], "">,
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
        setFieldErrors((prev) => ({ ...prev, liters: apiMessage.join(", ") }));
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

      if (!apiText.trim()) {
        setFieldErrors((prev) => ({ ...prev, liters: "Não foi possível salvar. Revise os campos." }));
      }
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

  function openImportXlsPicker() {
    if (importingXls) return;
    importInputRef.current?.click();
  }

  async function handleImportXls(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingXls(true);
      setPageErrorMessage("");

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setPageErrorMessage("Arquivo XLS sem planilhas válidas.");
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
      });

      if (matrix.length === 0) {
        setPageErrorMessage("Nenhuma linha encontrada no arquivo XLS.");
        return;
      }

      const detectedHeaderIndex = matrix.findIndex((row) => {
        const normalized = row.map((cell) => normalizeHeader(cell));
        return (
          normalized.includes("hora") &&
          normalized.includes("placa") &&
          (normalized.includes("odometro") || normalized.includes("odometro"))
        );
      });

      let rows: Array<Record<string, unknown>> = [];

      if (detectedHeaderIndex >= 0) {
        const headerRow = matrix[detectedHeaderIndex];
        const indexByHeader = new Map<string, number>();
        headerRow.forEach((cell, cellIndex) => {
          const key = normalizeHeader(cell);
          if (!key) return;
          indexByHeader.set(key, cellIndex);
        });

        const hourIndex = indexByHeader.get("hora") ?? -1;
        const dateHeaderIndex = indexByHeader.get("data") ?? -1;
        let inferredDateIndex = dateHeaderIndex;
        if (inferredDateIndex < 0 && hourIndex >= 0) {
          const sampleDataRow = matrix[detectedHeaderIndex + 1] || [];
          for (let i = 0; i < hourIndex; i += 1) {
            if (String(sampleDataRow[i] || "").trim()) {
              inferredDateIndex = i;
              break;
            }
          }
        }

        rows = matrix
          .slice(detectedHeaderIndex + 1)
          .map((row, rowIndex) => ({ row, rowIndex }))
          .filter(({ row }) =>
            row.some((cell) => String(cell || "").trim().length > 0),
          )
          .map(({ row, rowIndex }) => ({
            __line: detectedHeaderIndex + 2 + rowIndex,
            data:
              inferredDateIndex >= 0
                ? row[inferredDateIndex]
                : "",
            hora: hourIndex >= 0 ? row[hourIndex] : "",
            nota:
              (indexByHeader.get("nota") ?? -1) >= 0
                ? row[indexByHeader.get("nota") as number]
                : "",
            nome:
              (indexByHeader.get("nome") ?? -1) >= 0
                ? row[indexByHeader.get("nome") as number]
                : "",
            valor:
              (indexByHeader.get("valor") ?? -1) >= 0
                ? row[indexByHeader.get("valor") as number]
                : "",
            litros:
              (indexByHeader.get("litros") ?? -1) >= 0
                ? row[indexByHeader.get("litros") as number]
                : "",
            motorista:
              (indexByHeader.get("motorista") ?? -1) >= 0
                ? row[indexByHeader.get("motorista") as number]
                : "",
            placa:
              (indexByHeader.get("placa") ?? -1) >= 0
                ? row[indexByHeader.get("placa") as number]
                : "",
            odometro:
              (indexByHeader.get("odometro") ?? -1) >= 0
                ? row[indexByHeader.get("odometro") as number]
                : "",
          }));
      } else {
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        }).map((row, rowIndex) => ({ ...row, __line: rowIndex + 2 }));
      }

      if (rows.length === 0) {
        setPageErrorMessage("Nenhum registro válido encontrado no arquivo XLS.");
        return;
      }

      let createdCount = 0;
      const failures: string[] = [];
      const missingPlates = new Set<string>();
      const vehiclesByPlate = new Map(
        vehicles.map((item) => [normalizePlate(item.plate), item]),
      );

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const lineNumber = Number(row.__line) || index + 2;
        const rowMap = new Map<string, unknown>();
        for (const [key, value] of Object.entries(row)) {
          rowMap.set(normalizeHeader(key), value);
        }

        const plateRaw =
          rowMap.get("placa") ||
          rowMap.get("veiculo") ||
          rowMap.get("veiculoid") ||
          rowMap.get("vehicle") ||
          rowMap.get("carro");
        const plate = extractPlateCandidate(plateRaw);

        let fallbackDetectedPlate = "";
        if (!plate) {
          for (const value of rowMap.values()) {
            const candidate = extractPlateCandidate(value);
            if (candidate.length >= 7) {
              fallbackDetectedPlate = candidate;
              break;
            }
          }
        }
        const normalizedPlate = normalizePlate(plate || fallbackDetectedPlate);

        const vehicle =
          vehiclesByPlate.get(normalizedPlate) ||
          findVehicleByPlateCandidate(vehicles, normalizedPlate) ||
          vehicles.find((item) =>
            formatVehicleLabel(item)
              .toUpperCase()
              .includes((plate || fallbackDetectedPlate).toUpperCase()),
          );

        if (!vehicle) {
          if (normalizedPlate) missingPlates.add(normalizedPlate);
          failures.push(`Linha ${lineNumber}: veículo/placa não encontrado.`);
          continue;
        }

        const driverNameRaw =
          rowMap.get("motorista") || rowMap.get("driver") || rowMap.get("condutor");
        const driverName = String(driverNameRaw || "").trim();
        const driver = driverName
          ? drivers.find(
              (item) =>
                item.name.trim().toLowerCase() === driverName.toLowerCase(),
            )
          : null;

        const liters = parseNumberValue(
          rowMap.get("litros") || rowMap.get("litro"),
        );
        const totalValue = parseNumberValue(
          rowMap.get("valortotal") ||
            rowMap.get("valor") ||
            rowMap.get("total") ||
            rowMap.get("valorabastecido"),
        );
        const km = parseNumberValue(
          rowMap.get("km") ||
            rowMap.get("odometro") ||
            rowMap.get("quilometragem"),
        );
        const fuelDate = parseFuelDateValue(
          rowMap.get("data") || rowMap.get("fueldate") || rowMap.get("dataabastecimento"),
          rowMap.get("hora"),
        );
        const fuelType = mapFuelType(
          rowMap.get("combustivel") || rowMap.get("tipocombustivel") || rowMap.get("fueltype"),
        ) || (vehicle.fuelType as FuelFormData["fuelType"]);

        if (!fuelType) {
          failures.push(`Linha ${lineNumber}: combustível inválido.`);
          continue;
        }
        if (!fuelDate) {
          failures.push(`Linha ${lineNumber}: data inválida.`);
          continue;
        }
        if (Number.isNaN(liters) || liters <= 0) {
          failures.push(`Linha ${lineNumber}: litros inválidos.`);
          continue;
        }
        if (Number.isNaN(totalValue) || totalValue <= 0) {
          failures.push(`Linha ${lineNumber}: valor total inválido.`);
          continue;
        }
        if (Number.isNaN(km) || km < 0) {
          failures.push(`Linha ${lineNumber}: KM inválido.`);
          continue;
        }

        try {
          await createFuelRecord({
            liters,
            totalValue,
            km,
            fuelDate,
            fuelType,
            vehicleId: vehicle.id,
            driverId: driver?.id || null,
            station:
              String(rowMap.get("nome") || "").trim() || getBranchNameByVehicleId(vehicle.id),
          });
          createdCount += 1;
        } catch (error: any) {
          const apiMessage =
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            "falha ao importar";
          const text = Array.isArray(apiMessage)
            ? apiMessage.join(", ")
            : String(apiMessage);
          failures.push(`Linha ${lineNumber}: ${text}`);
        }
      }

      await loadData();
      notifyHeaderNotifications();

      if (createdCount > 0 && failures.length === 0) {
        setPageErrorMessage(
          `Importação concluída com sucesso. ${createdCount} abastecimento(s) cadastrado(s).`,
        );
        return;
      }

      if (createdCount > 0 && failures.length > 0) {
        setPageErrorMessage(
          `Importação parcial. Sucesso: ${createdCount}. Falhas: ${failures.length}. ${failures
            .slice(0, 3)
            .join(" | ")}`,
        );
        return;
      }

      if (createdCount === 0 && missingPlates.size > 0) {
        setPageErrorMessage(
          `Nenhum abastecimento importado. Placas não encontradas no cadastro da empresa atual: ${[...missingPlates]
            .slice(0, 5)
            .join(", ")}.`,
        );
        return;
      }

      setPageErrorMessage(
        `Nenhum abastecimento importado. ${failures.slice(0, 3).join(" | ")}`,
      );
    } catch (error) {
      console.error("Erro ao importar XLS:", error);
      setPageErrorMessage("Não foi possível processar o arquivo XLS.");
    } finally {
      setImportingXls(false);
      if (importInputRef.current) importInputRef.current.value = "";
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

  const latestDriverIdByVehicle = useMemo(() => {
    const sortedByNewest = [...records].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.fuelDate).getTime();
      const bTime = new Date(b.createdAt || b.fuelDate).getTime();
      return bTime - aTime;
    });

    const map = new Map<string, string>();
    for (const record of sortedByNewest) {
      if (!record.driverId || !record.vehicleId) continue;
      if (map.has(record.vehicleId)) continue;

      const driver = drivers.find((item) => item.id === record.driverId);
      if (!driver || driver.status !== "ACTIVE") continue;

      map.set(record.vehicleId, record.driverId);
    }

    return map;
  }, [records, drivers]);

  function handleVehicleChange(vehicleId: string) {
    if (editingRecord) {
      handleChange("vehicleId", vehicleId);
      return;
    }
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    const latestKm = latestKmByVehicle.get(vehicleId);
    const latestDriverId = latestDriverIdByVehicle.get(vehicleId) || "";
    setForm((prev) => ({
      ...prev,
      vehicleId,
      km: typeof latestKm === "number" ? String(latestKm) : "",
      fuelType: selectedVehicle?.fuelType || prev.fuelType,
      driverId: latestDriverId,
    }));
    setFieldErrors((prev) => ({ ...prev, vehicleId: undefined, km: undefined, driverId: undefined }));
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
            record.vehicle ? formatVehicleLabel(record.vehicle) : "",
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
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Abastecimentos</h1>
          <p className="text-sm text-slate-500">
            Gerencie os registros de abastecimento da frota
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={openImportXlsPicker}
            disabled={importingXls}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            <FileSpreadsheet size={16} />
            {importingXls ? "Importando..." : "Importar XLS"}
          </button>
          <button
            onClick={openCreateModal}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:w-auto"
          >
            + Cadastrar abastecimento
          </button>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={handleImportXls}
      />

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
                  <button type="button" onClick={() => handleSort("fuelDate")} className="cursor-pointer">Data e Hora {getSortArrow("fuelDate")}</button>
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
                      {record.vehicle ? formatVehicleLabel(record.vehicle) : record.vehicleId}
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
                        {formatVehicleLabel(vehicle)}
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
                    <option value="">Selecione um combustível</option>
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
                    Data e Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={form.fuelDate}
                    onChange={(e) => handleChange("fuelDate", e.target.value)}
                    className={inputClass("fuelDate")}
                  />
                  {fieldErrors.fuelDate ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.fuelDate}</p>
                  ) : null}
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Comparação entre veículos
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Custos e eficiência de consumo por veículo.
                </p>
              </div>
              <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                <CarFront size={16} />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {insights.comparison.slice(0, 5).map((item) => (
                <div
                  key={item.vehicleId}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      <Gauge size={12} />
                      {item.averageConsumptionKmPerLiter
                        ? `${item.averageConsumptionKmPerLiter.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} km/L`
                        : "Sem consumo médio"}
                    </span>
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {item.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="deteccao-anomalias" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Detecção de anomalias
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {detectedAnomalies.length} anomalia(s) detectada(s).
                </p>
              </div>
              <div className="rounded-xl bg-orange-100 p-2 text-orange-700">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {detectedAnomalies.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Nenhuma anomalia no momento.
                </div>
              ) : (
                detectedAnomalies.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800"
                  >
                    <p className="font-semibold">{item.vehicle}</p>
                    <p className="mt-1">{item.reason}</p>
                    <p className="mt-1 text-xs">
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
