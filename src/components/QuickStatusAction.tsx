import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { createPortal } from "react-dom";

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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !shellRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuWidth = 180;
      const padding = 12;
      const nextLeft = Math.min(
        Math.max(padding, rect.right - menuWidth),
        window.innerWidth - menuWidth - padding,
      );

      setMenuPosition({
        top: rect.bottom + 8,
        left: nextLeft,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  async function handleSelect(value: string) {
    await onSelect(value);
    setOpen(false);
  }

  return (
    <div ref={shellRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-600 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
        title="Atualizar status"
        aria-label={label}
      >
        <Pencil size={14} />
      </button>

      {open
        ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[140] min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
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
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}
