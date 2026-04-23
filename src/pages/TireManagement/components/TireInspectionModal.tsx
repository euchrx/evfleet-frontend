import { useEffect, useMemo, useRef, useState } from "react";
import type { Tire } from "../../../types/tire";

export type TireInspectionForm = {
  vehicleId: string;
  tireIds: string[];
  readingDate: string;
  km: string;
  treadDepthMm: string;
  pressurePsi: string;
  condition: string;
  notes: string;
};

type Props = {
  open: boolean;
  tires: Tire[];
  form: TireInspectionForm;
  saving: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onChange: (updater: (current: TireInspectionForm) => TireInspectionForm) => void;
  onSubmit: () => void;
};

function tireOptionLabel(tire: Tire) {
  const vehicleLabel = tire.vehicle
    ? `${tire.vehicle.plate} • ${tire.vehicle.brand} ${tire.vehicle.model}`
    : "Sem veículo vinculado";

  return `${tire.serialNumber} • ${tire.brand} ${tire.model} • ${tire.size || "Sem medida"} • Aro ${tire.rim ?? "-"} • ${vehicleLabel}`;
}

function TireMultiSelectField({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
}: {
  label: string;
  options: Tire[];
  selectedIds: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
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
    return options.filter((item) => {
      if (selectedIds.includes(item.id)) return false;
      if (!normalized) return true;
      return tireOptionLabel(item).toLowerCase().includes(normalized);
    });
  }, [options, selectedIds, query]);

  function addItem(id: string) {
    if (selectedIds.includes(id)) return;
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
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div ref={containerRef} className="relative">
        <div
          className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200"
          onClick={() => setOpen(true)}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedOptions.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                {item.serialNumber}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(selectedIds.filter((id) => id !== item.id));
                  }}
                  className="cursor-pointer text-slate-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}

            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              placeholder={selectedOptions.length === 0 ? placeholder : "Digite para buscar..."}
              className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          </div>
        </div>

        {open && filteredOptions.length > 0 ? (
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
                title={tireOptionLabel(option)}
              >
                <span className="font-semibold text-slate-800">{option.serialNumber}</span>
                <span className="ml-2 text-slate-500">{option.brand} {option.model}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TireInspectionModal({
  open,
  tires,
  form,
  saving,
  errorMessage,
  onClose,
  onChange,
  onSubmit,
}: Props) {
  const orderedTires = useMemo(() => {
    return [...tires]
      .filter((tire) => tire.status !== "SCRAPPED")
      .sort((a, b) =>
        String(a.serialNumber || "").localeCompare(String(b.serialNumber || ""), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [tires]);

  const vehicleOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();

    orderedTires.forEach((tire) => {
      if (!tire.vehicleId || !tire.vehicle) return;
      if (map.has(tire.vehicleId)) return;

      const vehicle = tire.vehicle;
      const label = [vehicle.plate, [vehicle.brand, vehicle.model].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" • ");

      map.set(tire.vehicleId, {
        id: tire.vehicleId,
        label: label || "Veículo sem identificação",
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
  }, [orderedTires]);

  const visibleTires = useMemo(() => {
    if (!form.vehicleId) return orderedTires;
    return orderedTires.filter((tire) => tire.vehicleId === form.vehicleId);
  }, [orderedTires, form.vehicleId]);

  const selectedTires = useMemo(
    () => orderedTires.filter((tire) => form.tireIds.includes(tire.id)),
    [orderedTires, form.tireIds],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Aferir pneus</h2>
            <p className="mt-1 text-sm text-slate-500">
              Registre PSI atual, KM atual, sulco e observações da aferição.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Selecione um veículo
              </label>
              <select
                value={form.vehicleId}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    vehicleId: event.target.value,
                    tireIds: current.tireIds.filter((id) => {
                      if (!event.target.value) return true;
                      const tire = orderedTires.find((item) => item.id === id);
                      return tire?.vehicleId === event.target.value;
                    }),
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Todos os veículos</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <TireMultiSelectField
                label="Pneus"
                options={visibleTires}
                selectedIds={form.tireIds}
                onChange={(value) => onChange((current) => ({ ...current, tireIds: value }))}
                placeholder={form.vehicleId ? "Digite para buscar pneus do veículo" : "Digite para buscar pneus"}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Data da aferição
              </label>
              <input
                type="date"
                value={form.readingDate}
                onChange={(event) =>
                  onChange((current) => ({ ...current, readingDate: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                KM atual
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.km}
                onChange={(event) =>
                  onChange((current) => ({ ...current, km: event.target.value }))
                }
                placeholder="Ex.: 125000"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sulco atual (mm)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.treadDepthMm}
                onChange={(event) =>
                  onChange((current) => ({ ...current, treadDepthMm: event.target.value }))
                }
                placeholder="Ex.: 8.5"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                PSI atual
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.pressurePsi}
                onChange={(event) =>
                  onChange((current) => ({ ...current, pressurePsi: event.target.value }))
                }
                placeholder="Ex.: 95"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Condição
              </label>
              <input
                type="text"
                value={form.condition}
                onChange={(event) =>
                  onChange((current) => ({ ...current, condition: event.target.value }))
                }
                placeholder="Ex.: regular, calibrado, desgaste interno"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Observações
              </label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) =>
                  onChange((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Informações complementares da aferição"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          {selectedTires.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Pneus selecionados:</span> {selectedTires.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTires.map((tire) => (
                  <span
                    key={tire.id}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    title={tireOptionLabel(tire)}
                  >
                    {tire.serialNumber}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando aferição..." : "Salvar aferição"}
          </button>
        </div>
      </div>
    </div>
  );
}
