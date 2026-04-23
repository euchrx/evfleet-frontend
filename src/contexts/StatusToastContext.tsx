import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StatusToast } from "../components/StatusToast";

type ToastTone = "loading" | "success" | "error";

type ToastState = {
  visible: boolean;
  tone: ToastTone;
  title: string;
  message: string;
  durationMs: number;
};

type ShowStatusToastInput = {
  tone: ToastTone;
  title: string;
  message: string;
  durationMs?: number;
};

type StatusToastContextType = {
  showToast: (input: ShowStatusToastInput) => void;
  hideToast: () => void;
};

const DEFAULT_DURATION_MS = 10000;

const initialToastState: ToastState = {
  visible: false,
  tone: "loading",
  title: "",
  message: "",
  durationMs: DEFAULT_DURATION_MS,
};

const StatusToastContext = createContext<StatusToastContextType | undefined>(undefined);

export function StatusToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(initialToastState);

  const hideToast = useCallback(() => {
    setToast((current) => {
      if (!current.visible) return current;
      return initialToastState;
    });
  }, []);

  const showToast = useCallback((input: ShowStatusToastInput) => {
    setToast({
      visible: true,
      tone: input.tone,
      title: input.title,
      message: input.message,
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
    });
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      hideToast,
    }),
    [hideToast, showToast],
  );

  return (
    <StatusToastContext.Provider value={value}>
      {children}
      <StatusToast
        visible={toast.visible}
        tone={toast.tone}
        title={toast.title}
        message={toast.message}
        durationMs={toast.durationMs}
        onClose={hideToast}
      />
    </StatusToastContext.Provider>
  );
}

export function useStatusToast() {
  const context = useContext(StatusToastContext);

  if (!context) {
    throw new Error("useStatusToast deve ser usado dentro de StatusToastProvider");
  }

  return context;
}
