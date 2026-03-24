type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPrevious: () => void;
  onNext: () => void;
  itemLabel: string;
};

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPrevious,
  onNext,
  itemLabel,
}: TablePaginationProps) {
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Exibindo{" "}
        <span className="font-semibold text-slate-800">{firstItem}</span> a{" "}
        <span className="font-semibold text-slate-800">{lastItem}</span> de{" "}
        <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1}
          className="btn-ui btn-ui-neutral disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm font-medium text-slate-700">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="btn-ui btn-ui-neutral disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
