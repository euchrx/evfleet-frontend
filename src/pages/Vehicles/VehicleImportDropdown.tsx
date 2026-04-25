import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import type { CreateVehicleInput } from "../../services/vehicles";

type VehicleImportPreviewRow = {
  rowNumber: number;
  payload: CreateVehicleInput;
  errors: string[];
};

type VehicleImportDropdownProps = {
  importing?: boolean;
  onImport: (vehicles: CreateVehicleInput[]) => Promise<void> | void;
};

const REQUIRED_HEADERS = [
  "PLACA",
  "MARCA",
  "MODELO",
  "ANO MODELO",
  "FIPE",
  "CHASSI",
  "RENAVAM",
  "TIPO DE CATEGORIA",
  "TIPO DE VEICULO",
  "CONFIG DOS EIXOS TRASEIROS",
  "QTD DE EIXOS",
  "COMBUSTIVEL",
  "TANQUE",
];

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function onlyDigits(value: unknown) {
  return normalizeText(value).replace(/\D/g, "");
}

function parseNumber(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;

  const normalized = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseYear(value: unknown) {
  const digits = onlyDigits(value).slice(0, 4);
  const year = Number(digits);
  return Number.isInteger(year) && year >= 1900 ? year : null;
}

function mapVehicleType(value: unknown): CreateVehicleInput["vehicleType"] | "" {
  const key = normalizeKey(value);
  if (key === "LEVE" || key === "LIGHT") return "LIGHT";
  if (key === "PESADO" || key === "HEAVY") return "HEAVY";
  return "";
}

function mapCategory(value: unknown): CreateVehicleInput["category"] | "" {
  const key = normalizeKey(value);

  if (["CARRO", "CAR", "AUTOMOVEL", "AUTOMÓVEL"].includes(key)) return "CAR";
  if (
    [
      "CAMINHAO",
      "CAMINHÃO",
      "TRUCK",
      "CAVALO",
      "CAVALO MECANICO",
      "CAVALO MECÂNICO",
    ].includes(key)
  ) {
    return "TRUCK";
  }
  if (["UTILITARIO", "UTILITÁRIO", "UTILITY"].includes(key)) return "UTILITY";
  if (
    [
      "IMPLEMENTO",
      "IMPLEMENT",
      "CARRETA",
      "REBOQUE",
      "SEMIRREBOQUE",
      "SEMI REBOQUE",
    ].includes(key)
  ) {
    return "IMPLEMENT";
  }

  return "";
}

function mapAxleConfiguration(
  value: unknown,
): CreateVehicleInput["axleConfiguration"] | undefined {
  const key = normalizeKey(value);

  if (!key || key === "-") return undefined;
  if (["SIMPLES", "SINGLE"].includes(key)) return "SINGLE";
  if (["DUPLO", "DUAL"].includes(key)) return "DUAL";

  return undefined;
}

function mapFuelType(value: unknown): CreateVehicleInput["fuelType"] | undefined {
  const key = normalizeKey(value);

  if (!key || key === "-") return undefined;
  if (["GASOLINA", "GASOLINE"].includes(key)) return "GASOLINE";
  if (["ETANOL", "ETHANOL", "ALCOOL", "ÁLCOOL"].includes(key)) return "ETHANOL";
  if (["DIESEL", "OLEO DIESEL", "ÓLEO DIESEL"].includes(key)) return "DIESEL";
  if (["ARLA", "ARLA32", "ARLA 32"].includes(key)) return "ARLA32";
  if (["FLEX"].includes(key)) return "FLEX";
  if (["ELETRICO", "ELÉTRICO", "ELECTRIC"].includes(key)) return "ELECTRIC";
  if (["HIBRIDO", "HÍBRIDO", "HYBRID"].includes(key)) return "HYBRID";
  if (["GNV", "CNG"].includes(key)) return "CNG";

  return undefined;
}

function getCellValue(row: Record<string, unknown>, header: string) {
  return row[normalizeKey(header)] ?? "";
}

function normalizeRowKeys(row: Record<string, unknown>) {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});
}

function parseVehicleRow(
  sourceRow: Record<string, unknown>,
  rowNumber: number,
): VehicleImportPreviewRow {
  const row = normalizeRowKeys(sourceRow);

  const plate = normalizeText(getCellValue(row, "PLACA"))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);

  const brand = normalizeText(getCellValue(row, "MARCA"));
  const model = normalizeText(getCellValue(row, "MODELO"));
  const year = parseYear(getCellValue(row, "ANO MODELO"));
  const fipeValue = parseNumber(getCellValue(row, "FIPE"));
  const chassis = normalizeText(getCellValue(row, "CHASSI")).toUpperCase();
  const renavam = onlyDigits(getCellValue(row, "RENAVAM"));
  const vehicleType = mapVehicleType(getCellValue(row, "TIPO DE CATEGORIA"));
  const category = mapCategory(getCellValue(row, "TIPO DE VEICULO"));
  const axleConfiguration = mapAxleConfiguration(
    getCellValue(row, "CONFIG DOS EIXOS TRASEIROS"),
  );
  const axleCount = parseNumber(getCellValue(row, "QTD DE EIXOS"));
  const fuelType = mapFuelType(getCellValue(row, "COMBUSTIVEL"));
  const tankCapacity = parseNumber(getCellValue(row, "TANQUE"));

  const payload: CreateVehicleInput = {
    plate,
    brand,
    model,
    year: year || new Date().getFullYear(),
    fipeValue: fipeValue ?? null,
    chassis,
    renavam,
    vehicleType: vehicleType || "HEAVY",
    category: category || "TRUCK",
    status: "ACTIVE",
    photoUrls: [],
    documentUrls: [],
  };

  if (typeof axleCount === "number" && Number.isFinite(axleCount)) {
    payload.axleCount = axleCount;
  }

  if (category === "TRUCK" && axleConfiguration) {
    payload.axleConfiguration = axleConfiguration;
  }

  if (category !== "IMPLEMENT" && fuelType) {
    payload.fuelType = fuelType;
  }

  if (category !== "IMPLEMENT") {
    payload.tankCapacity = tankCapacity;
  }

  const errors: string[] = [];

  if (!plate) errors.push("Placa obrigatória.");
  if (!brand) errors.push("Marca obrigatória.");
  if (!model) errors.push("Modelo obrigatório.");
  if (!year) errors.push("Ano modelo inválido.");
  if (!vehicleType) errors.push("Tipo de categoria inválido.");
  if (!category) errors.push("Tipo de veículo inválido.");
  if (!chassis) errors.push("Chassi obrigatório.");
  if (!renavam) errors.push("Renavam obrigatório.");

  if (category === "TRUCK" && !axleConfiguration) {
    errors.push("Configuração dos eixos obrigatória para caminhão.");
  }

  if ((category === "TRUCK" || category === "IMPLEMENT") && !axleCount) {
    errors.push("Quantidade de eixos obrigatória.");
  }

  if (category !== "IMPLEMENT" && !fuelType) {
    errors.push("Combustível obrigatório para veículo.");
  }

  if (category !== "IMPLEMENT" && (!tankCapacity || tankCapacity <= 0)) {
    errors.push("Tanque obrigatório para veículo.");
  }

  return { rowNumber, payload, errors };
}

