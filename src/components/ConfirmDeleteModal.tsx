type ConfirmDeleteModalProps = {
  isOpen: boolean;
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  isOpen,
  title = "Confirmar exclusão",
  description,
  confirmText = "Excluir",
  cancelText = "Cancelar",
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ui btn-ui-neutral"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-ui btn-ui-danger"
            disabled={loading}
          >
            {loading ? "Excluindo..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
