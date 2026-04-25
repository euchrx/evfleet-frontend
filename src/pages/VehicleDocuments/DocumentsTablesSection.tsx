import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { QuickStatusAction } from "../../components/QuickStatusAction";
import { TablePagination } from "../../components/TablePagination";
import { useCompanyScope } from "../../contexts/CompanyScopeContext";
import type { Driver } from "../../types/driver";
import type { Vehicle } from "../../types/vehicle";
import type {
    VehicleDocument,
    VehicleDocumentStatus,
    VehicleDocumentType,
} from "../../types/vehicle-document";

export type DocumentTab = "VEHICLE" | "DRIVER" | "GENERAL";
export type DocumentSortBy = "type" | "name" | "reference" | "expiryDate" | "status";

export type DocumentFilters = {
    vehicleId: string;
    driverId: string;
    type: VehicleDocumentType | "";
    status: VehicleDocumentStatus | "";
    issuer: string;
    startDate: string;
    endDate: string;
};

type SelectOption = {
    id: string;
    label: string;
};

type TypeOption = {
    value: VehicleDocumentType;
    label: string;
};

type Props = {
    activeTab: DocumentTab;
    loading: boolean;
    hasSearched: boolean;
    draftFilters: DocumentFilters;
    vehicles: Vehicle[];
    drivers: Driver[];
    typeOptions: TypeOption[];
    paginatedDocuments: VehicleDocument[];
    filteredDocumentsLength: number;
    selectedDocumentIds: string[];
    allDocumentsOnPageSelected: boolean;
    currentPage: number;
    totalPages: number;
    tablePageSize: number;
    quickStatusDocumentId: string | null;
    highlightedDocumentId: string | null;
    onFilterChange: <K extends keyof DocumentFilters>(
        field: K,
        value: DocumentFilters[K],
    ) => void;
    onConsult: () => void;
    onClearFilters: () => void;
    onToggleDocument: (id: string) => void;
    onToggleAllDocuments: () => void;
    onOpenEditSelected: () => void;
    onOpenBulkDelete: () => void;
    onOpenEdit: (item: VehicleDocument) => void;
    onDelete: (item: VehicleDocument) => void;
    onQuickStatusChange: (
        item: VehicleDocument,
        nextStatus: VehicleDocumentStatus,
    ) => Promise<void> | void;
    onPreviousPage: () => void;
    onNextPage: () => void;
    onSort: (column: DocumentSortBy) => void;
    getSortArrow: (column: DocumentSortBy) => string;
    getReferenceLabel: (item: VehicleDocument) => string;
    documentTypeLabel: (value?: VehicleDocumentType | null) => string;
    statusLabel: (status: VehicleDocumentStatus) => string;
    statusClass: (status: VehicleDocumentStatus) => string;
    getEffectiveStatus: (item: VehicleDocument) => VehicleDocumentStatus;
    resolveFileUrl: (fileUrl?: string | null) => string;
};

function toDateText(value?: string | null) {
    if (!value) return "-";

    const raw = String(value).slice(0, 10);
    const [year, month, day] = raw.split("-");

    if (!year || !month || !day) return "-";

    return `${day}/${month}/${year}`;
}

function toCsvValue(values: string[]) {
    return values.join(",");
}

function parseCsvValue(value?: string) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function CompactMultiSelectField({
    label,
    options,
    selectedIds,
    onChange,
    placeholder,
    disabled = false,
}: {
    label: string;
    options: SelectOption[];
    selectedIds: string[];
    onChange: (value: string[]) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const selectedOptions = useMemo(
        () => options.filter((item) => selectedIds.includes(item.id)),
        [options, selectedIds],
    );

    const filteredOptions = useMemo(() => {
        const normalized = query.trim().toLowerCase();

        return options
            .filter((item) => {
                if (selectedIds.includes(item.id)) return false;
                if (!normalized) return true;
                return item.label.toLowerCase().includes(normalized);
            })
            .slice(0, 10);
    }, [options, selectedIds, query]);

    function addItem(id: string) {
        if (disabled || selectedIds.includes(id)) return;

        onChange([...selectedIds, id]);
        setQuery("");
        setOpen(false);
    }

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (!containerRef.current) return;

            const target = event.target as Node;
            if (!containerRef.current.contains(target)) setOpen(false);
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }

        window.addEventListener("mousedown", handleOutsideClick);
        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("mousedown", handleOutsideClick);
            window.removeEventListener("keydown", handleEscape);
        };
    }, []);

    return (
        <div className="space-y-1.5">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
                {label}
            </label>

            <div ref={containerRef} className="relative">
                <div
                    className={`min-h-[40px] w-full rounded-xl border bg-white px-2.5 py-1.5 text-sm focus-within:ring-2 ${disabled
                            ? "border-slate-200 bg-slate-100"
                            : "border-slate-300 focus-within:border-orange-500 focus-within:ring-orange-200"
                        }`}
                    onClick={() => {
                        if (!disabled) {
                            containerRef.current?.querySelector("input")?.focus();
                            setOpen(true);
                        }
                    }}
                >
                    <div className="flex flex-wrap items-center gap-1.5">
                        {selectedOptions.map((item) => (
                            <span
                                key={item.id}
                                className="inline-flex cursor-default items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                onClick={(event) => event.stopPropagation()}
                            >
                                {item.label}

                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (!disabled) {
                                            onChange(selectedIds.filter((id) => id !== item.id));
                                        }
                                    }}
                                    className={`leading-none ${disabled
                                            ? "cursor-not-allowed opacity-50"
                                            : "cursor-pointer hover:text-red-600"
                                        }`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}

                        <input
                            value={query}
                            onChange={(event) => {
                                if (disabled) return;

                                setQuery(event.target.value);
                                setOpen(true);
                            }}
                            onFocus={() => {
                                if (!disabled) setOpen(true);
                            }}
                            onBlur={() => setTimeout(() => setOpen(false), 120)}
                            placeholder={selectedOptions.length === 0 ? placeholder : "Buscar..."}
                            disabled={disabled}
                            className="min-w-[96px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                {open && !disabled && filteredOptions.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                        {filteredOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    addItem(option.id);
                                }}
                                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function EmptyState({ hasSearched }: { hasSearched: boolean }) {
    return (
        <div className="px-6 py-12 text-center">
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8">
                <p className="text-base font-semibold text-slate-700">
                    {hasSearched
                        ? "Nenhum documento encontrado para os filtros informados."
                        : "Faça uma consulta para visualizar os documentos."}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                    Ajuste os filtros e tente novamente para localizar os registros desejados.
                </p>
            </div>
        </div>
    );
}