function readVehiclesFromExcel(file: File): Promise<VehicleImportPreviewRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));

    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          resolve([]);
          return;
        }

        const worksheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          range: 1,
        });

        resolve(rows.map((row, index) => parseVehicleRow(row, index + 3)));
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

export function VehicleImportDropdown({
  importing = false,
  onImport,
}: VehicleImportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [rows, setRows] = useState<VehicleImportPreviewRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows]);
  const invalidRows = useMemo(() => rows.filter((row) => row.errors.length > 0), [rows]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setModalOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function resetImportState() {
    setSelectedFileName("");
    setRows([]);
    setErrorMessage("");
  }

  function openXlsxModal() {
    setOpen(false);
    setModalOpen(true);
    resetImportState();
  }

  function closeModal() {
    if (importing) return;
    setModalOpen(false);
    resetImportState();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");

    if (!isXlsx) {
      setRows([]);
      setSelectedFileName("");
      setErrorMessage("Selecione uma planilha no formato .xlsx.");
      return;
    }

    try {
      setErrorMessage("");
      setSelectedFileName(file.name);

      const parsedRows = await readVehiclesFromExcel(file);
      const withoutEmptyRows = parsedRows.filter((row) => {
        const plate = row.payload.plate.trim().toUpperCase();
        const brand = row.payload.brand.trim().toUpperCase();
        const model = row.payload.model.trim().toUpperCase();

        const isEmptyRow = !plate && !brand && !model;

        const isTotalRow =
          plate.startsWith("TOTAL") ||
          brand.startsWith("TOTAL") ||
          model.startsWith("TOTAL");

        return !isEmptyRow && !isTotalRow;
      });

      setRows(withoutEmptyRows);

      if (withoutEmptyRows.length === 0) {
        setErrorMessage("Nenhum veículo encontrado na planilha.");
      }
    } catch (error) {
      console.error("Erro ao importar veículos:", error);
      setRows([]);
      setSelectedFileName("");
      setErrorMessage("Não foi possível processar a planilha enviada.");
    }
  }

  async function handleConfirmImport() {
    if (validRows.length === 0 || invalidRows.length > 0 || importing) return;

    await onImport(validRows.map((row) => row.payload));

    setModalOpen(false);
    resetImportState();
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 sm:w-auto"
        >
          <FileSpreadsheet size={16} />
          Importar
        </button>

        {open ? (
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:left-auto">
            <button
              type="button"
              onClick={openXlsxModal}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" />
              XLSX
            </button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
          <div className="relative mx-auto my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl md:my-8">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Importar veículos via XLSX
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Anexe a planilha de veículos para validar os dados antes de importar.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={importing}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Estrutura esperada da planilha
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  A primeira aba do arquivo deve conter os veículos com as colunas:
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {REQUIRED_HEADERS.map((header) => (
                    <span
                      key={header}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      {header}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Arquivo XLSX
                </label>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex min-h-[48px] w-full cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="truncate">
                    {selectedFileName || "Selecionar arquivo .xlsx"}
                  </span>
                  <Upload size={16} className="shrink-0 text-slate-500" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <p className="mt-2 text-xs text-slate-500">
                  Somente arquivos no formato .xlsx são aceitos.
                </p>
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              {rows.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {rows.length} linha(s)
                    </span>
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {validRows.length} válida(s)
                    </span>
                    <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                      {invalidRows.length} com erro
                    </span>
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {rows.slice(0, 20).map((row) => (
                      <div
                        key={row.rowNumber}
                        className="border-b border-slate-100 px-3 py-2 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            Linha {row.rowNumber}: {row.payload.plate || "-"} —{" "}
                            {row.payload.brand || "-"} {row.payload.model || ""}
                          </p>

                          <span
                            className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${row.errors.length
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                              }`}
                          >
                            {row.errors.length ? "Erro" : "OK"}
                          </span>
                        </div>

                        {row.errors.length > 0 ? (
                          <p className="mt-1 text-xs text-red-600">
                            {row.errors.join(" ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {rows.length > 20 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Exibindo as primeiras 20 linhas da planilha.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={importing}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={importing || validRows.length === 0 || invalidRows.length > 0}
                onClick={handleConfirmImport}
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? "Importando..." : `Importar ${validRows.length}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}