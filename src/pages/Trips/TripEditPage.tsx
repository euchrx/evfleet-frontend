import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTrip, updateTrip } from "../../services/trips";
import { getVehicles } from "../../services/vehicles";
import { getDrivers } from "../../services/drivers";
import { useBranch } from "../../contexts/BranchContext";
import { useStatusToast } from "../../contexts/StatusToastContext";
import type { Trip } from "../../types/trip";
import type { Vehicle } from "../../types/vehicle";
import type { Driver } from "../../types/driver";
import { formatVehicleLabel } from "../../utils/vehicleLabel";

type TripFiscalForm = {
  vehicleId: string;
  driverId: string;
  origin: string;
  destination: string;
  reason: string;
  departureKm: string;
  returnKm: string;
  departureAt: string;
  returnAt: string;
  notes: string;

  originState: string;
  originCityName: string;
  originCityIbgeCode: string;
  originZipCode: string;

  destinationState: string;
  destinationCityName: string;
  destinationCityIbgeCode: string;
  destinationZipCode: string;

  cargoDescription: string;
  cargoNcm: string;
  cargoValue: string;
  cargoQuantity: string;
  cargoUnit: "KG" | "TON";

  contractorName: string;
  contractorDocument: string;
  paymentIndicator: "PAID" | "UNPAID";
  paymentValue: string;
  paymentPixKey: string;

  insuranceCompanyName: string;
  insuranceCompanyDocument: string;
  insurancePolicyNumber: string;
  insuranceEndorsement: string;
};

type FieldErrors = Partial<Record<keyof TripFiscalForm, string>>;

const emptyForm: TripFiscalForm = {
  vehicleId: "",
  driverId: "",
  origin: "",
  destination: "",
  reason: "",
  departureKm: "",
  returnKm: "",
  departureAt: "",
  returnAt: "",
  notes: "",

  originState: "",
  originCityName: "",
  originCityIbgeCode: "",
  originZipCode: "",

  destinationState: "",
  destinationCityName: "",
  destinationCityIbgeCode: "",
  destinationZipCode: "",

  cargoDescription: "",
  cargoNcm: "",
  cargoValue: "",
  cargoQuantity: "",
  cargoUnit: "KG",

  contractorName: "",
  contractorDocument: "",
  paymentIndicator: "UNPAID",
  paymentValue: "",
  paymentPixKey: "",

  insuranceCompanyName: "",
  insuranceCompanyDocument: "",
  insurancePolicyNumber: "",
  insuranceEndorsement: "",
};

