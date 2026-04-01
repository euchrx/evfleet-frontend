type StatusToastProps = {
  visible: boolean;
  tone: "loading" | "success" | "error";
  title: string;
  message: string;
};

const toneStyles = {
  loading: {
    shell: "border-amber-200 bg-amber-50 text-amber-900",
    badge: "bg-amber-100 text-amber-700",
  },
  success: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700",
  },
  error: {
    shell: "border-red-200 bg-red-50 text-red-900",
    badge: "bg-red-100 text-red-700",
  },
} as const;

export function StatusToast({
  visible,
  tone,
  title,
  message,
}: StatusToastProps) {
  if (!visible) return null;

  const styles = toneStyles[tone];

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[110] w-full max-w-sm">
      <div className={`pointer-events-auto rounded-2xl border px-4 py-4 shadow-xl ${styles.shell}`}>
        <div className="flex items-start gap-3">
          <div className={`rounded-xl px-2 py-1 text-xs font-bold uppercase tracking-wide ${styles.badge}`}>
            {tone}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm opacity-90">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
