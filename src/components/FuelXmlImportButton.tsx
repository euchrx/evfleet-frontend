import { useMemo, useRef, useState } from "react";
import {
  confirmFuelXmlImports,
  previewFuelXml,
  type FuelXmlConfirmInvoice,
  type FuelXmlPreviewInvoice,
} from "../services/fuelRecords";
import { FuelXmlImportModal } from "./FuelXmlImportModal";
import { StatusToast } from "./StatusToast";

type ToastState = {
  visible: boolean;
  tone: "loading" | "success" | "error";
  title: string;
  message: string;
};

const initialToastState: ToastState = {
  visible: false,
  tone: "loading",
  title: "",
  message: "",
};

function getPreviewErrorMessage(error: any) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Não foi possível gerar o preview dos XMLs.";

  return Array.isArray(message) ? message.join(", ") : String(message);
}

export function FuelXmlImportButton({
  onImported,
}: {
  onImported: () => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(initialToastState);
  const [previewInvoices, setPreviewInvoices] = useState<FuelXmlPreviewInvoice[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedCount = useMemo(() => selectedKeys.size, [selectedKeys]);

  function showToast(
    tone: ToastState["tone"],
    title: string,
    message: string,
    autoHideMs?: number,
  ) {
    setToast({ visible: true, tone, title, message });

    if (autoHideMs) {
      window.setTimeout(() => {
        setToast(initialToastState);
      }, autoHideMs);
    }
  }

  function openFilePicker() {
    if (previewLoading || confirmLoading) return;
    fileInputRef.current?.click();
  }

  function resetPreviewState() {
    setIsModalOpen(false);
    setPreviewInvoices([]);
    setSelectedKeys(new Set());
  }

  function closeModal() {
    if (confirmLoading) return;
    resetPreviewState();
  }

  function buildDefaultSelection(invoices: FuelXmlPreviewInvoice[]) {
    const next = new Set<string>();

    invoices.forEach((invoice) => {
      invoice.consolidated.forEach((group) => {
        if (group.importable && !group.duplicate) {
          next.add(group.groupKey);
        }
      });
    });

    return next;
  }

  async function handleFilesSelected(files: FileList | null) {
    const nextFiles = files ? Array.from(files).filter((file) => file.size > 0) : [];
    if (nextFiles.length === 0) return;

    try {
      setPreviewLoading(true);
      showToast(
        "loading",
        "Lendo XMLs",
        "Estamos analisando as NF-es e consolidando os abastecimentos detectados.",
      );

      const preview = await previewFuelXml(nextFiles);
      setPreviewInvoices(preview.invoices);
      setSelectedKeys(buildDefaultSelection(preview.invoices));
      setIsModalOpen(true);
      setToast(initialToastState);
    } catch (error: any) {
      showToast("error", "Falha no preview", getPreviewErrorMessage(error), 5000);
    } finally {
      setPreviewLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function toggleGroup(groupKey: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function buildConfirmPayload(): FuelXmlConfirmInvoice[] {
    return previewInvoices.map((invoice) => ({
      fileName: invoice.fileName,
      invoiceKey: invoice.invoiceKey,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      supplierName: invoice.supplierName,
      supplierDocument: invoice.supplierDocument,
      plate: invoice.plate,
      odometer: invoice.odometer,
      items: invoice.items,
      consolidated: invoice.consolidated.map((group) => ({
        ...group,
        selected: selectedKeys.has(group.groupKey),
      })),
    }));
  }

  async function handleConfirmImport() {
    if (selectedCount === 0) return;

    try {
      setConfirmLoading(true);
      showToast(
        "loading",
        "Importando abastecimentos",
        "Os grupos selecionados estão sendo gravados em lote.",
      );

      const result = await confirmFuelXmlImports(buildConfirmPayload());
      await onImported();

      resetPreviewState();
      showToast(
        "success",
        "Importação concluída",
        `${result.totalImported} abastecimento(s) importado(s), ${result.totalDuplicated} grupo(s) duplicado(s) e ${result.totalIgnored} grupo(s) ignorado(s).`,
        5000,
      );
    } catch (error: any) {
      showToast("error", "Falha na importação", getPreviewErrorMessage(error), 5000);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <>
      <StatusToast
        visible={toast.visible}
        tone={toast.tone}
        title={toast.title}
        message={toast.message}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        onChange={(event) => handleFilesSelected(event.target.files)}
        className="hidden"
      />

      <button
        type="button"
        onClick={openFilePicker}
        disabled={previewLoading || confirmLoading}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {previewLoading ? "Lendo XML..." : "Importar XML"}
      </button>

      <FuelXmlImportModal
        isOpen={isModalOpen}
        invoices={previewInvoices}
        selectedKeys={selectedKeys}
        loading={confirmLoading}
        onClose={closeModal}
        onToggleGroup={toggleGroup}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
