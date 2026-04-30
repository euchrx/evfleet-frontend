import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useStatusToast } from "../../contexts/StatusToastContext";

type Option = {
  id: string;
  name?: string;
  plate?: string;
  brand?: string;
  model?: string;
  status?: string;
};

type FormState = {
  origin: string;
  destination: string;
  reason: string;
  departureKm: string;
  departureAt: string;
  vehicleId: string;
  driverId: string;

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
  paymentValue: string;
  paymentPixKey: string;
  paymentIndicator: "PAID" | "UNPAID";

  insuranceCompanyName: string;
  insuranceCompanyDocument: string;
  insurancePolicyNumber: string;
  insuranceEndorsement: string;
};

const initialForm: FormState = {
  origin: "",
  destination: "",
  reason: "",
  departureKm: "",
  departureAt: "",
  vehicleId: "",
  driverId: "",

  originState: "PR",
  originCityName: "",
  originCityIbgeCode: "",
  originZipCode: "",

  destinationState: "PR",
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
  paymentValue: "",
  paymentPixKey: "",
  paymentIndicator: "PAID",

  insuranceCompanyName: "",
  insuranceCompanyDocument: "",
  insurancePolicyNumber: "",
  insuranceEndorsement: "",
};

function toNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function toIsoDateTime(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function TripAddPage() {
  const navigate = useNavigate();
  const { showToast } = useStatusToast();

  const [form, setForm] = useState<FormState>(initialForm);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [drivers, setDrivers] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadOptions() {
    try {
      setLoadingOptions(true);

      const [vehiclesResponse, driversResponse] = await Promise.all([
        api.get<Option[]>("/vehicles"),
        api.get<Option[]>("/drivers"),
      ]);

      setVehicles(Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : []);
      setDrivers(Array.isArray(driversResponse.data) ? driversResponse.data : []);
    } catch (err) {
      console.error("Erro ao carregar opções da viagem:", err);
      setError("Não foi possível carregar veículos e motoristas.");
    } finally {
      setLoadingOptions(false);
    }
  }

  useEffect(() => {
    void loadOptions();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (!form.origin || !form.destination) {
        setError("Informe origem e destino.");
        return;
      }

      if (!form.vehicleId) {
        setError("Selecione o veículo da viagem.");
        return;
      }

      if (!form.departureKm || Number(form.departureKm) < 0) {
        setError("Informe o KM inicial da viagem.");
        return;
      }

      if (!form.departureAt) {
        setError("Informe a data/hora de saída.");
        return;
      }

      const payload = {
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        reason: normalizeText(form.reason),
        departureKm: Number(form.departureKm),
        departureAt: toIsoDateTime(form.departureAt),
        vehicleId: form.vehicleId,
        driverId: form.driverId || null,

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
        cargoValue: toNumber(form.cargoValue),
        cargoQuantity: toNumber(form.cargoQuantity),
        cargoUnit: form.cargoUnit,

        contractorName: normalizeText(form.contractorName),
        contractorDocument: normalizeText(form.contractorDocument),
        paymentValue: toNumber(form.paymentValue),
        paymentPixKey: normalizeText(form.paymentPixKey),
        paymentIndicator: form.paymentIndicator,

        insuranceCompanyName: normalizeText(form.insuranceCompanyName),
        insuranceCompanyDocument: normalizeText(form.insuranceCompanyDocument),
        insurancePolicyNumber: normalizeText(form.insurancePolicyNumber),
        insuranceEndorsement: normalizeText(form.insuranceEndorsement),
      };

      const { data } = await api.post("/trips", payload);

      showToast({
        tone: "success",
        title: "Viagem criada",
        message: "A viagem foi criada com sucesso.",
      });

      navigate(`/trips/${data.id || ""}`);
    } catch (err: any) {
      const response = err?.response?.data;
      const message = Array.isArray(response?.message)
        ? response.message.join("\n")
        : response?.message || err?.message || "Não foi possível criar a viagem.";

      setError(message);

      showToast({
        tone: "error",
        title: "Erro ao criar viagem",
        message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/trips"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Voltar
        </Link>

        <p className="text-xs font-medium text-slate-500">Nova viagem</p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Gestão operacional
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Criar nova viagem
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Cadastre a viagem e os dados fiscais necessários para MDF-e, documentos e liberação operacional.
          </p>
        </div>
      </section>

      {error ? (
        <div className="whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSection title="Dados da viagem">
          <Input label="Origem" value={form.origin} onChange={(v) => updateField("origin", v)} />
          <Input label="Destino" value={form.destination} onChange={(v) => updateField("destination", v)} />
          <Input label="Motivo" value={form.reason} onChange={(v) => updateField("reason", v)} />
          <Input label="KM inicial" type="number" value={form.departureKm} onChange={(v) => updateField("departureKm", v)} />
          <Input label="Saída" type="datetime-local" value={form.departureAt} onChange={(v) => updateField("departureAt", v)} />

          <Select
            label="Veículo"
            value={form.vehicleId}
            onChange={(v) => updateField("vehicleId", v)}
            disabled={loadingOptions}
            options={vehicles.map((vehicle) => ({
              value: vehicle.id,
              label: vehicle.plate
                ? `${vehicle.plate} · ${vehicle.brand || ""} ${vehicle.model || ""}`.trim()
                : vehicle.name || vehicle.id,
            }))}
          />

          <Select
            label="Motorista"
            value={form.driverId}
            onChange={(v) => updateField("driverId", v)}
            disabled={loadingOptions}
            options={drivers.map((driver) => ({
              value: driver.id,
              label: driver.name || driver.id,
            }))}
          />
        </FormSection>

        <FormSection title="Rota fiscal">
          <Input label="UF origem" value={form.originState} onChange={(v) => updateField("originState", v.toUpperCase())} />
          <Input label="Cidade origem" value={form.originCityName} onChange={(v) => updateField("originCityName", v)} />
          <Input label="IBGE origem" value={form.originCityIbgeCode} onChange={(v) => updateField("originCityIbgeCode", v)} />
          <Input label="CEP origem" value={form.originZipCode} onChange={(v) => updateField("originZipCode", v)} />

          <Input label="UF destino" value={form.destinationState} onChange={(v) => updateField("destinationState", v.toUpperCase())} />
          <Input label="Cidade destino" value={form.destinationCityName} onChange={(v) => updateField("destinationCityName", v)} />
          <Input label="IBGE destino" value={form.destinationCityIbgeCode} onChange={(v) => updateField("destinationCityIbgeCode", v)} />
          <Input label="CEP destino" value={form.destinationZipCode} onChange={(v) => updateField("destinationZipCode", v)} />
        </FormSection>

        <FormSection title="Carga fiscal">
          <Input label="Descrição da carga" value={form.cargoDescription} onChange={(v) => updateField("cargoDescription", v)} />
          <Input label="NCM predominante" value={form.cargoNcm} onChange={(v) => updateField("cargoNcm", v)} />
          <Input label="Valor da carga" type="number" value={form.cargoValue} onChange={(v) => updateField("cargoValue", v)} />
          <Input label="Quantidade" type="number" value={form.cargoQuantity} onChange={(v) => updateField("cargoQuantity", v)} />

          <Select
            label="Unidade"
            value={form.cargoUnit}
            onChange={(v) => updateField("cargoUnit", v as "KG" | "TON")}
            options={[
              { value: "KG", label: "KG" },
              { value: "TON", label: "TON" },
            ]}
          />
        </FormSection>

        <FormSection title="Pagamento e contratante">
          <Input label="Contratante" value={form.contractorName} onChange={(v) => updateField("contractorName", v)} />
          <Input label="Documento contratante" value={form.contractorDocument} onChange={(v) => updateField("contractorDocument", v)} />
          <Input label="Valor do frete/pagamento" type="number" value={form.paymentValue} onChange={(v) => updateField("paymentValue", v)} />
          <Input label="Chave PIX" value={form.paymentPixKey} onChange={(v) => updateField("paymentPixKey", v)} />

          <Select
            label="Indicador de pagamento"
            value={form.paymentIndicator}
            onChange={(v) => updateField("paymentIndicator", v as "PAID" | "UNPAID")}
            options={[
              { value: "PAID", label: "Pago" },
              { value: "UNPAID", label: "A pagar" },
            ]}
          />
        </FormSection>

        <FormSection title="Seguro">
          <Input label="Seguradora" value={form.insuranceCompanyName} onChange={(v) => updateField("insuranceCompanyName", v)} />
          <Input label="Documento seguradora" value={form.insuranceCompanyDocument} onChange={(v) => updateField("insuranceCompanyDocument", v)} />
          <Input label="Apólice" value={form.insurancePolicyNumber} onChange={(v) => updateField("insurancePolicyNumber", v)} />
          <Input label="Averbação" value={form.insuranceEndorsement} onChange={(v) => updateField("insuranceEndorsement", v)} />
        </FormSection>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to="/trips"
            className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Criar viagem"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}