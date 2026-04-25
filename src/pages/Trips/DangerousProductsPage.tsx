import { useEffect, useMemo, useState } from "react";
import {
  createDangerousProduct,
  deleteDangerousProduct,
  getDangerousProducts,
  updateDangerousProduct,
  type DangerousProduct,
} from "../../services/dangerousProducts";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { useStatusToast } from "../../contexts/StatusToastContext";

type FormData = {
  name: string;
  commercialName: string;
  unNumber: string;
  riskClass: string;
  packingGroup: string;
  hazardNumber: string;
  emergencyNumber: string;
  physicalState: string;
  fispqUrl: string;
  active: boolean;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

type ProductFilter = "ALL" | "ACTIVE" | "PENDING_FISPQ" | "INACTIVE";

const initialForm: FormData = {
  name: "",
  commercialName: "",
  unNumber: "",
  riskClass: "",
  packingGroup: "",
  hazardNumber: "",
  emergencyNumber: "",
  physicalState: "Líquido",
  fispqUrl: "",
  active: true,
};

function hasFispq(product: DangerousProduct) {
  return Boolean(String(product.fispqUrl || "").trim());
}

function inputClass(hasError?: boolean) {
  return `mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
    hasError
      ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
      : "border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
  }`;
}

export function DangerousProductsPage() {
  const { showToast } = useStatusToast();

  const [products, setProducts] = useState<DangerousProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DangerousProduct | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleteTarget, setDeleteTarget] = useState<DangerousProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await getDangerousProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showToast({
        tone: "error",
        title: "Erro",
        message: "Não foi possível carregar os produtos perigosos.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const total = products.length;
    const active = products.filter((item) => item.active).length;
    const pendingFispq = products.filter((item) => item.active && !hasFispq(item)).length;
    const inactive = products.filter((item) => !item.active).length;

    return { total, active, pendingFispq, inactive };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((item) => {
      if (filter === "ACTIVE" && !item.active) return false;
      if (filter === "INACTIVE" && item.active) return false;
      if (filter === "PENDING_FISPQ" && (!item.active || hasFispq(item))) return false;

      if (!term) return true;

      return [
        item.name,
        item.commercialName,
        item.unNumber,
        item.riskClass,
        item.packingGroup,
        item.hazardNumber,
        item.emergencyNumber,
        item.physicalState,
        item.fispqUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [products, search, filter]);

  function openCreate() {
    setEditing(null);
    setForm(initialForm);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(product: DangerousProduct) {
    setEditing(product);
    setForm({
      name: product.name || "",
      commercialName: product.commercialName || "",
      unNumber: product.unNumber || "",
      riskClass: product.riskClass || "",
      packingGroup: product.packingGroup || "",
      hazardNumber: product.hazardNumber || "",
      emergencyNumber: product.emergencyNumber || "",
      physicalState: product.physicalState || "Líquido",
      fispqUrl: product.fispqUrl || "",
      active: product.active,
    });
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(initialForm);
    setFieldErrors({});
  }

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateForm() {
    const errors: FieldErrors = {};

    if (!form.name.trim()) errors.name = "Informe o nome do produto.";
    if (!form.unNumber.trim()) errors.unNumber = "Informe o número ONU.";
    if (!form.riskClass.trim()) errors.riskClass = "Informe a classe de risco.";

    if (form.active && !form.fispqUrl.trim()) {
      errors.fispqUrl = "FISPQ é obrigatória para produto perigoso ativo.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!validateForm()) {
      showToast({
        tone: "error",
        title: "Campos obrigatórios",
        message: "Revise os campos destacados antes de salvar.",
      });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        commercialName: form.commercialName.trim() || undefined,
        unNumber: form.unNumber.trim(),
        riskClass: form.riskClass.trim(),
        packingGroup: form.packingGroup.trim() || undefined,
        hazardNumber: form.hazardNumber.trim() || undefined,
        emergencyNumber: form.emergencyNumber.trim() || undefined,
        physicalState: form.physicalState.trim() || undefined,
        fispqUrl: form.fispqUrl.trim(),
        active: form.active,
      };

      if (editing) {
        await updateDangerousProduct(editing.id, payload);
      } else {
        await createDangerousProduct(payload);
      }

      showToast({
        tone: "success",
        title: editing ? "Produto atualizado" : "Produto cadastrado",
        message: "Produto perigoso salvo com sucesso.",
      });

      closeModal();
      await load();
    } catch (error: any) {
      showToast({
        tone: "error",
        title: "Erro ao salvar",
        message:
          error?.response?.data?.message ||
          "Não foi possível salvar o produto perigoso.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await deleteDangerousProduct(deleteTarget.id);

      showToast({
        tone: "success",
        title: "Produto removido",
        message: "Produto perigoso removido com sucesso.",
      });

      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      showToast({
        tone: "error",
        title: "Erro ao remover",
        message:
          error?.response?.data?.message ||
          "Não foi possível remover o produto perigoso.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Produtos Perigosos
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Cadastro regulatório usado na viagem, ficha de emergência, MDF-e e
            validações de compliance operacional.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Novo produto
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Ativos" value={summary.active} tone="green" />
        <SummaryCard label="Sem FISPQ" value={summary.pendingFispq} tone="red" />
        <SummaryCard label="Inativos" value={summary.inactive} tone="slate" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block text-sm font-medium text-slate-700">
            Buscar
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, ONU, classe de risco, FISPQ..."
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <FilterButton label="Todos" active={filter === "ALL"} onClick={() => setFilter("ALL")} />
            <FilterButton label="Ativos" active={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")} />
            <FilterButton label="Sem FISPQ" active={filter === "PENDING_FISPQ"} onClick={() => setFilter("PENDING_FISPQ")} />
            <FilterButton label="Inativos" active={filter === "INACTIVE"} onClick={() => setFilter("INACTIVE")} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-semibold text-slate-700">
            {filteredProducts.length} produto(s) encontrado(s)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Produto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">ONU</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Classe</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">FISPQ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    Carregando produtos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    Nenhum produto perigoso encontrado.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-t border-slate-200 ${
                      product.active && !hasFispq(product) ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm">
                      <p className="font-semibold text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {product.commercialName || "Sem nome comercial"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Grupo {product.packingGroup || "-"} · Risco {product.hazardNumber || "-"}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                      UN {product.unNumber}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {product.riskClass}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      {hasFispq(product) ? (
                        <div className="space-y-1">
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                            Informada
                          </span>
                          <p className="max-w-xs truncate text-xs text-slate-500">
                            {product.fispqUrl}
                          </p>
                        </div>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                          Pendente
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          product.active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {product.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(product)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
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

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editing ? "Editar produto perigoso" : "Novo produto perigoso"}
                </h2>
                <p className="text-sm text-slate-500">
                  Produto ativo precisa ter FISPQ para ser usado em viagens.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Nome *" value={form.name} error={fieldErrors.name} onChange={(v) => updateField("name", v)} />
                <Input label="Nome comercial" value={form.commercialName} onChange={(v) => updateField("commercialName", v)} />
                <Input label="Número ONU *" value={form.unNumber} error={fieldErrors.unNumber} onChange={(v) => updateField("unNumber", v)} />
                <Input label="Classe de risco *" value={form.riskClass} error={fieldErrors.riskClass} onChange={(v) => updateField("riskClass", v)} />
                <Input label="Grupo de embalagem" value={form.packingGroup} onChange={(v) => updateField("packingGroup", v)} />
                <Input label="Número de risco" value={form.hazardNumber} onChange={(v) => updateField("hazardNumber", v)} />
                <Input label="Telefone emergência" value={form.emergencyNumber} onChange={(v) => updateField("emergencyNumber", v)} />
                <Input label="Estado físico" value={form.physicalState} onChange={(v) => updateField("physicalState", v)} />

                <div className="md:col-span-2">
                  <Input
                    label="URL ou identificação da FISPQ *"
                    value={form.fispqUrl}
                    error={fieldErrors.fispqUrl}
                    onChange={(v) => updateField("fispqUrl", v)}
                  />
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => updateField("active", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Produto ativo
                </label>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
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
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Excluir produto perigoso"
        description={`Deseja excluir o produto "${deleteTarget?.name || ""}"? Se ele já estiver vinculado a viagens, será apenas inativado.`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "red" | "slate";
}) {
  const classes = {
    default: "border-slate-200 bg-white text-slate-900",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-orange-500 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Input({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass(Boolean(error))}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}