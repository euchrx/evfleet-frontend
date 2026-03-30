import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBranches } from "../../services/branches";
import { getDrivers } from "../../services/drivers";
import { getVehicles } from "../../services/vehicles";
import {
  completeXmlCostLink,
  completeXmlFuelLink,
  completeXmlMaintenanceLink,
  getXmlImportInvoiceById,
  type XmlInvoiceDetail,
} from "../../services/xmlImport";
import { formatDate } from "../../utils/formatters";

function formatInvoiceStatus(status?: string) {
  if (status === "AUTHORIZED") return "Autorizada";
  if (status === "CANCELED") return "Cancelada";
  if (status === "DENIED") return "Denegada";
  return "Desconhecida";
}

function statusBadgeClass(status?: string) {
  if (status === "AUTHORIZED") return "status-pill status-active";
  if (status === "CANCELED") return "status-pill status-inactive";
  if (status === "DENIED") return "status-pill status-anomaly";
  return "status-pill status-pending";
}

function formatProcessingType(type?: string | null) {
  if (type === "FUEL") return "Combustível";
  if (type === "PRODUCT") return "Produto";
  if (type === "SERVICE") return "Serviço";
  return "Não classificada";
}

function processingTypeBadgeClass(type?: string | null) {
  if (type === "FUEL") return "status-pill status-active";
  if (type === "PRODUCT") return "status-pill status-pending";
  if (type === "SERVICE") return "status-pill status-anomaly";
  return "status-pill";
}

function formatProcessingStatus(status?: string | null) {
  if (status === "PENDING") return "Pendente";
  if (status === "SUGGESTED") return "Sugerida";
  if (status === "PROCESSED") return "Processada";
  if (status === "IGNORED") return "Ignorada";
  if (status === "ERROR") return "Erro";
  return "Não definido";
}

function processingStatusBadgeClass(status?: string | null) {
  if (status === "PROCESSED") return "status-pill status-active";
  if (status === "IGNORED") return "status-pill";
  if (status === "ERROR") return "status-pill status-inactive";
  if (status === "SUGGESTED") return "status-pill status-pending";
  return "status-pill status-pending";
}

