import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Save, Trash2, Truck } from "lucide-react";
import { getVehicles } from "../../services/vehicles";
import {
  getVehicleImplements,
  syncVehicleImplements,
} from "../../services/vehicleImplements";
import type { Vehicle } from "../../types/vehicle";
import { useStatusToast } from "../../contexts/StatusToastContext";

type Props = {
  vehicle: Vehicle;
  onSaved?: () => void | Promise<void>;
};

function normalizeVehiclesResponse(response: unknown): Vehicle[] {
  if (Array.isArray(response)) return response;

  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { items?: unknown[] }).items)
  ) {
    return (response as { items: Vehicle[] }).items;
  }

  return [];
}

export function VehicleImplementsSection({ vehicle, onSaved }: Props) {
  const { showToast } = useStatusToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [linkedImplementIds, setLinkedImplementIds] = useState<string[]>([]);

  const isImplement = vehicle.category === "IMPLEMENT";

  useEffect(() => {
    if (!errorMessage) return;

    showToast({
      tone: "error",
      title: "Atenção",
      message: errorMessage,
    });
    setErrorMessage("");
  }, [errorMessage, showToast]);

  useEffect(() => {
    if (!successMessage) return;

    showToast({
      tone: "success",
      title: "Operação concluída",
      message: successMessage,
    });
    setSuccessMessage("");
  }, [showToast, successMessage]);


  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErrorMessage("");
        setSuccessMessage("");

        const [vehiclesResponse, linksResponse] = await Promise.all([
          getVehicles(),
          getVehicleImplements(vehicle.id),
        ]);

        const vehiclesList = normalizeVehiclesResponse(vehiclesResponse);

        setAllVehicles(vehiclesList);
        setLinkedImplementIds(
          (linksResponse?.implements || [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => item.implementId)
            .slice(0, 2),
        );
      } catch (error) {
        console.error("Erro ao carregar implementos do veículo:", error);
        setErrorMessage("Não foi possível carregar os implementos vinculados.");
      } finally {
        setLoading(false);
      }
    }

    if (vehicle?.id) {
      void load();
    }
  }, [vehicle?.id]);

  const availableImplements = useMemo(() => {
    return allVehicles
      .filter((item) => item.id !== vehicle.id)
      .filter((item) => item.category === "IMPLEMENT")
      .sort((a, b) =>
        `${a.plate} ${a.brand} ${a.model}`.localeCompare(
          `${b.plate} ${b.brand} ${b.model}`,
          "pt-BR",
          { numeric: true, sensitivity: "base" },
        ),
      );
  }, [allVehicles, vehicle.id]);

  const selectedImplements = useMemo(() => {
    return linkedImplementIds
      .map((id) => availableImplements.find((item) => item.id === id))
      .filter(Boolean) as Vehicle[];
  }, [availableImplements, linkedImplementIds]);

  function updateImplementAt(index: number, value: string) {
    setErrorMessage("");
    setSuccessMessage("");

    setLinkedImplementIds((current) => {
      const next = [...current];

      while (next.length <= index) {
        next.push("");
      }

      next[index] = value;

      return next.slice(0, 2);
    });
  }

  function removeImplementAt(index: number) {
    setErrorMessage("");
    setSuccessMessage("");
    setLinkedImplementIds((current) => current.filter((_, i) => i !== index));
  }

  function addEmptySlot() {
    setErrorMessage("");
    setSuccessMessage("");

    setLinkedImplementIds((current) => {
      if (current.length >= 2) return current;
      return [...current, ""];
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const cleanedIds = linkedImplementIds.filter(Boolean);

      if (new Set(cleanedIds).size !== cleanedIds.length) {
        setErrorMessage("Não é permitido selecionar o mesmo implemento duas vezes.");
        return;
      }

      await syncVehicleImplements(vehicle.id, {
        implementIds: cleanedIds,
      });

      setLinkedImplementIds(cleanedIds);
      setSuccessMessage(
        cleanedIds.length > 0
          ? "Implementos vinculados com sucesso."
          : "Implementos desvinculados com sucesso.",
      );

      if (onSaved) {
        await onSaved();
      }
    } catch (error: any) {
      console.error("Erro ao salvar implementos do veículo:", error);
      setErrorMessage(
        error?.response?.data?.message ||
          "Não foi possível salvar os implementos do veículo.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (isImplement) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
            <Truck size={20} />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Vinculação de implementos
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Implementos não podem receber outros implementos vinculados.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <Link2 size={20} />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Vincular implementos
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Vincule até 2 implementos para formar o conjunto do veículo e refletir a composição atual da frota.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={addEmptySlot}
          disabled={linkedImplementIds.length >= 2 || loading || saving}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Carregando implementos vinculados...
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {linkedImplementIds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Nenhum implemento vinculado.
            </div>
          ) : null}

          {selectedImplements.length > 0 ? (
            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
                Conjunto atual
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  Veículo: {vehicle.plate}
                </span>
                {selectedImplements.map((item, index) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700"
                  >
                    {index + 1}º implemento: {item.plate}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {linkedImplementIds.map((implementId, index) => {
            const selectedIdsExceptCurrent = linkedImplementIds.filter(
              (_, currentIndex) => currentIndex !== index,
            );

            return (
              <div
                key={`implement-slot-${index}`}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Implemento {index + 1}
                  </p>

                  <select
                    value={implementId}
                    onChange={(e) => updateImplementAt(index, e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Selecione um implemento</option>
                    {availableImplements
                      .filter(
                        (item) =>
                          !selectedIdsExceptCurrent.includes(item.id) ||
                          item.id === implementId,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.plate} · {item.brand} {item.model}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => removeImplementAt(index)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                    Remover
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar vínculos"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
