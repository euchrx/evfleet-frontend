import { type FormEvent, useEffect, useState } from "react";
import {
  getFiscalSettings,
  saveFiscalSettings,
  type FiscalEnvironment,
  type UpsertCompanyFiscalSettingsInput,
} from "../../services/fiscalSettings";

const initialForm: UpsertCompanyFiscalSettingsInput = {
  cnpj: "",
  corporateName: "",
  tradeName: "",
  stateRegistration: "",
  taxRegime: "",

  addressStreet: "",
  addressNumber: "",
  addressDistrict: "",
  addressComplement: "",
  cityName: "",
  cityIbgeCode: "",
  state: "",
  zipCode: "",

  rntrc: "",

  mdfeEnvironment: "HOMOLOGATION",
  mdfeSeries: 1,
  mdfeNextNumber: 1,

  mdfeDefaultInsurerName: "",
  mdfeDefaultInsurerDocument: "",
  mdfeDefaultPolicyNumber: "",

  certificatePfxUrl: "",
  certificatePasswordEncrypted: "",
  certificateExpiresAt: "",
};

export function FiscalSettingsPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof UpsertCompanyFiscalSettingsInput>(
    key: K,
    value: UpsertCompanyFiscalSettingsInput[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function loadSettings() {
    setLoading(true);

    try {
      const data = await getFiscalSettings();

      setForm({
        cnpj: data.cnpj ?? "",
        corporateName: data.corporateName ?? "",
        tradeName: data.tradeName ?? "",
        stateRegistration: data.stateRegistration ?? "",
        taxRegime: data.taxRegime ?? "",

        addressStreet: data.addressStreet ?? "",
        addressNumber: data.addressNumber ?? "",
        addressDistrict: data.addressDistrict ?? "",
        addressComplement: data.addressComplement ?? "",
        cityName: data.cityName ?? "",
        cityIbgeCode: data.cityIbgeCode ?? "",
        state: data.state ?? "",
        zipCode: data.zipCode ?? "",

        rntrc: data.rntrc ?? "",

        mdfeEnvironment: data.mdfeEnvironment ?? "HOMOLOGATION",
        mdfeSeries: data.mdfeSeries ?? 1,
        mdfeNextNumber: data.mdfeNextNumber ?? 1,

        mdfeDefaultInsurerName: data.mdfeDefaultInsurerName ?? "",
        mdfeDefaultInsurerDocument:
          data.mdfeDefaultInsurerDocument ?? "",
        mdfeDefaultPolicyNumber:
          data.mdfeDefaultPolicyNumber ?? "",

        certificatePfxUrl: data.certificatePfxUrl ?? "",
        certificatePasswordEncrypted:
          data.certificatePasswordEncrypted ?? "",
        certificateExpiresAt: data.certificateExpiresAt
          ? data.certificateExpiresAt.slice(0, 10)
          : "",
      });
    } catch {
      setForm(initialForm);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await saveFiscalSettings({
        ...form,
        cnpj: form.cnpj.replace(/\D/g, ""),
        zipCode: form.zipCode.replace(/\D/g, ""),
        state: form.state.toUpperCase(),
        rntrc: form.rntrc?.replace(/\D/g, ""),

        mdfeSeries: Number(form.mdfeSeries),
        mdfeNextNumber: Number(form.mdfeNextNumber),

        mdfeDefaultInsurerDocument:
          form.mdfeDefaultInsurerDocument?.replace(/\D/g, ""),

        certificateExpiresAt: form.certificateExpiresAt || undefined,
      });

      alert("Configurações fiscais salvas com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Configurações fiscais
        </h1>
        <p className="text-sm text-slate-500">
          Dados fiscais da empresa usados na emissão de MDF-e.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {/* EMPRESA */}
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-semibold text-slate-900">
            Empresa
          </h2>

          <Field label="CNPJ">
            <input
              value={form.cnpj}
              onChange={(e) => updateField("cnpj", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="Razão social">
            <input
              value={form.corporateName}
              onChange={(e) => updateField("corporateName", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="Nome fantasia">
            <input
              value={form.tradeName ?? ""}
              onChange={(e) => updateField("tradeName", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Inscrição estadual">
            <input
              value={form.stateRegistration ?? ""}
              onChange={(e) =>
                updateField("stateRegistration", e.target.value)
              }
              className="input"
            />
          </Field>
        </section>

        {/* ENDEREÇO */}
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-semibold text-slate-900">
            Endereço fiscal
          </h2>

          <Field label="Rua">
            <input
              value={form.addressStreet}
              onChange={(e) => updateField("addressStreet", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="Número">
            <input
              value={form.addressNumber}
              onChange={(e) => updateField("addressNumber", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="Bairro">
            <input
              value={form.addressDistrict}
              onChange={(e) => updateField("addressDistrict", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="Cidade">
            <input
              value={form.cityName}
              onChange={(e) => updateField("cityName", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="Código IBGE">
            <input
              value={form.cityIbgeCode}
              onChange={(e) => updateField("cityIbgeCode", e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="UF">
            <input
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              className="input uppercase"
              maxLength={2}
              required
            />
          </Field>

          <Field label="CEP">
            <input
              value={form.zipCode}
              onChange={(e) => updateField("zipCode", e.target.value)}
              className="input"
              required
            />
          </Field>
        </section>

        {/* MDFE */}
        <section className="grid gap-4 md:grid-cols-4">
          <h2 className="md:col-span-4 text-sm font-semibold text-slate-900">
            MDF-e
          </h2>

          <Field label="Ambiente">
            <select
              value={form.mdfeEnvironment}
              onChange={(e) =>
                updateField(
                  "mdfeEnvironment",
                  e.target.value as FiscalEnvironment,
                )
              }
              className="input"
            >
              <option value="HOMOLOGATION">Homologação</option>
              <option value="PRODUCTION">Produção</option>
            </select>
          </Field>

          <Field label="RNTRC">
            <input
              value={form.rntrc ?? ""}
              onChange={(e) => updateField("rntrc", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Série">
            <input
              type="number"
              value={form.mdfeSeries}
              onChange={(e) =>
                updateField("mdfeSeries", Number(e.target.value))
              }
              className="input"
            />
          </Field>

          <Field label="Próximo número">
            <input
              type="number"
              value={form.mdfeNextNumber}
              onChange={(e) =>
                updateField("mdfeNextNumber", Number(e.target.value))
              }
              className="input"
            />
          </Field>
        </section>

        {/* SEGURO */}
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-semibold text-slate-900">
            Seguro padrão da carga
          </h2>

          <Field label="Seguradora">
            <input
              value={form.mdfeDefaultInsurerName ?? ""}
              onChange={(e) =>
                updateField("mdfeDefaultInsurerName", e.target.value)
              }
              className="input"
            />
          </Field>

          <Field label="Documento">
            <input
              value={form.mdfeDefaultInsurerDocument ?? ""}
              onChange={(e) =>
                updateField("mdfeDefaultInsurerDocument", e.target.value)
              }
              className="input"
            />
          </Field>

          <Field label="Apólice">
            <input
              value={form.mdfeDefaultPolicyNumber ?? ""}
              onChange={(e) =>
                updateField("mdfeDefaultPolicyNumber", e.target.value)
              }
              className="input"
            />
          </Field>
        </section>

        {/* CERTIFICADO */}
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-semibold text-slate-900">
            Certificado A1
          </h2>

          <Field label="PFX base64">
            <input
              value={form.certificatePfxUrl ?? ""}
              onChange={(e) => updateField("certificatePfxUrl", e.target.value)}
              className="input"
              autoComplete="off"
            />
          </Field>

          <Field label="Senha">
            <input
              type="password"
              value={form.certificatePasswordEncrypted ?? ""}
              onChange={(e) =>
                updateField("certificatePasswordEncrypted", e.target.value)
              }
              className="input"
              autoComplete="new-password"
            />
          </Field>

          <Field label="Validade">
            <input
              type="date"
              value={form.certificateExpiresAt ?? ""}
              onChange={(e) =>
                updateField("certificateExpiresAt", e.target.value)
              }
              className="input"
            />
          </Field>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}