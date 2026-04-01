import { useMemo, useRef, useState } from "react";
import {
  confirmProductXmlImports,
  previewProductXml,
  type ProductXmlConfirmInvoice,
  type ProductXmlPreviewInvoice,
} from "../services/retailProducts";
import { ProductXmlImportModal } from "./ProductXmlImportModal";
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

function getItemKey(invoiceKey: string, lineIndex: number) {
  return `${invoiceKey}:${lineIndex}`;
}

function getErrorMessage(error: any) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Não foi possível processar os XMLs selecionados.";

  return Array.isArray(message) ? message.join(", ") : String(message);
}

export function ProductXmlImportButton({
  onImported,
}: {
  onImported: () => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(initialToastState);
  const [previewInvoices, setPreviewInvoices] = useState<ProductXmlPreviewInvoice[]>([]);
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
      window.setTimeout(() => setToast(initialToastState), autoHideMs);
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

  function buildDefaultSelection(invoices: ProductXmlPreviewInvoice[]) {
    const next = new Set<string>();

    invoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        if (item.importable && !item.duplicate) {
          next.add(getItemKey(invoice.invoiceKey, item.lineIndex));
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
        "Estamos analisando as NF-es e montando o preview dos produtos detectados.",
      );

      const preview = await previewProductXml(nextFiles);
      setPreviewInvoices(preview.invoices);
      setSelectedKeys(buildDefaultSelection(preview.invoices));
      setIsModalOpen(true);
      setToast(initialToastState);
    } catch (error: any) {
      showToast("error", "Falha no preview", getErrorMessage(error), 5000);
    } finally {
      setPreviewLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function toggleItem(invoiceKey: string, lineIndex: number) {
    const key = getItemKey(invoiceKey, lineIndex);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildConfirmPayload(): ProductXmlConfirmInvoice[] {
    return previewInvoices.map((invoice) => ({
      fileName: invoice.fileName,
      invoiceKey: invoice.invoiceKey,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      supplierName: invoice.supplierName,
      supplierDocument: invoice.supplierDocument,
      items: invoice.items.map((item) => ({
        ...item,
        selected: selectedKeys.has(getItemKey(invoice.invoiceKey, item.lineIndex)),
      })),
    }));
  }

  async function handleConfirmImport() {
    if (selectedCount === 0) return;

    try {
      setConfirmLoading(true);
      showToast(
        "loading",
        "Importando produtos",
        "Os itens selecionados estão sendo gravados em lote.",
      );

      const result = await confirmProductXmlImports(buildConfirmPayload());
      await onImported();

      resetPreviewState();
      showToast(
        "success",
        "Importação concluída",
        `${result.totalImported} item(ns) importado(s), ${result.totalDuplicated} duplicado(s) e ${result.totalIgnored} ignorado(s).`,
        5000,
      );
    } catch (error: any) {
      showToast("error", "Falha na importação", getErrorMessage(error), 5000);
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

      <ProductXmlImportModal
        isOpen={isModalOpen}
        invoices={previewInvoices}
        selectedKeys={selectedKeys}
        loading={confirmLoading}
        onClose={closeModal}
        onToggleItem={toggleItem}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
