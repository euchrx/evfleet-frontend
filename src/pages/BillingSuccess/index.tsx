import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { getSubscriptionPageData } from "../../services/subscription";

function useQueryParams() {
  const location = useLocation();
  return new URLSearchParams(location.search);
}

export function BillingSuccessPage() {
  const query = useQueryParams();
  const orderNsu = query.get("order_nsu");
  const transactionNsu = query.get("transaction_nsu");
  const receiptUrl = query.get("receipt_url");
  const [isChecking, setIsChecking] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Validando atualização da assinatura...");

  useEffect(() => {
    let cancelled = false;

    async function revalidateSubscription() {
      try {
        const first = await getSubscriptionPageData();
        if (cancelled) return;

        if (first.overview?.status === "ACTIVE") {
          setStatusMessage("Pagamento confirmado. Assinatura ativa.");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
        const second = await getSubscriptionPageData();
        if (cancelled) return;

        if (second.overview?.status === "ACTIVE") {
          setStatusMessage("Pagamento confirmado. Assinatura ativa.");
          return;
        }

        setStatusMessage("Retorno recebido. O status pode levar alguns instantes para atualizar.");
      } catch {
        if (!cancelled) {
          setStatusMessage("Retorno recebido. Não foi possível confirmar o status agora.");
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    revalidateSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="text-emerald-600" size={28} />
        <h1 className="text-2xl font-bold text-slate-900">Pagamento realizado com sucesso</h1>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Recebemos o retorno do pagamento e estamos sincronizando os dados da assinatura.
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {isChecking ? "Conferindo status..." : statusMessage}
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div>
          <span className="font-semibold text-slate-700">order_nsu:</span>{" "}
          <span className="text-slate-600">{orderNsu || "-"}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">transaction_nsu:</span>{" "}
          <span className="text-slate-600">{transactionNsu || "-"}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">receipt_url:</span>{" "}
          {receiptUrl ? (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              Abrir comprovante
            </a>
          ) : (
            <span className="text-slate-600">-</span>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link
          to="/subscription?refresh=1"
          className="inline-flex cursor-pointer items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Voltar para assinatura
        </Link>
      </div>
    </div>
  );
}
