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

function getLinkedImplementIds(vehicle: Vehicle): string[] {
  return (vehicle.implements || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.implementId || item.implement?.id)
    .filter((id): id is string => Boolean(id))
    .slice(0, 2);
}

export function VehicleImplementsSection({ vehicle, onSaved }: Props) {
  const { showToast } = useStatusToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [linkedImplementIds, setLinkedImplementIds] = useState<string[]>([]);
  const [linkedVehicleId, setLinkedVehicleId] = useState("");

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

        if (vehicle.category === "IMPLEMENT") {
          const currentLinkedVehicle = vehiclesList.find((item) => {
            if (item.id === vehicle.id || item.category === "IMPLEMENT") return false;

            return getLinkedImplementIds(item).includes(vehicle.id);
          });

          setLinkedVehicleId(currentLinkedVehicle?.id || "");
          setLinkedImplementIds([]);
          return;
        }

        setLinkedVehicleId("");
        setLinkedImplementIds(
          (linksResponse?.implements || [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => item.implementId)
            .slice(0, 2),
        );
      } catch (error) {
        console.error("Erro ao carregar vínculos do veículo:", error);
        setErrorMessage("Não foi possível carregar os vínculos do veículo.");
      } finally {
        setLoading(false);
      }
    }

    if (vehicle?.id) {
      void load();
    }
  }, [vehicle?.id, vehicle.category]);

  const availableVehicles = useMemo(() => {
    return allVehicles
      .filter((item) => item.id !== vehicle.id)
      .filter((item) => item.category === "TRUCK")
      .sort((a, b) =>
        `${a.plate} ${a.brand} ${a.model}`.localeCompare(
          `${b.plate} ${b.brand} ${b.model}`,
          "pt-BR",
          { numeric: true, sensitivity: "base" },
        ),
      );
  }, [allVehicles, vehicle.id]);

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

  const selectedVehicle = useMemo(() => {
    if (!linkedVehicleId) return null;
    return availableVehicles.find((item) => item.id === linkedVehicleId) || null;
  }, [availableVehicles, linkedVehicleId]);

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

  async function handleSaveImplementVehicleLink() {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const previousLinkedVehicle = allVehicles.find((item) => {
        if (item.id === vehicle.id || item.category === "IMPLEMENT") return false;
        return getLinkedImplementIds(item).includes(vehicle.id);
      });

      if (previousLinkedVehicle && previousLinkedVehicle.id !== linkedVehicleId) {
        const previousLinks = await getVehicleImplements(previousLinkedVehicle.id);
        const previousIds = (previousLinks?.implements || [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((item) => item.implementId)
          .filter((id) => id !== vehicle.id);

        await syncVehicleImplements(previousLinkedVehicle.id, {
          implementIds: previousIds,
        });
      }

      if (linkedVehicleId) {
        const selectedLinks = await getVehicleImplements(linkedVehicleId);
        const currentIds = (selectedLinks?.implements || [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((item) => item.implementId);

        const nextIds = Array.from(new Set([...currentIds, vehicle.id]));

        if (nextIds.length > 2) {
          setErrorMessage("Este caminhão já possui 2 implementos vinculados.");
          return;
        }

        await syncVehicleImplements(linkedVehicleId, {
          implementIds: nextIds,
        });
      }

      setSuccessMessage(
        linkedVehicleId
          ? "Implemento vinculado ao caminhão com sucesso."
          : "Implemento desvinculado do caminhão com sucesso.",
      );

      if (onSaved) {
        await onSaved();
      }
    } catch (error: any) {
      console.error("Erro ao salvar vínculo do implemento:", error);
      setErrorMessage(
        error?.response?.data?.message ||
          "Não foi possível salvar o vínculo do implemento.",
      );
    } finally {
      setSaving(false);
    }
  }
    async function handleSaveVehicleImplements() {
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
      console.error("Erro ao salvar implementos:", error);
      setErrorMessage(
        error?.response?.data?.message ||
          "Não foi possível salvar os implementos.",
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // 🔥 UI IMPLEMENTO → CAMINHÃO
  // =========================
  if (isImplement) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
            <Truck size={20} />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Vincular a um caminhão
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Selecione o caminhão ao qual este implemento pertence.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">
            Carregando...
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {selectedVehicle ? (
              <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Vinculado atualmente
                </p>

                <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">
                  {selectedVehicle.plate} · {selectedVehicle.brand} {selectedVehicle.model}
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Nenhum caminhão vinculado.
              </div>
            )}

            <select
              value={linkedVehicleId}
              onChange={(e) => setLinkedVehicleId(e.target.value)}
              disabled={saving}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Selecione um caminhão</option>

              {availableVehicles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.plate} · {item.brand} {item.model}
                </option>
              ))}
            </select>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveImplementVehicleLink()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Salvando..." : "Salvar vínculo"}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  // =========================
  // 🔥 UI VEÍCULO → IMPLEMENTOS (ORIGINAL)
  // =========================
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
              Vincule até 2 implementos para formar o conjunto do veículo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={addEmptySlot}
          disabled={linkedImplementIds.length >= 2 || loading || saving}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {linkedImplementIds.map((implementId, index) => {
          const selectedIdsExceptCurrent = linkedImplementIds.filter(
            (_, i) => i !== index,
          );

          return (
            <div
              key={index}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
            >
              <select
                value={implementId}
                onChange={(e) => updateImplementAt(index, e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
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

              <button
                type="button"
                onClick={() => removeImplementAt(index)}
                className="text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveVehicleImplements()}
            className="bg-orange-500 text-white px-4 py-3 rounded-xl"
          >
            <Save size={16} />
            Salvar vínculos
          </button>
        </div>
      </div>
    </section>
  );
}