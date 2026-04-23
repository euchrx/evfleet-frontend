import { useEffect, useMemo, useState } from "react";

type StatusToastProps = {
  visible: boolean;
  tone: "loading" | "success" | "error";
  title: string;
  message: string;
  durationMs?: number;
  onClose?: () => void;
};

const toneStyles = {
  loading: {
    shell: "border-amber-200 bg-amber-50/95 text-amber-950",
    badge: "bg-amber-100 text-amber-700",
    iconWrap: "bg-amber-100 text-amber-700",
    icon: "⏳",
    progressFrom: "#f59e0b",
    progressTo: "#fde68a",
  },
  success: {
    shell: "border-emerald-200 bg-emerald-50/95 text-emerald-950",
    badge: "bg-emerald-100 text-emerald-700",
    iconWrap: "bg-emerald-100 text-emerald-700",
    icon: "✓",
    progressFrom: "#10b981",
    progressTo: "#a7f3d0",
  },
  error: {
    shell: "border-red-200 bg-red-50/95 text-red-950",
    badge: "bg-red-100 text-red-700",
    iconWrap: "bg-red-100 text-red-700",
    icon: "!",
    progressFrom: "#ef4444",
    progressTo: "#fecaca",
  },
} as const;

function CircularTimer({
  progress,
  tone,
}: {
  progress: number;
  tone: StatusToastProps["tone"];
}) {
  const styles = toneStyles[tone];
  const normalizedProgress = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  const angle = normalizedProgress * 360;

  const background = useMemo(
    () =>
      `conic-gradient(${styles.progressFrom} 0deg ${angle}deg, ${styles.progressTo} ${angle}deg 360deg)`,
    [angle, styles.progressFrom, styles.progressTo],
  );

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full transition-[background] duration-75 ease-linear"
        style={{ background }}
      />
      <div className="absolute inset-[4px] rounded-full bg-white/90" />
      <div
        className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${styles.iconWrap}`}
        aria-hidden="true"
      >
        {styles.icon}
      </div>
    </div>
  );
}

export function StatusToast({
  visible,
  tone,
  title,
  message,
  durationMs = 10000,
  onClose,
}: StatusToastProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!visible) {
      setIsMounted(false);
      setProgress(1);
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setIsMounted(true);
    });

    if (durationMs <= 0) {
      setProgress(1);
      return () => {
        window.cancelAnimationFrame(animationFrame);
      };
    }

    const startedAt = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = Math.max(0, 1 - elapsed / durationMs);
      setProgress(nextProgress);

      if (elapsed < durationMs) {
        rafId = window.requestAnimationFrame(step);
        return;
      }

      onClose?.();
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(rafId);
    };
  }, [durationMs, onClose, visible]);

  if (!visible) return null;

  const styles = toneStyles[tone];

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[140] w-[calc(100vw-2rem)] max-w-md sm:bottom-6 sm:right-6">
      <div
        className={[
          "pointer-events-auto overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out",
          styles.shell,
          isMounted
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-4 scale-[0.98] opacity-0",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 px-4 py-4">
          <CircularTimer progress={progress} tone={tone} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] ${styles.badge}`}
              >
                {tone}
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold leading-5">{title}</p>
            <p className="mt-1 text-sm leading-5 opacity-90">{message}</p>
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-current/60 transition hover:bg-black/5 hover:text-current"
              aria-label="Fechar notificação"
            >
              <span aria-hidden="true" className="block text-base leading-none">
                ×
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
