import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTrip,
  validateTripCompliance,
  generateEmergencySheet,
  startTrip,
  addTripProduct,
  removeTripProduct,
} from "../../services/trips";
import type { Trip, TripGeneratedDocument } from "../../types/trip";
import { getDangerousProducts } from "../../services/dangerousProducts";
import { MdfeActions } from "../../components/mdfe/MdfeActions";

type DangerousProductOption = {
  id: string;
  name: string;
  commercialName?: string | null;
  unNumber: string;
  riskClass: string;
  fispqUrl?: string | null;
  active: boolean;
};

type DocumentPayload = {
  html?: string;
  draftPayload?: unknown;
  providerResult?: unknown;
};

type ActionKey = "VALIDATE" | "SHEET" | "MDFE" | "START";

function getDocumentPayload(doc: TripGeneratedDocument): DocumentPayload {
  if (!doc.payload || typeof doc.payload !== "object") return {};
  return doc.payload as DocumentPayload;
}

function openPrintableHtml(html: string, title = "Documento") {
  const printWindow = window.open("", "_blank", "width=1280,height=900");

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão.");
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.document.title = title;
    printWindow.focus();
    printWindow.print();
  }, 300);
}

function buildMdfeChecklist(trip: Trip) {
  const products = trip.products || [];
  const missingFispq = products.filter(
    (item) => !item.dangerousProduct?.fispqUrl,
  );

  return [
    {
      key: "vehicle",
      label: "Veículo de tração",
      description: trip.vehicle?.plate
        ? `Veículo ${trip.vehicle.plate} vinculado à viagem.`
        : "Nenhum veículo vinculado à viagem.",
      passed: !!trip.vehicleId,
      action: {
        label: "Editar viagem",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "driver",
      label: "Motorista",
      description: trip.driver?.name
        ? `Motorista ${trip.driver.name} vinculado.`
        : "Nenhum motorista vinculado à viagem.",
      passed: !!trip.driverId,
      action: {
        label: "Editar viagem",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "route",
      label: "Rota fiscal",
      description:
        trip.originState &&
          trip.destinationState &&
          trip.originCityIbgeCode &&
          trip.destinationCityIbgeCode
          ? `${trip.originState} → ${trip.destinationState}`
          : "Informe UF e código IBGE de origem/destino.",
      passed:
        !!trip.originState &&
        !!trip.destinationState &&
        !!trip.originCityIbgeCode &&
        !!trip.destinationCityIbgeCode,
      action: {
        label: "Editar rota fiscal",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "cargo",
      label: "Carga transportada",
      description:
        products.length > 0
          ? `${products.length} produto(s) vinculado(s).`
          : "Adicione pelo menos um produto/carga à viagem.",
      passed: products.length > 0,
      action: {
        label: "Adicionar carga",
        to: `/trips/${trip.id}`,
      },
    },
    {
      key: "fispq",
      label: "FISPQ dos produtos",
      description:
        missingFispq.length === 0
          ? "Todos os produtos estão com FISPQ."
          : `${missingFispq.length} produto(s) sem FISPQ.`,
      passed: products.length > 0 && missingFispq.length === 0,
      action: {
        label: "Corrigir FISPQ",
        to: "/dangerous-products",
      },
    },
    {
      key: "ncm",
      label: "NCM predominante",
      description: trip.cargoNcm
        ? `NCM ${trip.cargoNcm} informado.`
        : "Informe o NCM do produto predominante da carga.",
      passed: !!trip.cargoNcm,
      action: {
        label: "Editar dados fiscais",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "cargo-values",
      label: "Valor e quantidade da carga",
      description:
        trip.cargoValue && trip.cargoQuantity
          ? "Valor e quantidade informados."
          : "Informe valor e quantidade total da carga.",
      passed:
        Number(trip.cargoValue || 0) > 0 &&
        Number(trip.cargoQuantity || 0) > 0,
      action: {
        label: "Editar carga fiscal",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "payment",
      label: "Pagamento/frete",
      description:
        trip.paymentValue && Number(trip.paymentValue) > 0
          ? "Dados de pagamento/frete informados."
          : "Informe o valor do frete/pagamento.",
      passed: Number(trip.paymentValue || 0) > 0,
      action: {
        label: "Editar pagamento",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "insurance",
      label: "Seguro da carga",
      description:
        trip.insuranceCompanyName &&
          trip.insuranceCompanyDocument &&
          trip.insurancePolicyNumber
          ? "Dados do seguro informados."
          : "Informe seguradora, documento e apólice.",
      passed:
        !!trip.insuranceCompanyName &&
        !!trip.insuranceCompanyDocument &&
        !!trip.insurancePolicyNumber,
      action: {
        label: "Editar seguro",
        to: `/trips/${trip.id}/edit`,
      },
    },
    {
      key: "mdfe",
      label: "MDF-e",
      description: trip.mdfe
        ? `MDF-e com status ${trip.mdfe.status}.`
        : "MDF-e ainda não gerado.",
      passed: !!trip.mdfe,
    },
  ];
}

function getPendingComplianceResults(trip: Trip) {
  const last = trip.complianceChecks?.[0];

  return (
    last?.results?.filter(
      (result) => !result.passed && result.severity === "BLOCKING",
    ) || []
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    PENDING_COMPLIANCE: "Pendente compliance",
    BLOCKED: "Bloqueada",
    APPROVED: "Aprovada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return labels[status] || status;
}

function documentLabel(type: string) {
  const labels: Record<string, string> = {
    EMERGENCY_SHEET: "Ficha de emergência",
  };

  return labels[type] || type;
}

export function TripDetailsPage() {
  const { id } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;

    try {
      setLoading(true);
      const data = await getTrip(id);
      setTrip(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

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

  const pendingResults = getPendingComplianceResults(trip);

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/trips"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Voltar
        </Link>

        <p className="text-xs font-medium text-slate-500">
          Viagem ID: <span className="font-semibold text-slate-700">{trip.id}</span>
        </p>
      </div>

      <Header trip={trip} pendingCount={pendingResults.length} />

      <ActionsCard trip={trip} reload={load} />

      <MdfeActions
        tripId={trip.id}
        canGenerateMdfe={buildMdfeChecklist(trip).every((item) => item.passed || item.key === "mdfe")}
      />

      <ComplianceActionsCard trip={trip} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ComplianceCard trip={trip} />
        <DocumentsCard trip={trip} />
      </div>

      <ProductsTable trip={trip} reload={load} />
    </div>
  );
}

// ================= HEADER =================

function Header({ trip, pendingCount }: { trip: Trip; pendingCount: number }) {
  const productsCount = trip.products?.length || 0;
  const documentsCount =
    (trip.generatedDocuments?.length || 0) +
    (trip.mdfe ? 1 : 0);
  const lastCompliance = trip.complianceChecks?.[0];

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 px-6 py-6 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Gestão de viagem
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {trip.origin} → {trip.destination}
            </h1>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full bg-white/10 px-3 py-1">
                Saída: {formatDateTime(trip.departureAt)}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Veículo: {trip.vehicle?.plate || "-"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Motorista: {trip.driver?.name || "-"}
              </span>
            </div>
          </div>

          <StatusBadge status={trip.status} />
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Compliance"
          value={pendingCount > 0 ? `${pendingCount} pendência(s)` : "Sem pendências"}
          tone={pendingCount > 0 ? "red" : "green"}
        />

        <MetricCard
          label="Carga"
          value={`${productsCount} produto(s)`}
          tone={productsCount > 0 ? "slate" : "amber"}
        />

        <MetricCard
          label="Documentos gerados"
          value={`${documentsCount} documento(s)`}
          tone={documentsCount > 0 ? "slate" : "amber"}
        />

        <MetricCard
          label="Última validação"
          value={lastCompliance?.checkedAt ? formatDateTime(lastCompliance.checkedAt) : "Não realizada"}
          tone="slate"
        />
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "border-green-300 bg-green-100 text-green-800",
    BLOCKED: "border-red-300 bg-red-100 text-red-800",
    PENDING_COMPLIANCE: "border-amber-300 bg-amber-100 text-amber-800",
    IN_PROGRESS: "border-blue-300 bg-blue-100 text-blue-800",
    COMPLETED: "border-slate-300 bg-slate-100 text-slate-700",
    CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
    DRAFT: "border-slate-300 bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-bold ${map[status] || "border-slate-300 bg-slate-100 text-slate-700"
        }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "green" | "red" | "amber";
}) {
  const classes = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${classes[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

// ================= ACTIONS =================

function ActionsCard({
  trip,
  reload,
}: {
  trip: Trip;
  reload: () => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [error, setError] = useState("");

  const hasProducts = Boolean(trip.products?.length);

  const hasSheet = Boolean(
    trip.generatedDocuments?.some(
      (doc) =>
        doc.type === "EMERGENCY_SHEET" &&
        ["DRAFT", "GENERATED", "SENT"].includes(doc.status),
    ),
  );

  async function runAction(action: ActionKey, callback: () => Promise<unknown>) {
    try {
      setError("");
      setActionLoading(action);
      await callback();
      await reload();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Não foi possível concluir a ação.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-lg font-bold text-slate-900">Central de ações</h3>
        <p className="text-sm text-slate-500">
          Gere documentos, valide conformidade e avance a viagem somente quando tudo estiver regular.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ActionButton
          title="Validar compliance"
          description="Reprocessa as regras bloqueantes da viagem."
          loading={actionLoading === "VALIDATE"}
          disabled={Boolean(actionLoading)}
          tone="blue"
          onClick={() => runAction("VALIDATE", () => validateTripCompliance(trip.id))}
        />

        <ActionButton

          title={hasSheet ? "Ficha gerada" : "Gerar ficha"}
          description={
            !hasProducts
              ? "Adicione carga antes de gerar."
              : hasSheet
                ? "Documento já criado para esta viagem."
                : "Cria a ficha de emergência."
          }
          loading={actionLoading === "SHEET"}
          disabled={Boolean(actionLoading) || !hasProducts || hasSheet}
          tone="amber"
          onClick={() => runAction("SHEET", () => generateEmergencySheet(trip.id))}
        />

        <ActionButton
          title="Iniciar viagem"
          description={
            trip.status === "APPROVED"
              ? "Libera a viagem para execução."
              : "Disponível somente após aprovação."
          }
          loading={actionLoading === "START"}
          disabled={Boolean(actionLoading) || trip.status !== "APPROVED"}
          tone="green"
          onClick={() => runAction("START", () => startTrip(trip.id))}
        />

        <Link
          to={`/trips/${trip.id}/edit`}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-slate-800 transition hover:bg-slate-100"
        >
          <p className="text-sm font-bold">Editar viagem</p>
          <p className="mt-1 text-xs opacity-80">
            Rota, carga fiscal, seguro e pagamento.
          </p>
        </Link>

        <Link
          to="/dangerous-products"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-slate-800 transition hover:bg-slate-100"
        >
          <p className="text-sm font-bold">Produtos perigosos</p>
          <p className="mt-1 text-xs opacity-80">
            FISPQ, ONU, NCM e classe de risco.
          </p>
        </Link>

        <Link
          to="/vehicle-documents"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-slate-800 transition hover:bg-slate-100"
        >
          <p className="text-sm font-bold">Documentos</p>
          <p className="mt-1 text-xs opacity-80">
            CRLV, CIV, CIPP, MOPP e documentos da frota.
          </p>
        </Link>
      </div>
    </section>
  );
}

function ActionButton({
  title,
  description,
  loading,
  disabled,
  tone,
  onClick,
}: {
  title: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  tone: "blue" | "amber" | "purple" | "green";
  onClick: () => void;
}) {
  const classes = {
    blue: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
    amber: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    purple: "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100",
    green: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${classes[tone]}`}
    >
      <p className="text-sm font-bold">{loading ? "Processando..." : title}</p>
      <p className="mt-1 text-xs opacity-80">{description}</p>
    </button>
  );
}

// ================= REGULARIZAÇÃO =================

function ComplianceActionsCard({ trip }: { trip: Trip }) {
  const pendingResults = getPendingComplianceResults(trip);

  const actions = useMemo(() => {
    const resultText = pendingResults
      .map((result) =>
        `${result.ruleCode || ""} ${result.title || ""} ${result.message || ""
          }`.toLowerCase(),
      )
      .join(" ");

    const nextActions: Array<{
      key: string;
      label: string;
      description: string;
      to?: string;
      tone: "red" | "amber";
    }> = [];

    if (resultText.includes("fispq")) {
      nextActions.push({
        key: "fispq",
        label: "Regularizar FISPQ",
        description:
          "Atualize a FISPQ no cadastro do produto perigoso e valide a viagem novamente.",
        to: "/dangerous-products",
        tone: "red",
      });
    }

    if (
      resultText.includes("cipp") ||
      resultText.includes("civ") ||
      resultText.includes("crlv")
    ) {
      nextActions.push({
        key: "vehicle-documents",
        label: "Regularizar documentos do veículo",
        description:
          "Cadastre ou atualize CRLV, CIV e CIPP na Gestão de Documentos, aba Veículos.",
        to: "/vehicle-documents?tab=VEHICLE",
        tone: "red",
      });
    }

    if (resultText.includes("mopp")) {
      nextActions.push({
        key: "driver-documents",
        label: "Regularizar MOPP",
        description:
          "Cadastre ou atualize o MOPP na Gestão de Documentos, aba Motoristas.",
        to: "/vehicle-documents?tab=DRIVER",
        tone: "red",
      });
    }

    if (resultText.includes("mdf-e") || resultText.includes("mdfe")) {
      nextActions.push({
        key: "mdfe",
        label: "Gerar MDF-e",
        description:
          "Quando os dados estiverem regulares, gere o MDF-e pela Central de ações.",
        tone: "amber",
      });
    }

    return nextActions;
  }, [pendingResults]);

  if (actions.length === 0) return null;

  return (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-red-900">
          Plano de regularização
        </h3>
        <p className="text-sm text-red-700">
          Existem bloqueios operacionais. Resolva os itens abaixo e valide novamente.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {actions.map((action) => (
          <div
            key={action.key}
            className="rounded-2xl border border-red-200 bg-white p-4"
          >
            <p className="font-bold text-slate-900">{action.label}</p>
            <p className="mt-1 text-sm text-slate-600">{action.description}</p>

            {action.to ? (
              <Link
                to={action.to}
                className="mt-3 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Abrir regularização
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ================= COMPLIANCE =================

function ComplianceCard({ trip }: { trip: Trip }) {
  const checklist = buildMdfeChecklist(trip);
  const completed = checklist.filter((item) => item.passed).length;
  const total = checklist.length;
  const percent = Math.round((completed / total) * 100);
  const blocked = checklist.some((item) => !item.passed);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Checklist MDF-e
          </h3>
          <p className="text-sm text-slate-500">
            Conferência fiscal e operacional antes da emissão.
          </p>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-xs font-bold ${blocked
            ? "bg-red-100 text-red-700"
            : "bg-green-100 text-green-700"
            }`}
        >
          {blocked ? "PENDENTE" : "PRONTO"} · {percent}%
        </span>
      </div>

      <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${blocked ? "bg-red-500" : "bg-green-500"
            }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {checklist.map((item) => (
          <div
            key={item.key}
            className={`rounded-2xl border p-4 ${item.passed
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
              }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.description}
                </p>

                {!item.passed && item.action ? (
                  <Link
                    to={item.action.to}
                    className="mt-3 inline-flex rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    {item.action.label}
                  </Link>
                ) : null}
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${item.passed
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                  }`}
              >
                {item.passed ? "OK" : "PENDENTE"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ================= DOCUMENTOS =================

function DocumentsCard({ trip }: { trip: Trip }) {
  const documents = trip.generatedDocuments || [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-lg font-bold text-slate-900">
          Documentos da viagem
        </h3>
        <p className="text-sm text-slate-500">
          Arquivos e documentos operacionais gerados para esta viagem.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          Nenhum documento gerado.
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const payload = getDocumentPayload(doc);
            const canOpenEmergencySheet =
              doc.type === "EMERGENCY_SHEET" && Boolean(payload.html);

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {documentLabel(doc.type)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Status: {doc.status}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canOpenEmergencySheet ? (
                      <button
                        type="button"
                        onClick={() =>
                          openPrintableHtml(
                            payload.html || "",
                            `Ficha de Emergência - ${trip.origin} para ${trip.destination}`,
                          )
                        }
                        className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                      >
                        Abrir/Imprimir
                      </button>
                    ) : null}

                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Abrir arquivo
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
// ================= CARGA / PRODUTOS =================

function ProductsTable({
  trip,
  reload,
}: {
  trip: Trip;
  reload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [removingProductId, setRemovingProductId] = useState<string | null>(
    null,
  );

  const products = trip.products || [];

  async function handleRemoveProduct(productId: string) {
    try {
      setRemovingProductId(productId);
      await removeTripProduct(trip.id, productId);
      await reload();
    } finally {
      setRemovingProductId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Carga transportada</h3>
          <p className="text-sm text-slate-500">
            Produtos perigosos vinculados à viagem para ficha, MDF-e e compliance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          + Adicionar produto
        </button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="font-semibold text-slate-700">Nenhuma carga vinculada.</p>
          <p className="mt-1 text-sm text-slate-500">
            Adicione a carga perigosa antes de gerar ficha de emergência ou MDF-e.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => {
            const dangerousProduct = product.dangerousProduct;
            const hasFispq = Boolean(dangerousProduct?.fispqUrl);

            return (
              <div
                key={product.id}
                className={`rounded-2xl border p-4 ${hasFispq
                  ? "border-slate-200 bg-white"
                  : "border-red-200 bg-red-50"
                  }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">
                        {dangerousProduct?.name || "Produto não identificado"}
                      </p>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${hasFispq
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                          }`}
                      >
                        {hasFispq ? "FISPQ OK" : "FISPQ pendente"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {dangerousProduct?.commercialName || "Sem nome comercial"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        ONU {dangerousProduct?.unNumber || "-"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        Classe {dangerousProduct?.riskClass || "-"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        Quantidade {product.quantity} {product.unit}
                      </span>
                    </div>

                    {!hasFispq ? (
                      <div className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-3">
                        <p className="text-sm font-semibold text-red-700">
                          Este produto está sem FISPQ.
                        </p>
                        <p className="mt-1 text-xs text-red-600">
                          Regularize o cadastro antes de gerar documentos ou validar a viagem.
                        </p>

                        <Link
                          to="/dangerous-products"
                          className="mt-3 inline-flex rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          Abrir Produtos Perigosos
                        </Link>
                      </div>
                    ) : (
                      <p className="mt-3 max-w-xl truncate text-xs text-slate-400">
                        FISPQ: {dangerousProduct?.fispqUrl}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(product.id)}
                      disabled={removingProductId === product.id}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removingProductId === product.id
                        ? "Removendo..."
                        : "Remover"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <AddProductModal
          trip={trip}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await reload();
          }}
        />
      ) : null}
    </section>
  );
}

// ================= MODAL ADICIONAR PRODUTO =================

function AddProductModal({
  trip,
  onClose,
  onSaved,
}: {
  trip: Trip;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [products, setProducts] = useState<DangerousProductOption[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("L");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadProducts() {
    try {
      const data = await getDangerousProducts();
      setProducts(data.filter((item) => item.active));
    } catch (err) {
      console.error("Erro ao carregar produtos perigosos:", err);
      setError("Não foi possível carregar os produtos perigosos.");
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const selectedProduct = products.find((product) => product.id === productId);
  const selectedProductHasFispq = Boolean(selectedProduct?.fispqUrl);

  async function handleSave() {
    try {
      setError("");

      if (!productId) {
        setError("Selecione um produto.");
        return;
      }

      if (!selectedProductHasFispq) {
        setError(
          "Este produto está sem FISPQ. Regularize o produto em Produtos Perigosos antes de vinculá-lo à viagem.",
        );
        return;
      }

      if (!quantity || Number(quantity) <= 0) {
        setError("Informe uma quantidade válida.");
        return;
      }

      setSaving(true);

      await addTripProduct(trip.id, {
        dangerousProductId: productId,
        quantity: Number(quantity),
        unit,
      });

      await onSaved();
    } catch (err: any) {
      console.error("Erro ao adicionar produto:", err);
      setError(
        err?.response?.data?.message ||
        "Não foi possível adicionar o produto à viagem.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:items-center">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Adicionar carga perigosa
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecione um produto ativo e com FISPQ regularizada.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <label className="block text-sm font-semibold text-slate-700">
            Produto perigoso
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Selecione um produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — ONU {product.unNumber}
                  {product.fispqUrl ? "" : " — FISPQ pendente"}
                </option>
              ))}
            </select>

            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Não encontrou o produto?
                </p>
                <p className="text-xs text-slate-500">
                  Cadastre um novo produto perigoso e depois volte para vincular à viagem.
                </p>
              </div>

              <Link
                to="/dangerous-products"
                className="inline-flex w-fit items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
              >
                + Cadastrar produto perigoso
              </Link>
            </div>
          </label>

          {selectedProduct ? (
            <div
              className={`rounded-2xl border p-4 ${selectedProductHasFispq
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
                }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p
                    className={`font-bold ${selectedProductHasFispq ? "text-green-800" : "text-red-800"
                      }`}
                  >
                    {selectedProductHasFispq
                      ? "Produto regularizado"
                      : "Produto com pendência"}
                  </p>

                  <p
                    className={`mt-1 text-sm ${selectedProductHasFispq ? "text-green-700" : "text-red-700"
                      }`}
                  >
                    {selectedProductHasFispq
                      ? "FISPQ informada. Este produto pode ser vinculado à viagem."
                      : "Regularize a FISPQ antes de vincular este produto à viagem."}
                  </p>
                </div>

                {!selectedProductHasFispq ? (
                  <Link
                    to="/dangerous-products"
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Regularizar FISPQ
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Quantidade
              <input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Ex: 5000"
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Unidade
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              >
                <option value="L">Litros</option>
                <option value="KG">Kg</option>
                <option value="UN">Unidade</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              !productId ||
              !quantity ||
              Number(quantity) <= 0 ||
              (Boolean(selectedProduct) && !selectedProductHasFispq)
            }
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Adicionar carga"}
          </button>
        </div>
      </div>
    </div>
  );
}