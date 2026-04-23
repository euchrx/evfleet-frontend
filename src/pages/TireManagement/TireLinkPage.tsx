import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createTireMovement, getTireMovements } from "../../services/tireMovements";
import { getTires, updateTire } from "../../services/tires";
import { getVehicles } from "../../services/vehicles";
import { getVehicleImplements } from "../../services/vehicleImplements";
import type { Tire } from "../../types/tire";
import type { Vehicle } from "../../types/vehicle";
import { buildCompositionTireLayoutProfile } from "./components/tireLinkProfiles";

function slotKey(axlePosition: string, wheelPosition: string) {
  return `${axlePosition}::${wheelPosition}`;
}

function vehicleLabel(vehicle: Vehicle) {
  return `${vehicle.plate} • ${vehicle.brand} ${vehicle.model}`;
}

function tireStatusLabel(status?: string | null) {
  if (status === "INSTALLED") return "Instalado";
  if (status === "MAINTENANCE") return "Manutenção";
  if (status === "RETREADED") return "Recapado";
  if (status === "SCRAPPED") return "Descartado";
  return "Estoque";
}

export function TireLinkPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tires, setTires] = useState<Tire[]>([]);
  const [draggingTireId, setDraggingTireId] = useState<string | null>(null);
  const [isStockDropActive, setIsStockDropActive] = useState(false);
  const [placements, setPlacements] = useState<Record<string, string | null>>({});
  const [initialPlacements, setInitialPlacements] = useState<Record<string, string | null>>({});
  const [selectedTireId, setSelectedTireId] = useState<string | null>(null);
  const [linkedImplements, setLinkedImplements] = useState<Vehicle[]>([]);

  const initialTargetSearch = searchParams.get("search") || "";
  const [targetSearch, setTargetSearch] = useState(initialTargetSearch);
  const [targetTypeFilter, setTargetTypeFilter] = useState<"ALL" | "VEHICLE" | "IMPLEMENT">("ALL");
  const [availableSearch, setAvailableSearch] = useState("");

  const selectedVehicleId = searchParams.get("vehicleId") || "";
  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null;

  const availableTargetVehicles = useMemo(() => {
    const linkedImplementIds = new Set(
      vehicles
        .filter((vehicle) => vehicle.category !== "IMPLEMENT")
        .flatMap((vehicle) => (vehicle.implements ?? []).map((item) => item.implementId)),
    );

    const normalizedSearch = targetSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return vehicles
      .filter((vehicle) => {
        const isImplement = vehicle.category === "IMPLEMENT";

        if (isImplement && linkedImplementIds.has(vehicle.id) && vehicle.id !== selectedVehicleId) {
          return false;
        }

        if (targetTypeFilter === "VEHICLE" && isImplement) return false;
        if (targetTypeFilter === "IMPLEMENT" && !isImplement) return false;

        if (!normalizedSearch) return true;

        const haystack = [
          vehicle.plate,
          vehicle.brand,
          vehicle.model,
          isImplement ? "implemento" : "veiculo",
        ]
          .filter(Boolean)
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) =>
        vehicleLabel(a).localeCompare(vehicleLabel(b), "pt-BR", {
          sensitivity: "base",
          numeric: true,
        }),
      );
  }, [vehicles, selectedVehicleId, targetSearch, targetTypeFilter]);

  const profile = useMemo(() => {
    return buildCompositionTireLayoutProfile({
      mainVehicle: selectedVehicle,
      linkedImplements,
    });
  }, [selectedVehicle, linkedImplements]);

  const groupedAxles = useMemo(() => {
    const map = new Map<
      string,
      {
        axlePosition: string;
        slots: typeof profile.slots;
      }
    >();

    for (const slot of profile.slots) {
      const key = slot.axlePosition;

      if (!map.has(key)) {
        map.set(key, {
          axlePosition: slot.axlePosition,
          slots: [],
        });
      }

      map.get(key)!.slots.push(slot);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.axlePosition.localeCompare(b.axlePosition, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [profile]);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [vehiclesData, tiresData] = await Promise.all([getVehicles(), getTires()]);
      const vehiclesList = Array.isArray(vehiclesData)
        ? vehiclesData
        : Array.isArray((vehiclesData as any)?.items)
          ? (vehiclesData as any).items
          : [];

      setVehicles(vehiclesList);
      setTires(Array.isArray(tiresData) ? tiresData : []);
    } catch (error) {
      console.error("Erro ao carregar vinculação de pneus:", error);
      setErrorMessage("Não foi possível carregar a vinculação de pneus.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadLinkedImplements() {
      if (!selectedVehicleId) {
        setLinkedImplements([]);
        return;
      }

      try {
        const response = await getVehicleImplements(selectedVehicleId);
        const nextLinkedImplements = (response?.implements || [])
          .sort((a, b) => a.position - b.position)
          .map((item) => item.implement)
          .filter(Boolean);

        setLinkedImplements(nextLinkedImplements);
      } catch (error) {
        console.error("Erro ao carregar implementos vinculados do veículo:", error);
        setLinkedImplements([]);
      }
    }

    loadLinkedImplements();
  }, [selectedVehicleId]);

  useEffect(() => {
    const next: Record<string, string | null> = {};

    profile.slots.forEach((slot) => {
      next[slotKey(slot.axlePosition, slot.wheelPosition)] = null;
    });

    tires
      .filter((tire) => tire.vehicleId === selectedVehicleId)
      .forEach((tire) => {
        if (!tire.axlePosition || !tire.wheelPosition) return;
        const key = slotKey(tire.axlePosition, tire.wheelPosition);
        if (key in next) next[key] = tire.id;
      });

    setPlacements(next);
    setInitialPlacements(next);
    setSelectedTireId(null);
  }, [selectedVehicleId, tires, profile]);

  const placedTireIds = useMemo(() => {
    return new Set(
      Object.values(placements).filter((value): value is string => Boolean(value)),
    );
  }, [placements]);

  const availableTires = useMemo(() => {
    const search = availableSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return tires
      .filter((tire) => {
        if (tire.status === "SCRAPPED") return false;
        if (placedTireIds.has(tire.id)) return false;

        const canBeUsed =
          !tire.vehicleId ||
          tire.status === "IN_STOCK" ||
          tire.vehicleId === selectedVehicleId;

        if (!canBeUsed) return false;

        if (!search) return true;

        const haystack = [
          tire.serialNumber,
          tire.brand,
          tire.model,
          tire.size,
          tire.rim != null ? `aro ${tire.rim}` : "",
          tire.currentKm != null ? String(tire.currentKm) : "",
          tire.targetPressurePsi != null ? String(tire.targetPressurePsi) : "",
          tireStatusLabel(tire.status),
        ]
          .filter(Boolean)
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a, b) =>
        String(b.serialNumber ?? "").localeCompare(String(a.serialNumber ?? ""), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [tires, selectedVehicleId, placedTireIds, availableSearch]);

  const selectedTire = tires.find((tire) => tire.id === selectedTireId) || null;

  const pendingChanges = useMemo(() => {
    const keys = new Set([...Object.keys(initialPlacements), ...Object.keys(placements)]);
    return Array.from(keys).filter((key) => initialPlacements[key] !== placements[key]);
  }, [initialPlacements, placements]);

  function assignTireToSlot(tireId: string, nextKey: string | null) {
    setPlacements((current) => {
      const next = { ...current };

      const currentKey =
        Object.entries(next).find(([, id]) => id === tireId)?.[0] || null;

      if (!nextKey) {
        if (currentKey) {
          next[currentKey] = null;
        }
        return next;
      }

      const occupyingTireId = next[nextKey];

      if (currentKey === nextKey) {
        return next;
      }

      if (currentKey) {
        next[currentKey] = occupyingTireId || null;
      }

      next[nextKey] = tireId;

      return next;
    });

    setSelectedTireId(tireId);
  }

  async function handleSave() {
    if (!selectedVehicle) return;

    try {
      setSaving(true);
      setErrorMessage("");
      const movementHistory = await getTireMovements({ vehicleId: selectedVehicle.id });

      const updates = tires
        .filter((tire) => {
          const previous = Object.entries(initialPlacements).find(([, id]) => id === tire.id)?.[0] || null;
          const next = Object.entries(placements).find(([, id]) => id === tire.id)?.[0] || null;
          const wasOnVehicle = tire.vehicleId === selectedVehicle.id || previous !== null;
          return wasOnVehicle || next !== null;
        })
        .map(async (tire) => {
          const previousKey =
            Object.entries(initialPlacements).find(([, id]) => id === tire.id)?.[0] || null;
          const nextKey =
            Object.entries(placements).find(([, id]) => id === tire.id)?.[0] || null;

          if (previousKey === nextKey) return;

          const previousSlot = profile.slots.find(
            (slot) => slotKey(slot.axlePosition, slot.wheelPosition) === previousKey,
          );
          const nextSlot = profile.slots.find(
            (slot) => slotKey(slot.axlePosition, slot.wheelPosition) === nextKey,
          );

          await updateTire(tire.id, {
            vehicleId: nextSlot ? selectedVehicle.id : null,
            axlePosition: nextSlot ? nextSlot.axlePosition : "STOCK",
            wheelPosition: nextSlot ? nextSlot.wheelPosition : "STOCK",
            status: nextSlot ? "INSTALLED" : "IN_STOCK",
          });

          const lastMovement = movementHistory
            .slice()
            .reverse()
            .find((movement) => movement.tireId === tire.id);

          await createTireMovement({
            vehicleId: selectedVehicle.id,
            tireId: tire.id,
            type: "MOVE",
            tireSerial: tire.serialNumber,
            fromAxle: previousSlot?.axlePosition || lastMovement?.fromAxle || "STOCK",
            fromWheel: previousSlot?.wheelPosition || lastMovement?.fromWheel || "STOCK",
            toAxle: nextSlot?.axlePosition || "STOCK",
            toWheel: nextSlot?.wheelPosition || "STOCK",
            note: "Vinculação pelo mapa de pneus",
          });
        });

      await Promise.all(updates);
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar vinculação de pneus:", error);
      setErrorMessage("Não foi possível salvar a vinculação dos pneus.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Carregando vinculação de pneus...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={() => navigate("/tire-management")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:text-orange-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
      </div>

      <section>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Mapa de pneus por veículo</h1>
            <p className="mt-1 text-slate-500">
              Busque e selecione um veículo ou implemento disponível para abrir a montagem dos pneus.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_1fr_auto_auto]">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={targetSearch}
              onChange={(event) => setTargetSearch(event.target.value)}
              placeholder="Buscar por placa, marca ou modelo..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <select
            value={targetTypeFilter}
            onChange={(event) =>
              setTargetTypeFilter(event.target.value as "ALL" | "VEHICLE" | "IMPLEMENT")
            }
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos</option>
            <option value="VEHICLE">Veículos</option>
            <option value="IMPLEMENT">Implementos</option>
          </select>

          <select
            value={selectedVehicleId}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set("vehicleId", event.target.value);
              else next.delete("vehicleId");
              setSearchParams(next);
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="">Selecione um veículo ou implemento</option>
            {availableTargetVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
                {vehicle.category === "IMPLEMENT" ? " • Implemento" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchParams(new URLSearchParams());
              setTargetSearch("");
              setTargetTypeFilter("ALL");
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Trocar veículo
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedVehicleId || pendingChanges.length === 0 || saving}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar vinculação"}
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
      </section>

      {!selectedVehicle ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Nenhum veículo selecionado.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_420px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Posições do veículo</h2>
                <p className="text-sm text-slate-500">
                  Arraste um pneu disponível e solte na posição desejada.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{profile.label}</p>
                <p>{profile.description}</p>
                {linkedImplements.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {linkedImplements.map((implement, index) => (
                      <p key={implement.id}>
                        Implemento {index + 1}: {vehicleLabel(implement)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              {groupedAxles.map((axle) => {
                const leftSlots = axle.slots.filter((slot) =>
                  slot.wheelPosition.toLowerCase().includes("esquerdo"),
                );

                const rightSlots = axle.slots.filter((slot) =>
                  slot.wheelPosition.toLowerCase().includes("direito"),
                );

                const getPriority = (wheelPosition: string) => {
                  const value = wheelPosition.toLowerCase();

                  if (value.includes("lado esquerdo")) return 0;
                  if (value.includes("lado direito")) return 0;

                  if (value.includes("externo esquerdo")) return 1;
                  if (value.includes("externo direito")) return 1;

                  if (value.includes("interno esquerdo")) return 2;
                  if (value.includes("interno direito")) return 2;

                  return 99;
                };

                const sortedLeftSlots = [...leftSlots].sort(
                  (a, b) => getPriority(a.wheelPosition) - getPriority(b.wheelPosition),
                );

                const sortedRightSlots = [...rightSlots].sort(
                  (a, b) => getPriority(a.wheelPosition) - getPriority(b.wheelPosition),
                );

                const isSimpleAxle =
                  sortedLeftSlots.length <= 1 && sortedRightSlots.length <= 1;

                const getLeftSlot = (kind: "single" | "external" | "internal") => {
                  if (kind === "single") {
                    return sortedLeftSlots[0] || null;
                  }

                  if (kind === "external") {
                    return (
                      sortedLeftSlots.find((slot) =>
                        slot.wheelPosition.toLowerCase().includes("externo"),
                      ) || null
                    );
                  }

                  return (
                    sortedLeftSlots.find((slot) =>
                      slot.wheelPosition.toLowerCase().includes("interno"),
                    ) || null
                  );
                };

                const getRightSlot = (kind: "single" | "internal" | "external") => {
                  if (kind === "single") {
                    return sortedRightSlots[0] || null;
                  }

                  if (kind === "internal") {
                    return (
                      sortedRightSlots.find((slot) =>
                        slot.wheelPosition.toLowerCase().includes("interno"),
                      ) || null
                    );
                  }

                  return (
                    sortedRightSlots.find((slot) =>
                      slot.wheelPosition.toLowerCase().includes("externo"),
                    ) || null
                  );
                };

                const renderSlotCard = (
                  slot: (typeof axle.slots)[number] | null,
                  displayLabel: string,
                ) => {
                  if (!slot) {
                    return <div />;
                  }

                  const key = slotKey(slot.axlePosition, slot.wheelPosition);
                  const tireId = placements[key];
                  const tire = tires.find((item) => item.id === tireId) || null;

                  return (
                    <div
                      key={key}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const droppedTireId =
                          event.dataTransfer.getData("text/plain") || draggingTireId;

                        if (droppedTireId) {
                          assignTireToSlot(droppedTireId, key);
                        }

                        setDraggingTireId(null);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        tire
                          ? "border-slate-200 bg-slate-50 hover:border-orange-200"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{displayLabel}</p>

                          {slot.sourceVehicleLabel ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {slot.sourceType === "IMPLEMENT" ? "Implemento" : "Veículo"} •{" "}
                              {slot.sourceVehicleLabel}
                            </p>
                          ) : null}

                          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                            {tire ? (
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                  setDraggingTireId(tire.id);
                                  event.dataTransfer.setData("text/plain", tire.id);
                                }}
                                onDragEnd={() => setDraggingTireId(null)}
                                onClick={() => setSelectedTireId(tire.id)}
                                className="w-full text-left"
                              >
                                <p className="font-semibold text-slate-900">
                                  {tire.serialNumber}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {tire.brand} {tire.model}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                                    {tire.size || "Sem medida"}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                                    Aro {tire.rim ?? "-"}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                                    KM {tire.currentKm?.toLocaleString("pt-BR") ?? "0"}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                                    PSI alvo {tire.targetPressurePsi ?? "-"}
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <span>Posição livre</span>
                            )}
                          </div>
                        </div>

                        {tire ? (
                          <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {tireStatusLabel(tire.status)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                };

                return (
                  <div
                    key={axle.axlePosition}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {axle.axlePosition}
                      </p>
                    </div>

                    {isSimpleAxle ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {renderSlotCard(getLeftSlot("single"), "Lado esquerdo")}
                        {renderSlotCard(getRightSlot("single"), "Lado direito")}
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-4">
                        {renderSlotCard(getLeftSlot("external"), "Lado externo esquerdo")}
                        {renderSlotCard(getLeftSlot("internal"), "Lado interno esquerdo")}
                        {renderSlotCard(getRightSlot("internal"), "Lado interno direito")}
                        {renderSlotCard(getRightSlot("external"), "Lado externo direito")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-5">
            <section
              onDragEnter={() => setIsStockDropActive(true)}
              onDragLeave={() => setIsStockDropActive(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsStockDropActive(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsStockDropActive(false);

                const droppedTireId =
                  event.dataTransfer.getData("text/plain") || draggingTireId;

                if (droppedTireId) {
                  assignTireToSlot(droppedTireId, null);
                }

                setDraggingTireId(null);
              }}
              className={`rounded-3xl border-2 border-dashed p-6 shadow-sm transition ${
                isStockDropActive
                  ? "scale-[1.01] border-emerald-500 bg-emerald-100 shadow-md"
                  : "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-400 hover:shadow-md"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-white shadow-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-8 w-8 text-emerald-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v10m0 0l-3-3m3 3l3-3M5 15v2a2 2 0 002 2h10a2 2 0 002-2v-2"
                    />
                  </svg>
                </div>

                <p className="mt-4 text-lg font-bold text-emerald-800">
                  Arraste o pneu para o estoque
                </p>

                <p className="mt-2 max-w-md text-sm text-emerald-700">
                  Solte aqui para remover o pneu da posição atual e enviá-lo para o estoque.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">Disponíveis</h3>
                <p className="text-sm text-slate-500">
                  Selecione ou arraste os pneus para o mapa do veículo.
                </p>
              </div>

              <div className="mb-4 relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={availableSearch}
                  onChange={(event) => setAvailableSearch(event.target.value)}
                  placeholder="Buscar por serial, marca, modelo, medida, aro, km..."
                  className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>

              <div className="space-y-3">
                {availableTires.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum pneu disponível para vincular.
                  </p>
                ) : (
                  availableTires.map((tire) => (
                    <button
                      key={tire.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        setDraggingTireId(tire.id);
                        event.dataTransfer.setData("text/plain", tire.id);
                      }}
                      onDragEnd={() => setDraggingTireId(null)}
                      onClick={() => setSelectedTireId(tire.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedTireId === tire.id
                          ? "border-orange-300 bg-orange-50"
                          : "border-slate-200 bg-slate-50 hover:border-orange-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{tire.serialNumber}</p>
                          <p className="text-sm text-slate-500">
                            {tire.brand} {tire.model}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-white px-2 py-1 border border-slate-200">
                              {tire.size || "Sem medida"}
                            </span>
                            <span className="rounded-full bg-white px-2 py-1 border border-slate-200">
                              Aro {tire.rim ?? "-"}
                            </span>
                            <span className="rounded-full bg-white px-2 py-1 border border-slate-200">
                              KM {tire.currentKm?.toLocaleString("pt-BR") ?? "0"}
                            </span>
                            <span className="rounded-full bg-white px-2 py-1 border border-slate-200">
                              PSI alvo {tire.targetPressurePsi ?? "-"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {tireStatusLabel(tire.status)}
                          </span>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Disponível
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-slate-900">Resumo da operação</h3>
                <p className="text-sm text-slate-500">Revise as alterações antes de salvar.</p>
              </div>

              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Veículo:</span>{" "}
                  {vehicleLabel(selectedVehicle)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Implementos:</span>{" "}
                  {linkedImplements.length}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Posições:</span>{" "}
                  {profile.slots.length}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Alterações:</span>{" "}
                  {pendingChanges.length}
                </p>

                {selectedTire ? (
                  <p>
                    <span className="font-semibold text-slate-900">Pneu selecionado:</span>{" "}
                    {selectedTire.serialNumber}
                  </p>
                ) : null}

                {pendingChanges.length === 0 ? (
                  <p className="text-slate-400">Nenhuma alteração pendente.</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}