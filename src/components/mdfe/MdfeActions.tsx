import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cancelTripMdfe,
  closeTripMdfe,
  consultTripMdfe,
  downloadTripDamdfe,
  downloadTripMdfeXml,
  generateTripMdfe,
  getTripMdfe,
  type MdfeRecord,
} from "../../services/mdfe";

type MdfeActionsProps = {
  tripId: string;
  canGenerateMdfe?: boolean;
};

function getStatusConfig(status?: string | null) {
  switch (status) {
    case "AUTHORIZED":
      return { label: "Autorizado", className: "bg-green-100 text-green-700" };
    case "PROCESSING":
      return { label: "Processando", className: "bg-amber-100 text-amber-700" };
    case "REJECTED":
      return { label: "Rejeitado", className: "bg-red-100 text-red-700" };
    case "CLOSED":
      return { label: "Encerrado", className: "bg-slate-200 text-slate-700" };
    case "CANCELED":
      return { label: "Cancelado", className: "bg-slate-300 text-slate-800" };
    case "ERROR":
      return { label: "Erro", className: "bg-red-100 text-red-700" };
    default:
      return { label: "Sem MDF-e", className: "bg-slate-100 text-slate-600" };
  }
}

function getApiErrorMessage(error: any) {
  const response = error?.response?.data;

  if (Array.isArray(response?.errors)) {
    return [
      response.message || "Existem pendências para emitir o MDF-e.",
      ...response.errors.map((item: string) => `• ${item}`),
    ].join("\n");
  }

  if (Array.isArray(response?.message)) {
    return response.message.join("\n");
  }

  return (
    response?.message ||
    error?.message ||
    "Não foi possível concluir a operação."
  );
}

export function MdfeActions({ tripId, canGenerateMdfe = true }: MdfeActionsProps) {
  const [mdfe, setMdfe] = useState<MdfeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const status = getStatusConfig(mdfe?.status);

  async function loadMdfe() {
    try {
      const data = await getTripMdfe(tripId);
      setMdfe(data);
    } catch {
      setMdfe(null);
    }
  }

  async function runAction(
    callback: () => Promise<unknown>,
    successMessage?: string,
  ) {
    try {
      setLoading(true);
      setErrorMessage("");

      await callback();
      await loadMdfe();

      if (successMessage) {
        alert(successMessage);
      }
    } catch (error: any) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!confirm("Deseja gerar o MDF-e desta viagem?")) return;

    await runAction(
      () => generateTripMdfe(tripId),
      "MDF-e gerado com sucesso.",
    );
  }

  async function handleConsult() {
    await runAction(
      () => consultTripMdfe(tripId),
      "Status do MDF-e atualizado.",
    );
  }

  async function handleClose() {
    if (!confirm("Deseja encerrar este MDF-e?")) return;

    await runAction(
      () => closeTripMdfe(tripId),
      "MDF-e encerrado com sucesso.",
    );
  }

  async function handleCancel() {
    const reason = prompt("Informe o motivo do cancelamento:");

    if (!reason) return;

    await runAction(
      () => cancelTripMdfe(tripId, reason),
      "MDF-e cancelado com sucesso.",
    );
  }

  async function handleDownloadXml() {
    await runAction(() => downloadTripMdfeXml(tripId));
  }

  async function handleDownloadDamdfe() {
    await runAction(() => downloadTripDamdfe(tripId));
  }

  useEffect(() => {
    void loadMdfe();
  }, [tripId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">MDF-e</h3>
          <p className="text-xs text-slate-500">Controle fiscal da viagem</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {mdfe ? (
        <div className="mb-4 grid gap-2 text-xs text-slate-600">
          <div>
            <span className="font-medium">Chave:</span>{" "}
            {mdfe.accessKey ?? "-"}
          </div>

          <div>
            <span className="font-medium">Protocolo:</span>{" "}
            {mdfe.protocol ?? "-"}
          </div>

          {mdfe.rejectionReason ? (
            <div className="whitespace-pre-line text-red-600">
              {mdfe.rejectionReason}
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Atenção</p>
          <p className="mt-1 whitespace-pre-line">{errorMessage}</p>

          {errorMessage.toLowerCase().includes("configuração fiscal") ||
            errorMessage.toLowerCase().includes("rntrc") ? (
            <button
              type="button"
              onClick={() => navigate("/fiscal-settings")}
              className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Ir para configurações fiscais
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          disabled={Boolean(
            loading ||
            !canGenerateMdfe ||
            (mdfe &&
              ["AUTHORIZED", "PROCESSING", "CLOSED", "CANCELED"].includes(
                mdfe.status,
              )),
          )}
          onClick={handleGenerate}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processando..." : !canGenerateMdfe ? "Checklist pendente" : "Gerar"}
        </button>

        <button
          disabled={loading || !mdfe}
          onClick={handleConsult}
          className="rounded-xl border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Consultar
        </button>

        <button
          disabled={loading || mdfe?.status !== "AUTHORIZED"}
          onClick={handleClose}
          className="rounded-xl border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Encerrar
        </button>

        <button
          disabled={loading || mdfe?.status !== "AUTHORIZED"}
          onClick={handleCancel}
          className="rounded-xl border border-red-200 px-3 py-2 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          disabled={loading || !mdfe}
          onClick={handleDownloadXml}
          className="rounded-xl border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          XML
        </button>

        <button
          disabled={loading || !mdfe}
          onClick={handleDownloadDamdfe}
          className="rounded-xl border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          DAMDFE
        </button>
      </div>
    </div>
  );
}