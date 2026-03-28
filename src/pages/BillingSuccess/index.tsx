import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { checkSubscriptionPayment, getSubscriptionPageData } from "../../services/subscription";

function useQueryParams() {
  const location = useLocation();
  return new URLSearchParams(location.search);
}

export function BillingSuccessPage() {
  const query = useQueryParams();
  const orderNsu = query.get("order_nsu");
  const transactionNsu = query.get("transaction_nsu");
  const receiptUrl = query.get("receipt_url");
  const slug = query.get("slug");
  const [isChecking, setIsChecking] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Validando atualização da assinatura...");

  async function confirmPayment() {
    try {
      setIsChecking(true);

      if (orderNsu) {
        const checkResult = await checkSubscriptionPayment({
          orderNsu,
          ...(transactionNsu ? { transactionNsu } : {}),
          ...(slug ? { slug } : {}),
        });

        if (checkResult.confirmed) {
          setIsConfirmed(true);
          setStatusMessage("Pagamento confirmado. Assinatura ativa.");
          await getSubscriptionPageData();
          return;
        }
      }

      const subscription = await getSubscriptionPageData();
      if (subscription.overview?.status === "ACTIVE") {
        setIsConfirmed(true);
        setStatusMessage("Pagamento confirmado. Assinatura ativa.");
        return;
      }

      setIsConfirmed(false);
      setStatusMessage("Pagamento em processamento. Clique em Atualizar status.");
    } catch {
      setIsConfirmed(false);
      setStatusMessage("Não foi possível confirmar agora. Tente novamente em alguns instantes.");
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    confirmPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {!isConfirmed ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={confirmPayment}
            disabled={isChecking}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar status
          </button>
        </div>
      ) : null}

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

