import { useEffect, useMemo, useState } from "react";
import type { Company } from "../types/company";

type DeleteCompanyWithBackupModalProps = {
  isOpen: boolean;
  company: Company | null;
  loading?: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (input: { password: string; confirmationText: string }) => void;
};

const REQUIRED_CONFIRMATION_TEXT = "EXCLUIR EMPRESA";

export function DeleteCompanyWithBackupModal({
  isOpen,
  company,
  loading = false,
  errorMessage = "",
  onCancel,
  onConfirm,
}: DeleteCompanyWithBackupModalProps) {
  const [password, setPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setConfirmationText("");
      setUnderstood(false);
    }
  }, [isOpen]);

  const isReadyToConfirm = useMemo(
    () =>
      password.trim().length > 0 &&
      confirmationText.trim() === REQUIRED_CONFIRMATION_TEXT &&
      understood,
    [confirmationText, password, understood],
  );

  if (!isOpen || !company) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 sm:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl">
        <div className="border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-amber-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-xl font-bold text-red-600">
              !
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Excluir empresa em definitivo</h2>
              <p className="text-sm text-slate-600">
                Esta ação é irreversível. O sistema vai gerar um backup lógico e, na sequência,
                remover os dados vinculados à empresa.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <p className="text-sm font-semibold text-red-700">
              Você está prestes a excluir permanentemente{" "}
              <span className="text-red-800">{company.name}</span>.
            </p>
            <p className="mt-1 text-sm text-red-700">
              Depois da confirmação, a exclusão definitiva será iniciada e não poderá ser desfeita.
            </p>
          </div>

          {loading ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <span className="mt-0.5 inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />
              <div>
                <p className="font-semibold">Exclusão em andamento</p>
                <p className="mt-1">
                  Estamos gerando o backup e finalizando a remoção dos dados da empresa. Não feche
                  esta janela até a conclusão.
                </p>
              </div>
            </div>
          ) : null}

          <form
            className="grid gap-4"
            autoComplete="off"
            onSubmit={(event) => event.preventDefault()}
          >
            <div>
              <label className="block text-sm font-medium text-slate-700">Senha atual do ADMIN</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha atual"
                name="company-delete-password"
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Digite <span className="font-bold text-slate-900">{REQUIRED_CONFIRMATION_TEXT}</span>
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={REQUIRED_CONFIRMATION_TEXT}
                name="company-delete-confirmation"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200"
                disabled={loading}
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                disabled={loading}
              />
              <span>Entendo que esta ação é permanente e remove definitivamente os dados da empresa.</span>
            </label>
          </form>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ui btn-ui-neutral disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                password: password.trim(),
                confirmationText: confirmationText.trim(),
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isReadyToConfirm || loading}
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-white" />
                Excluindo empresa...
              </>
            ) : (
              "Gerar backup e excluir"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
