import { useEffect, useState } from "react";
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
import { useNavigate } from "react-router-dom";

type MdfeActionsProps = {
  tripId: string;
};

function getStatusConfig(status?: string | null) {
  switch (status) {
    case "AUTHORIZED":
      return {
        label: "Autorizado",
        className: "bg-green-100 text-green-700",
      };
    case "PROCESSING":
      return {
        label: "Processando",
        className: "bg-amber-100 text-amber-700",
      };
    case "REJECTED":
      return {
        label: "Rejeitado",
        className: "bg-red-100 text-red-700",
      };
    case "CLOSED":
      return {
        label: "Encerrado",
        className: "bg-slate-200 text-slate-700",
      };
    case "CANCELED":
      return {
        label: "Cancelado",
        className: "bg-slate-300 text-slate-800",
      };
    default:
      return {
        label: "Sem MDF-e",
        className: "bg-slate-100 text-slate-600",
      };
  }
}

export function MdfeActions({ tripId }: MdfeActionsProps) {
  const [mdfe, setMdfe] = useState<MdfeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  const status = getStatusConfig(mdfe?.status);

  async function loadMdfe() {
    try {
      const data = await getTripMdfe(tripId);
      setMdfe(data);
    } catch {
      setMdfe(null);
    }
  }

  async function handleGenerate() {
    if (!confirm("Deseja gerar o MDF-e desta viagem?")) return;

    setLoading(true);
    setErrorMessage("");

    try {
      await generateTripMdfe(tripId);
      await loadMdfe();
      alert("MDF-e gerado com sucesso.");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Não foi possível gerar o MDF-e.";

      setErrorMessage(
        Array.isArray(message) ? message.join(", ") : String(message),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConsult() {
    setLoading(true);
    setErrorMessage("");

    try {
      await consultTripMdfe(tripId);
      await loadMdfe();
      alert("Status atualizado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    if (!confirm("Deseja encerrar este MDF-e?")) return;

    setLoading(true);
    await closeTripMdfe(tripId);
    await loadMdfe();
    setLoading(false);
  }

  async function handleCancel() {
    const reason = prompt("Informe o motivo do cancelamento:");

    if (!reason) return;

    setLoading(true);
    await cancelTripMdfe(tripId, reason);
    await loadMdfe();
    setLoading(false);
  }

  useEffect(() => {
    void loadMdfe();
  }, [tripId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">MDF-e</h3>
          <p className="text-xs text-slate-500">
            Controle fiscal da viagem
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {mdfe && (
        <div className="mb-4 grid gap-2 text-xs text-slate-600">
          <div>
            <span className="font-medium">Chave:</span>{" "}
            {mdfe.accessKey ?? "-"}
          </div>

          <div>
            <span className="font-medium">Protocolo:</span>{" "}
            {mdfe.protocol ?? "-"}
          </div>

          {mdfe.rejectionReason && (
            <div className="text-red-600">
              {mdfe.rejectionReason}
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Atenção</p>
          <p className="mt-1">{errorMessage}</p>

          {errorMessage.toLowerCase().includes("configuração fiscal") && (
            <button
              onClick={() => navigate("/fiscal-settings")}
              className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Ir para configurações fiscais
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          disabled={Boolean(
            loading ||
            (mdfe &&
              ["AUTHORIZED", "PROCESSING", "CLOSED", "CANCELED"].includes(
                mdfe.status,
              ))
          )}
          onClick={handleGenerate}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gerar
        </button>

        <button
          disabled={loading || !mdfe}
          onClick={handleConsult}
          className="rounded-xl border px-3 py-2 text-xs"
        >
          Consultar
        </button>

        <button
          disabled={loading || mdfe?.status !== "AUTHORIZED"}
          onClick={handleClose}
          className="rounded-xl border px-3 py-2 text-xs"
        >
          Encerrar
        </button>

        <button
          disabled={loading || mdfe?.status !== "AUTHORIZED"}
          onClick={handleCancel}
          className="rounded-xl border border-red-200 px-3 py-2 text-xs text-red-700"
        >
          Cancelar
        </button>

        <button
          disabled={loading || !mdfe}
          onClick={() => downloadTripMdfeXml(tripId)}
          className="rounded-xl border px-3 py-2 text-xs"
        >
          XML
        </button>

        <button
          disabled={loading || !mdfe}
          onClick={() => downloadTripDamdfe(tripId)}
          className="rounded-xl border px-3 py-2 text-xs"
        >
          DAMDFE
        </button>
      </div>
    </div>
  );
}