export function DocumentsTablesSection({
    activeTab,
    loading,
    hasSearched,
    draftFilters,
    vehicles,
    drivers,
    typeOptions,
    paginatedDocuments,
    filteredDocumentsLength,
    selectedDocumentIds,
    allDocumentsOnPageSelected,
    currentPage,
    totalPages,
    tablePageSize,
    quickStatusDocumentId,
    highlightedDocumentId,
    onFilterChange,
    onConsult,
    onClearFilters,
    onToggleDocument,
    onToggleAllDocuments,
    onOpenEditSelected,
    onOpenBulkDelete,
    onOpenEdit,
    onDelete,
    onQuickStatusChange,
    onPreviousPage,
    onNextPage,
    onSort,
    getSortArrow,
    getReferenceLabel,
    documentTypeLabel,
    statusLabel,
    statusClass,
    getEffectiveStatus,
    resolveFileUrl,
}: Props) {
    const { currentCompany } = useCompanyScope();

    const vehicleOptions = useMemo<SelectOption[]>(
        () =>
            vehicles.map((vehicle) => ({
                id: vehicle.id,
                label: `${vehicle.plate} • ${vehicle.brand} ${vehicle.model}`,
            })),
        [vehicles],
    );

    const driverOptions = useMemo<SelectOption[]>(
        () =>
            drivers.map((driver) => ({
                id: driver.id,
                label: driver.name,
            })),
        [drivers],
    );

    const documentTypeOptions = useMemo<SelectOption[]>(
        () => typeOptions.map((item) => ({ id: item.value, label: item.label })),
        [typeOptions],
    );

    const statusOptions: SelectOption[] = [
        { id: "VALID", label: "Válido" },
        { id: "EXPIRING", label: "Vencendo" },
        { id: "EXPIRED", label: "Vencido" },
    ];

    const selectedTypeIds = draftFilters.type ? [draftFilters.type] : [];
    const selectedStatusIds = draftFilters.status ? [draftFilters.status] : [];

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="p-4 sm:p-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1.5">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Empresa
                            </label>
                            <input
                                type="text"
                                value={currentCompany?.name || "Empresa não selecionada"}
                                disabled
                                className="h-10 w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-200 px-3 text-sm text-slate-600 outline-none"
                            />
                        </div>

                        {activeTab === "VEHICLE" ? (
                            <CompactMultiSelectField
                                label="Veículo"
                                options={vehicleOptions}
                                selectedIds={parseCsvValue(draftFilters.vehicleId)}
                                onChange={(value) => onFilterChange("vehicleId", toCsvValue(value))}
                                placeholder="Todos os veículos"
                            />
                        ) : null}

                        {activeTab === "DRIVER" ? (
                            <CompactMultiSelectField
                                label="Motorista"
                                options={driverOptions}
                                selectedIds={parseCsvValue(draftFilters.driverId)}
                                onChange={(value) => onFilterChange("driverId", toCsvValue(value))}
                                placeholder="Todos os motoristas"
                            />
                        ) : null}

                        <CompactMultiSelectField
                            label="Tipo"
                            options={documentTypeOptions}
                            selectedIds={selectedTypeIds}
                            onChange={(value) =>
                                onFilterChange("type", (value[0] || "") as VehicleDocumentType | "")
                            }
                            placeholder="Todos os tipos"
                        />

                        <CompactMultiSelectField
                            label="Status"
                            options={statusOptions}
                            selectedIds={selectedStatusIds}
                            onChange={(value) =>
                                onFilterChange("status", (value[0] || "") as VehicleDocumentStatus | "")
                            }
                            placeholder="Todos os status"
                        />

                        <div className="space-y-1.5">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Emissor
                            </label>
                            <input
                                type="text"
                                value={draftFilters.issuer}
                                onChange={(event) => onFilterChange("issuer", event.target.value)}
                                placeholder="Buscar por emissor"
                                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Data inicial
                            </label>
                            <input
                                type="date"
                                value={draftFilters.startDate}
                                onChange={(event) => onFilterChange("startDate", event.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                Data final
                            </label>
                            <input
                                type="date"
                                value={draftFilters.endDate}
                                onChange={(event) => onFilterChange("endDate", event.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-start">
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className="btn-ui btn-ui-neutral"
                        >
                            Limpar filtros
                        </button>

                        <button
                            type="button"
                            onClick={onConsult}
                            className="btn-ui btn-ui-primary"
                        >
                            Consultar
                        </button>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4">
                    {selectedDocumentIds.length > 0 ? (
                        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-red-700">
                                {selectedDocumentIds.length} documento(s) selecionado(s)
                            </p>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onOpenEditSelected}
                                    disabled={selectedDocumentIds.length !== 1}
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Editar selecionado
                                </button>

                                <button
                                    type="button"
                                    onClick={onOpenBulkDelete}
                                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                                >
                                    Excluir selecionados
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm font-semibold text-slate-700">
                            {filteredDocumentsLength} documento(s) encontrado(s)
                        </p>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={allDocumentsOnPageSelected}
                                        onChange={onToggleAllDocuments}
                                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                                        aria-label="Selecionar documentos da página"
                                    />
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    <button type="button" onClick={() => onSort("type")}>
                                        Tipo {getSortArrow("type")}
                                    </button>
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    <button type="button" onClick={() => onSort("name")}>
                                        Documento {getSortArrow("name")}
                                    </button>
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    <button type="button" onClick={() => onSort("reference")}>
                                        Referência {getSortArrow("reference")}
                                    </button>
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    <button type="button" onClick={() => onSort("expiryDate")}>
                                        Vencimento {getSortArrow("expiryDate")}
                                    </button>
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    <button type="button" onClick={() => onSort("status")}>
                                        Status {getSortArrow("status")}
                                    </button>
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    Arquivo
                                </th>

                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                    Ações
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                                        Carregando documentos...
                                    </td>
                                </tr>
                            ) : !hasSearched || paginatedDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>
                                        <EmptyState hasSearched={hasSearched} />
                                    </td>
                                </tr>
                            ) : (
                                paginatedDocuments.map((item) => {
                                    const effectiveStatus = getEffectiveStatus(item);
                                    const fileUrl = resolveFileUrl(item.fileUrl);

                                    return (
                                        <tr
                                            key={item.id}
                                            id={`vehicle-document-row-${item.id}`}
                                            className={`border-t border-slate-200 ${highlightedDocumentId === item.id ? "bg-orange-50" : ""
                                                }`}
                                        >
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocumentIds.includes(item.id)}
                                                    onChange={() => onToggleDocument(item.id)}
                                                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                                                    aria-label={`Selecionar documento ${item.name}`}
                                                />
                                            </td>

                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {documentTypeLabel(item.type)}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                <div className="font-semibold text-slate-800">{item.name}</div>
                                                {item.number ? (
                                                    <div className="text-xs text-slate-400">Nº {item.number}</div>
                                                ) : null}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {getReferenceLabel(item)}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {toDateText(item.expiryDate)}
                                            </td>

                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className={`status-pill ${statusClass(effectiveStatus)}`}>
                                                        {statusLabel(effectiveStatus)}
                                                    </span>

                                                    {effectiveStatus !== "VALID" ? (
                                                        <QuickStatusAction
                                                            label={`Atualizar status do documento ${item.name}`}
                                                            loading={quickStatusDocumentId === item.id}
                                                            options={[
                                                                { value: "VALID", label: "Marcar como válido" },
                                                                { value: "EXPIRING", label: "Marcar como vencendo" },
                                                                { value: "EXPIRED", label: "Marcar como vencido" },
                                                            ]}
                                                            onSelect={(value) =>
                                                                onQuickStatusChange(item, value as VehicleDocumentStatus)
                                                            }
                                                        />
                                                    ) : null}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-sm">
                                                {fileUrl ? (
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
                                                    >
                                                        Abrir
                                                        <ExternalLink size={14} />
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-slate-400">Sem arquivo</span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenEdit(item)}
                                                        className="btn-ui btn-ui-neutral"
                                                    >
                                                        Editar
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(item)}
                                                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                                                    >
                                                        Excluir
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && hasSearched && filteredDocumentsLength > 0 ? (
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredDocumentsLength}
                        pageSize={tablePageSize}
                        itemLabel="documentos"
                        onPrevious={onPreviousPage}
                        onNext={onNextPage}
                    />
                ) : null}
            </section>
        </div>
    );
}