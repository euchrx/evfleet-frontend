import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

type QuickStatusOption = {
  value: string;
  label: string;
};

type QuickStatusActionProps = {
  label: string;
  options: QuickStatusOption[];
  loading?: boolean;
  onSelect: (value: string) => Promise<void> | void;
};

export function QuickStatusAction({
  label,
  options,
  loading = false,
  onSelect,
}: QuickStatusActionProps) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  async function handleSelect(value: string) {
    await onSelect(value);
    setOpen(false);
  }

  return (
    <div ref={shellRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-600 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
        title="Atualizar status"
        aria-label={label}
      >
        <Pencil size={14} />
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alterar status
          </p>
          <div className="mt-1 space-y-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={loading}
                onClick={() => handleSelect(option.value)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