const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function toInputDateTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toStringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value: string) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: string) {
  const trimmed = String(value || "").replace(",", ".").trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getApiErrorMessage(error: any) {
  const response = error?.response?.data;

  if (Array.isArray(response?.errors)) {
    return [
      response.message || "Existem pendências para salvar a viagem.",
      ...response.errors.map((item: string) => `• ${item}`),
    ].join("\n");
  }

  if (Array.isArray(response?.message)) {
    return response.message.join("\n");
  }

  return (
    response?.message || error?.message || "Não foi possível concluir a operação."
  );
}

function buildFormFromTrip(trip: Trip): TripFiscalForm {
  return {
    vehicleId: trip.vehicleId || "",
    driverId: trip.driverId || "",
    origin: trip.origin || "",
    destination: trip.destination || "",
    reason: trip.reason || "",
    departureKm: toStringValue(trip.departureKm),
    returnKm: toStringValue(trip.returnKm),
    departureAt: toInputDateTime(trip.departureAt),
    returnAt: toInputDateTime(trip.returnAt),
    notes: trip.notes || "",

    originState: trip.originState || "",
    originCityName: trip.originCityName || "",
    originCityIbgeCode: trip.originCityIbgeCode || "",
    originZipCode: trip.originZipCode || "",

    destinationState: trip.destinationState || "",
    destinationCityName: trip.destinationCityName || "",
    destinationCityIbgeCode: trip.destinationCityIbgeCode || "",
    destinationZipCode: trip.destinationZipCode || "",

    cargoDescription: trip.cargoDescription || "",
    cargoNcm: trip.cargoNcm || "",
    cargoValue: toStringValue(trip.cargoValue),
    cargoQuantity: toStringValue(trip.cargoQuantity),
    cargoUnit: trip.cargoUnit || "KG",

    contractorName: trip.contractorName || "",
    contractorDocument: trip.contractorDocument || "",
    paymentIndicator: trip.paymentIndicator || "UNPAID",
    paymentValue: toStringValue(trip.paymentValue),
    paymentPixKey: trip.paymentPixKey || "",

    insuranceCompanyName: trip.insuranceCompanyName || "",
    insuranceCompanyDocument: trip.insuranceCompanyDocument || "",
    insurancePolicyNumber: trip.insurancePolicyNumber || "",
    insuranceEndorsement: trip.insuranceEndorsement || "",
  };
}

function validateForm(form: TripFiscalForm) {
  const errors: FieldErrors = {};

  if (!form.vehicleId) errors.vehicleId = "Selecione o veículo.";
  if (!form.origin.trim()) errors.origin = "Informe a origem.";
  if (!form.destination.trim()) errors.destination = "Informe o destino.";
  if (!form.departureKm || Number(form.departureKm) < 0) {
    errors.departureKm = "Informe a quilometragem inicial.";
  }
  if (!form.departureAt) errors.departureAt = "Informe a data de saída.";

  if (!form.originState) errors.originState = "Informe a UF de origem.";
  if (!form.originCityName.trim()) errors.originCityName = "Informe a cidade de origem.";
  if (!form.originCityIbgeCode.trim()) {
    errors.originCityIbgeCode = "Informe o código IBGE de origem.";
  }

  if (!form.destinationState) errors.destinationState = "Informe a UF de destino.";
  if (!form.destinationCityName.trim()) {
    errors.destinationCityName = "Informe a cidade de destino.";
  }
  if (!form.destinationCityIbgeCode.trim()) {
    errors.destinationCityIbgeCode = "Informe o código IBGE de destino.";
  }

  if (!form.cargoNcm.trim()) errors.cargoNcm = "Informe o NCM predominante.";
  if (!normalizeNumber(form.cargoValue) || Number(normalizeNumber(form.cargoValue)) <= 0) {
    errors.cargoValue = "Informe o valor total da carga.";
  }
  if (!normalizeNumber(form.cargoQuantity) || Number(normalizeNumber(form.cargoQuantity)) <= 0) {
    errors.cargoQuantity = "Informe a quantidade total da carga.";
  }

  if (!normalizeNumber(form.paymentValue) || Number(normalizeNumber(form.paymentValue)) <= 0) {
    errors.paymentValue = "Informe o valor do frete/pagamento.";
  }

  if (!form.insuranceCompanyName.trim()) {
    errors.insuranceCompanyName = "Informe a seguradora.";
  }
  if (!form.insuranceCompanyDocument.trim()) {
    errors.insuranceCompanyDocument = "Informe o documento da seguradora.";
  }
  if (!form.insurancePolicyNumber.trim()) {
    errors.insurancePolicyNumber = "Informe a apólice.";
  }

  return errors;
}

export function TripEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedBranchId } = useBranch();
  const { showToast } = useStatusToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<TripFiscalForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadPageData() {
    if (!id) return;

    try {
      setLoading(true);
      setPageErrorMessage("");

      const [tripData, vehiclesData, driversData] = await Promise.all([
        getTrip(id),
        getVehicles(),
        getDrivers(),
      ]);

      setTrip(tripData);
      setForm(buildFormFromTrip(tripData));
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
    } catch (error) {
      console.error("Erro ao carregar edição da viagem:", error);
      setPageErrorMessage("Não foi possível carregar a viagem para edição.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, [id]);

  useEffect(() => {
    if (!pageErrorMessage) return;

    showToast({
      tone: "error",
      title: "Atenção",
      message: pageErrorMessage,
    });

    setPageErrorMessage("");
  }, [pageErrorMessage, showToast]);

  const availableVehicles = useMemo(() => {
    let filtered = vehicles.filter((item) => item.category !== "IMPLEMENT");

    if (selectedBranchId) {
      filtered = filtered.filter((item) => item.branchId === selectedBranchId);
    }

    return [...filtered].sort((a, b) =>
      a.plate.localeCompare(b.plate, "pt-BR", { sensitivity: "base" }),
    );
  }, [vehicles, selectedBranchId]);

  const availableDrivers = useMemo(() => {
    let filtered = drivers;

    if (selectedBranchId) {
      filtered = filtered.filter(
        (driver) => !driver.vehicle || driver.vehicle.branchId === selectedBranchId,
      );
    }

    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [drivers, selectedBranchId]);

  function updateField<K extends keyof TripFiscalForm>(key: K, value: TripFiscalForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSave() {
    if (!id) return;

    const errors = validateForm(form);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      showToast({
        tone: "error",
        title: "Dados incompletos",
        message: "Revise os campos destacados antes de salvar.",
      });
      return;
    }

    try {
      setSaving(true);
      setPageErrorMessage("");

      await updateTrip(id, {
        vehicleId: form.vehicleId,
        driverId: form.driverId || null,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        reason: normalizeText(form.reason),
        departureKm: Number(form.departureKm),
        returnKm: normalizeNumber(form.returnKm),
        departureAt: new Date(form.departureAt).toISOString(),
        returnAt: form.returnAt ? new Date(form.returnAt).toISOString() : null,
        notes: normalizeText(form.notes),

        originState: normalizeText(form.originState),
        originCityName: normalizeText(form.originCityName),
        originCityIbgeCode: normalizeText(form.originCityIbgeCode),
        originZipCode: normalizeText(form.originZipCode),

        destinationState: normalizeText(form.destinationState),
        destinationCityName: normalizeText(form.destinationCityName),
        destinationCityIbgeCode: normalizeText(form.destinationCityIbgeCode),
        destinationZipCode: normalizeText(form.destinationZipCode),

        cargoDescription: normalizeText(form.cargoDescription),
        cargoNcm: normalizeText(form.cargoNcm),
        cargoValue: normalizeNumber(form.cargoValue),
        cargoQuantity: normalizeNumber(form.cargoQuantity),
        cargoUnit: form.cargoUnit,

        contractorName: normalizeText(form.contractorName),
        contractorDocument: normalizeText(form.contractorDocument),
        paymentIndicator: form.paymentIndicator,
        paymentValue: normalizeNumber(form.paymentValue),
        paymentPixKey: normalizeText(form.paymentPixKey),

        insuranceCompanyName: normalizeText(form.insuranceCompanyName),
        insuranceCompanyDocument: normalizeText(form.insuranceCompanyDocument),
        insurancePolicyNumber: normalizeText(form.insurancePolicyNumber),
        insuranceEndorsement: normalizeText(form.insuranceEndorsement),
      });

      showToast({
        tone: "success",
        title: "Viagem atualizada",
        message: "Os dados operacionais e fiscais foram salvos com sucesso.",
      });

      navigate(`/trips/${id}`);
    } catch (error: any) {
      console.error("Erro ao salvar viagem:", error);
      setPageErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const lockedByMdfe = Boolean(
    trip?.mdfe && ["AUTHORIZED", "CLOSED", "CANCELED"].includes(trip.mdfe.status),
  );

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          Viagem não encontrada.
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to={`/trips/${trip.id}`}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Voltar para a viagem
        </Link>

        <p className="text-xs font-medium text-slate-500">
          Viagem ID: <span className="font-semibold text-slate-700">{trip.id}</span>
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Edição fiscal MDF-e
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {trip.origin} → {trip.destination}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Revise os dados operacionais e fiscais antes de emitir o MDF-e.
          </p>
        </div>

        {lockedByMdfe ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-800">
            Esta viagem possui MDF-e {trip.mdfe?.status}. Por segurança, os dados fiscais não devem ser alterados após autorização/encerramento/cancelamento.
          </div>
        ) : null}

        <div className="space-y-6 p-5">
          <FormSection
            title="Dados operacionais"
            description="Veículo, motorista, origem, destino e datas da viagem."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <SelectField
                label="Veículo de tração"
                value={form.vehicleId}
                onChange={(value) => updateField("vehicleId", value)}
                error={fieldErrors.vehicleId}
                disabled={saving || lockedByMdfe}
              >
                <option value="">Selecione o veículo</option>
                {availableVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {formatVehicleLabel(vehicle)}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Motorista"
                value={form.driverId}
                onChange={(value) => updateField("driverId", value)}
                disabled={saving || lockedByMdfe}
              >
                <option value="">Sem motorista</option>
                {availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TextField
                label="Origem"
                value={form.origin}
                onChange={(value) => updateField("origin", value)}
                error={fieldErrors.origin}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Destino"
                value={form.destination}
                onChange={(value) => updateField("destination", value)}
                error={fieldErrors.destination}
                disabled={saving || lockedByMdfe}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TextField
                label="KM saída"
                type="number"
                value={form.departureKm}
                onChange={(value) => updateField("departureKm", value)}
                error={fieldErrors.departureKm}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="KM retorno"
                type="number"
                value={form.returnKm}
                onChange={(value) => updateField("returnKm", value)}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Data/hora saída"
                type="datetime-local"
                value={form.departureAt}
                onChange={(value) => updateField("departureAt", value)}
                error={fieldErrors.departureAt}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Data/hora retorno"
                type="datetime-local"
                value={form.returnAt}
                onChange={(value) => updateField("returnAt", value)}
                disabled={saving || lockedByMdfe}
              />
            </div>

            <TextAreaField
              label="Observações"
              value={form.notes}
              onChange={(value) => updateField("notes", value)}
              disabled={saving || lockedByMdfe}
            />
          </FormSection>

          <FormSection
            title="Rota fiscal"
            description="Dados usados no XML do MDF-e para carregamento e descarregamento."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="UF origem"
                value={form.originState}
                onChange={(value) => updateField("originState", value)}
                error={fieldErrors.originState}
                disabled={saving || lockedByMdfe}
              >
                <option value="">UF</option>
                {BRAZILIAN_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </SelectField>
              <TextField
                label="Cidade origem"
                value={form.originCityName}
                onChange={(value) => updateField("originCityName", value)}
                error={fieldErrors.originCityName}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Código IBGE origem"
                value={form.originCityIbgeCode}
                onChange={(value) => updateField("originCityIbgeCode", value)}
                error={fieldErrors.originCityIbgeCode}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="CEP origem"
                value={form.originZipCode}
                onChange={(value) => updateField("originZipCode", value)}
                disabled={saving || lockedByMdfe}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="UF destino"
                value={form.destinationState}
                onChange={(value) => updateField("destinationState", value)}
                error={fieldErrors.destinationState}
                disabled={saving || lockedByMdfe}
              >
                <option value="">UF</option>
                {BRAZILIAN_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </SelectField>
              <TextField
                label="Cidade destino"
                value={form.destinationCityName}
                onChange={(value) => updateField("destinationCityName", value)}
                error={fieldErrors.destinationCityName}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Código IBGE destino"
                value={form.destinationCityIbgeCode}
                onChange={(value) => updateField("destinationCityIbgeCode", value)}
                error={fieldErrors.destinationCityIbgeCode}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="CEP destino"
                value={form.destinationZipCode}
                onChange={(value) => updateField("destinationZipCode", value)}
                disabled={saving || lockedByMdfe}
              />
            </div>
          </FormSection>

          <FormSection
            title="Carga predominante"
            description="Informações obrigatórias para carga lotação e totais do MDF-e."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <TextField
                label="Descrição da carga"
                value={form.cargoDescription}
                onChange={(value) => updateField("cargoDescription", value)}
                placeholder="Ex: Óleo diesel"
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="NCM predominante"
                value={form.cargoNcm}
                onChange={(value) => updateField("cargoNcm", value)}
                error={fieldErrors.cargoNcm}
                placeholder="Ex: 27101932"
                disabled={saving || lockedByMdfe}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Valor total da carga"
                type="number"
                value={form.cargoValue}
                onChange={(value) => updateField("cargoValue", value)}
                error={fieldErrors.cargoValue}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Quantidade total"
                type="number"
                value={form.cargoQuantity}
                onChange={(value) => updateField("cargoQuantity", value)}
                error={fieldErrors.cargoQuantity}
                disabled={saving || lockedByMdfe}
              />
              <SelectField
                label="Unidade MDF-e"
                value={form.cargoUnit}
                onChange={(value) => updateField("cargoUnit", value as "KG" | "TON")}
                disabled={saving || lockedByMdfe}
              >
                <option value="KG">KG</option>
                <option value="TON">TON</option>
              </SelectField>
            </div>
          </FormSection>

          <FormSection
            title="Pagamento / contratante"
            description="Dados usados no grupo infPag/infContratante do MDF-e."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <TextField
                label="Nome do contratante"
                value={form.contractorName}
                onChange={(value) => updateField("contractorName", value)}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="CPF/CNPJ do contratante"
                value={form.contractorDocument}
                onChange={(value) => updateField("contractorDocument", value)}
                disabled={saving || lockedByMdfe}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                label="Valor do frete/pagamento"
                type="number"
                value={form.paymentValue}
                onChange={(value) => updateField("paymentValue", value)}
                error={fieldErrors.paymentValue}
                disabled={saving || lockedByMdfe}
              />
              <SelectField
                label="Indicador de pagamento"
                value={form.paymentIndicator}
                onChange={(value) => updateField("paymentIndicator", value as "PAID" | "UNPAID")}
                disabled={saving || lockedByMdfe}
              >
                <option value="UNPAID">A prazo / não pago</option>
                <option value="PAID">Pago</option>
              </SelectField>
              <TextField
                label="Chave PIX"
                value={form.paymentPixKey}
                onChange={(value) => updateField("paymentPixKey", value)}
                disabled={saving || lockedByMdfe}
              />
            </div>
          </FormSection>

          <FormSection
            title="Seguro da carga"
            description="Obrigatório para prestador de serviço de transporte no modal rodoviário."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <TextField
                label="Seguradora"
                value={form.insuranceCompanyName}
                onChange={(value) => updateField("insuranceCompanyName", value)}
                error={fieldErrors.insuranceCompanyName}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="CNPJ/CPF da seguradora"
                value={form.insuranceCompanyDocument}
                onChange={(value) => updateField("insuranceCompanyDocument", value)}
                error={fieldErrors.insuranceCompanyDocument}
                disabled={saving || lockedByMdfe}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TextField
                label="Número da apólice"
                value={form.insurancePolicyNumber}
                onChange={(value) => updateField("insurancePolicyNumber", value)}
                error={fieldErrors.insurancePolicyNumber}
                disabled={saving || lockedByMdfe}
              />
              <TextField
                label="Número de averbação"
                value={form.insuranceEndorsement}
                onChange={(value) => updateField("insuranceEndorsement", value)}
                disabled={saving || lockedByMdfe}
              />
            </div>
          </FormSection>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        <Link
          to={`/trips/${trip.id}`}
          className="inline-flex justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || lockedByMdfe}
          className="inline-flex justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : lockedByMdfe ? "Edição bloqueada" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`mt-1 h-12 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-orange-500 focus:ring-orange-200"
        }`}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={4}
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  error,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`mt-1 h-12 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-orange-500 focus:ring-orange-200"
        }`}
      >
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