function formatAmountReais(value: string | number | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(String(value).replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(numeric)) return "-";

  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCompetencia(invoice?: XmlInvoiceDetail | null) {
  if (!invoice) return "-";
  const folder = String(invoice.folderName || "").trim();
  const fromFolder = folder.match(/\b(20\d{2})(0[1-9]|1[0-2])\b/);
  if (fromFolder) return `${fromFolder[1]}/${fromFolder[2]}`;

  if (invoice.issuedAt) {
    const date = new Date(invoice.issuedAt);
    if (!Number.isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      return `${y}/${m}`;
    }
  }

  return "-";
}

export function XmlInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [savingLink, setSavingLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [invoice, setInvoice] = useState<XmlInvoiceDetail | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [fuelForm, setFuelForm] = useState({
    vehicleId: "",
    driverId: "",
    km: "",
    branchId: "",
  });
  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicleId: "",
    branchId: "",
    descriptionComplement: "",
  });
  const [costForm, setCostForm] = useState({
    vehicleId: "",
    branchId: "",
    category: "",
  });

  useEffect(() => {
    async function loadInvoiceDetail() {
      if (!id) {
        setErrorMessage("ID da nota não informado.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErrorMessage("");
        const [detail, nextVehicles, nextDrivers, nextBranches] = await Promise.all([
          getXmlImportInvoiceById(id),
          getVehicles(),
          getDrivers(),
          getBranches(),
        ]);
        setInvoice(detail);
        setVehicles(nextVehicles);
        setDrivers(nextDrivers);
        setBranches(nextBranches);
        setFuelForm({
          vehicleId: detail.linkedFuelRecord?.vehicleId || "",
          driverId: detail.linkedFuelRecord?.driverId || "",
          km:
            typeof detail.linkedFuelRecord?.km === "number"
              ? String(detail.linkedFuelRecord.km)
              : "",
          branchId: detail.branchId || "",
        });
        setMaintenanceForm({
          vehicleId: detail.linkedMaintenanceRecord?.vehicleId || "",
          branchId: detail.branchId || "",
          descriptionComplement: "",
        });
        setCostForm({
          vehicleId: detail.linkedCost?.vehicleId || "",
          branchId: detail.branchId || "",
          category: detail.linkedCost?.category || "",
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os detalhes da nota.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvoiceDetail();
  }, [id]);

  const operationalLinks = useMemo(() => {
    if (!invoice) return [];
    const links = [];
    if (invoice.linkedFuelRecordId) {
      links.push({ label: "Abastecimento criado", value: invoice.linkedFuelRecordId });
    }
    if (invoice.linkedMaintenanceRecordId) {
      links.push({ label: "Manutenção criada", value: invoice.linkedMaintenanceRecordId });
    }
    if (invoice.linkedCostId) {
      links.push({ label: "Custo criado", value: invoice.linkedCostId });
    }
    return links;
  }, [invoice]);

  const fuelLinkComplete = Boolean(invoice?.linkedFuelRecord?.vehicleId);
  const maintenanceLinkComplete = Boolean(invoice?.linkedMaintenanceRecord?.vehicleId);
  const costLinkComplete = Boolean(invoice?.linkedCost?.vehicleId && invoice?.branchId);

  async function reloadInvoice() {
    if (!id) return;
    const detail = await getXmlImportInvoiceById(id);
    setInvoice(detail);
  }

  async function handleCompleteFuelLink() {
    if (!id || !fuelForm.vehicleId) {
      setErrorMessage("Selecione um veículo para completar o abastecimento.");
      return;
    }

    try {
      setSavingLink(true);
      setErrorMessage("");
      setSuccessMessage("");
      await completeXmlFuelLink(id, {
        vehicleId: fuelForm.vehicleId,
        ...(fuelForm.driverId ? { driverId: fuelForm.driverId } : {}),
        ...(fuelForm.km ? { km: Number(fuelForm.km) } : {}),
        ...(fuelForm.branchId ? { branchId: fuelForm.branchId } : {}),
      });
      await reloadInvoice();
      setSuccessMessage("Vínculo de abastecimento completado com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível completar o vínculo.",
      );
    } finally {
      setSavingLink(false);
    }
  }

  async function handleCompleteMaintenanceLink() {
    if (!id || !maintenanceForm.vehicleId) {
      setErrorMessage("Selecione um veículo para completar a manutenção.");
      return;
    }

    try {
      setSavingLink(true);
      setErrorMessage("");
      setSuccessMessage("");
      await completeXmlMaintenanceLink(id, {
        vehicleId: maintenanceForm.vehicleId,
        ...(maintenanceForm.branchId ? { branchId: maintenanceForm.branchId } : {}),
        ...(maintenanceForm.descriptionComplement
          ? { descriptionComplement: maintenanceForm.descriptionComplement }
          : {}),
      });
      await reloadInvoice();
      setSuccessMessage("Vínculo de manutenção completado com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível completar o vínculo.",
      );
    } finally {
      setSavingLink(false);
    }
  }

  async function handleCompleteCostLink() {
    if (!id) return;
    try {
      setSavingLink(true);
      setErrorMessage("");
      setSuccessMessage("");
      await completeXmlCostLink(id, {
        ...(costForm.vehicleId ? { vehicleId: costForm.vehicleId } : {}),
        ...(costForm.branchId ? { branchId: costForm.branchId } : {}),
        ...(costForm.category ? { category: costForm.category } : {}),
      });
      await reloadInvoice();
      setSuccessMessage("Vínculo de custo completado com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível completar o vínculo.",
      );
    } finally {
      setSavingLink(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Detalhe da nota XML</h1>
          <p className="text-sm text-slate-500">
            Conferência completa da NF-e importada e seu status operacional.
          </p>
        </div>
        <Link
          to="/xml-import"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando detalhes da nota...</p>
        ) : !invoice ? (
          <p className="text-sm text-slate-500">Nota não encontrada.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Competência</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatCompetencia(invoice)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Número / Série</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {invoice.number || "-"} / {invoice.series || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {formatDate(invoice.issuedAt || undefined)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {formatAmountReais(invoice.totalAmount)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emitente</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{invoice.issuerName || "-"}</p>
                <p className="mt-1 text-sm text-slate-600">{invoice.issuerDocument || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destinatário</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{invoice.recipientName || "-"}</p>
                <p className="mt-1 text-sm text-slate-600">{invoice.recipientDocument || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protocolo</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                  {invoice.protocolNumber || "-"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Status da nota</p>
                  <span className={statusBadgeClass(invoice.invoiceStatus)}>
                    {formatInvoiceStatus(invoice.invoiceStatus)}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de processamento</p>
                  <span className={processingTypeBadgeClass(invoice.processingType)}>
                    {formatProcessingType(invoice.processingType)}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Situação</p>
                  <span className={processingStatusBadgeClass(invoice.processingStatus)}>
                    {formatProcessingStatus(invoice.processingStatus)}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Processada em</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(invoice.processedAt || undefined)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chave da NF-e</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">{invoice.invoiceKey}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-bold text-slate-900">Vínculo operacional</p>
              {operationalLinks.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum vínculo operacional criado.</p>
              ) : (
                <div className="grid gap-2">
                  {operationalLinks.map((link) => (
                    <div
                      key={`${link.label}-${link.value}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {link.label}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">{link.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {invoice.linkedFuelRecordId ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">Completar vínculo do abastecimento</p>
                {fuelLinkComplete ? (
                  <p className="text-sm text-emerald-700">Vínculo já completo para abastecimento.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={fuelForm.vehicleId}
                      onChange={(event) =>
                        setFuelForm((prev) => ({ ...prev, vehicleId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map((vehicle: any) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} • {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                    <select
                      value={fuelForm.driverId}
                      onChange={(event) =>
                        setFuelForm((prev) => ({ ...prev, driverId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione um motorista</option>
                      {drivers.map((driver: any) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={fuelForm.km}
                      onChange={(event) =>
                        setFuelForm((prev) => ({ ...prev, km: event.target.value }))
                      }
                      placeholder="KM"
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                    <select
                      value={fuelForm.branchId}
                      onChange={(event) =>
                        setFuelForm((prev) => ({ ...prev, branchId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione a filial</option>
                      {branches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={savingLink}
                      onClick={handleCompleteFuelLink}
                      className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingLink ? "Salvando..." : "Completar vínculo"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {invoice.linkedMaintenanceRecordId ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">Completar vínculo da manutenção</p>
                {maintenanceLinkComplete ? (
                  <p className="text-sm text-emerald-700">Vínculo já completo para manutenção.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={maintenanceForm.vehicleId}
                      onChange={(event) =>
                        setMaintenanceForm((prev) => ({ ...prev, vehicleId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map((vehicle: any) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} • {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                    <select
                      value={maintenanceForm.branchId}
                      onChange={(event) =>
                        setMaintenanceForm((prev) => ({ ...prev, branchId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione a filial</option>
                      {branches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={maintenanceForm.descriptionComplement}
                      onChange={(event) =>
                        setMaintenanceForm((prev) => ({
                          ...prev,
                          descriptionComplement: event.target.value,
                        }))
                      }
                      placeholder="Descrição complementar"
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    />
                    <button
                      type="button"
                      disabled={savingLink}
                      onClick={handleCompleteMaintenanceLink}
                      className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingLink ? "Salvando..." : "Completar vínculo"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {invoice.linkedCostId ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">Completar vínculo do custo</p>
                {costLinkComplete ? (
                  <p className="text-sm text-emerald-700">Vínculo já completo para custo.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={costForm.vehicleId}
                      onChange={(event) =>
                        setCostForm((prev) => ({ ...prev, vehicleId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map((vehicle: any) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate} • {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                    </select>
                    <select
                      value={costForm.branchId}
                      onChange={(event) =>
                        setCostForm((prev) => ({ ...prev, branchId: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione a filial</option>
                      {branches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={costForm.category}
                      onChange={(event) =>
                        setCostForm((prev) => ({ ...prev, category: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Selecione a categoria</option>
                      <option value="FINE">Multa</option>
                      <option value="IPVA">IPVA</option>
                      <option value="LICENSING">Licenciamento</option>
                      <option value="INSURANCE">Seguro</option>
                      <option value="TOLL">Pedágio</option>
                      <option value="TAX">Imposto</option>
                      <option value="OTHER">Outro</option>
                    </select>
                    <button
                      type="button"
                      disabled={savingLink}
                      onClick={handleCompleteCostLink}
                      className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingLink ? "Salvando..." : "Completar vínculo"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Itens da nota</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Código</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Descrição</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Quantidade</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Valor unitário</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Nenhum item encontrado para esta nota.
                        </td>
                      </tr>
                    ) : (
                      invoice.items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-700">{item.productCode || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{item.description}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {item.quantity ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {formatAmountReais(item.unitValue)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {formatAmountReais(item.totalValue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
