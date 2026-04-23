import type { Vehicle, VehicleCategory } from "../../../types/vehicle";

export type TireLinkSlot = {
  axlePosition: string;
  wheelPosition: string;
  axleLabel: string;
  wheelLabel: string;
  sourceType?: "VEHICLE" | "IMPLEMENT";
  sourceVehicleId?: string;
  sourceVehicleLabel?: string;
};

export type TireLinkProfile = {
  key:
    | "CAR_STANDARD"
    | "UTILITY_STANDARD"
    | "TRUCK_2_AXLES"
    | "TRUCK_3_AXLES"
    | "IMPLEMENT_3_AXLES"
    | "IMPLEMENT_4_AXLES"
    | "BITRUCK_4_AXLES"
    | "FUEL_COMBINATION_9_AXLES"
    | "COMPOSITION_DYNAMIC";
  label: string;
  description: string;
  slots: TireLinkSlot[];
};

type TireLayoutInput = {
  category?: VehicleCategory | null;
  axleCount?: number | null;
};

type CompositionItem =
  | Vehicle
  | {
      implement?: Vehicle | null;
    }
  | null
  | undefined;

type CompositionInput = {
  mainVehicle?: Vehicle | null;
  linkedImplements?: CompositionItem[];
};

function createSimpleAxle(
  axleIndex: number,
  source?: {
    sourceType?: "VEHICLE" | "IMPLEMENT";
    sourceVehicleId?: string;
    sourceVehicleLabel?: string;
  },
): TireLinkSlot[] {
  return [
    {
      axlePosition: `Eixo ${axleIndex}`,
      wheelPosition: "Lado esquerdo",
      axleLabel: `${axleIndex}º eixo`,
      wheelLabel: "Lado esquerdo",
      ...source,
    },
    {
      axlePosition: `Eixo ${axleIndex}`,
      wheelPosition: "Lado direito",
      axleLabel: `${axleIndex}º eixo`,
      wheelLabel: "Lado direito",
      ...source,
    },
  ];
}

function createDualAxle(
  axleIndex: number,
  source?: {
    sourceType?: "VEHICLE" | "IMPLEMENT";
    sourceVehicleId?: string;
    sourceVehicleLabel?: string;
  },
): TireLinkSlot[] {
  return [
    {
      axlePosition: `Eixo ${axleIndex}`,
      wheelPosition: "Lado externo esquerdo",
      axleLabel: `${axleIndex}º eixo`,
      wheelLabel: "Lado externo esquerdo",
      ...source,
    },
    {
      axlePosition: `Eixo ${axleIndex}`,
      wheelPosition: "Lado interno esquerdo",
      axleLabel: `${axleIndex}º eixo`,
      wheelLabel: "Lado interno esquerdo",
      ...source,
    },
    {
      axlePosition: `Eixo ${axleIndex}`,
      wheelPosition: "Lado interno direito",
      axleLabel: `${axleIndex}º eixo`,
      wheelLabel: "Lado interno direito",
      ...source,
    },
    {
      axlePosition: `Eixo ${axleIndex}`,
      wheelPosition: "Lado externo direito",
      axleLabel: `${axleIndex}º eixo`,
      wheelLabel: "Lado externo direito",
      ...source,
    },
  ];
}

const profiles: Record<
  Exclude<TireLinkProfile["key"], "COMPOSITION_DYNAMIC">,
  TireLinkProfile
> = {
  CAR_STANDARD: {
    key: "CAR_STANDARD",
    label: "Carro",
    description: "Configuração padrão com quatro posições principais.",
    slots: [...createSimpleAxle(1), ...createSimpleAxle(2)],
  },
  UTILITY_STANDARD: {
    key: "UTILITY_STANDARD",
    label: "Utilitário",
    description: "Configuração leve para utilitários e vans.",
    slots: [...createSimpleAxle(1), ...createSimpleAxle(2)],
  },
  TRUCK_2_AXLES: {
    key: "TRUCK_2_AXLES",
    label: "Caminhão 2 eixos",
    description: "Eixo dianteiro simples e traseiro duplo.",
    slots: [...createSimpleAxle(1), ...createDualAxle(2)],
  },
  TRUCK_3_AXLES: {
    key: "TRUCK_3_AXLES",
    label: "Caminhão 3 eixos",
    description: "Eixo dianteiro simples e dois eixos traseiros duplos.",
    slots: [...createSimpleAxle(1), ...createDualAxle(2), ...createDualAxle(3)],
  },
  IMPLEMENT_3_AXLES: {
    key: "IMPLEMENT_3_AXLES",
    label: "Implemento 3 eixos",
    description: "Três eixos duplos.",
    slots: [...createDualAxle(1), ...createDualAxle(2), ...createDualAxle(3)],
  },
  IMPLEMENT_4_AXLES: {
    key: "IMPLEMENT_4_AXLES",
    label: "Implemento 4 eixos",
    description: "Quatro eixos duplos.",
    slots: [
      ...createDualAxle(1),
      ...createDualAxle(2),
      ...createDualAxle(3),
      ...createDualAxle(4),
    ],
  },
  BITRUCK_4_AXLES: {
    key: "BITRUCK_4_AXLES",
    label: "Bitruck 4 eixos",
    description: "Configuração pesada com quatro eixos.",
    slots: [
      ...createSimpleAxle(1),
      ...createDualAxle(2),
      ...createDualAxle(3),
      ...createDualAxle(4),
    ],
  },
  FUEL_COMBINATION_9_AXLES: {
    key: "FUEL_COMBINATION_9_AXLES",
    label: "Combinação 9 eixos",
    description: "Operação pesada para transporte de combustíveis.",
    slots: [
      ...createSimpleAxle(1),
      ...createDualAxle(2),
      ...createDualAxle(3),
      ...createDualAxle(4),
      ...createDualAxle(5),
      ...createDualAxle(6),
      ...createDualAxle(7),
      ...createDualAxle(8),
      ...createDualAxle(9),
    ],
  },
};

export function getDefaultProfileForVehicleCategory(
  category?: VehicleCategory | null,
  axleCount?: number | null,
): Exclude<TireLinkProfile["key"], "COMPOSITION_DYNAMIC"> {
  if (category === "CAR") {
    return "CAR_STANDARD";
  }

  if (category === "UTILITY") {
    return "UTILITY_STANDARD";
  }

  if (category === "IMPLEMENT") {
    if (axleCount != null && axleCount >= 4) {
      return "IMPLEMENT_4_AXLES";
    }

    return "IMPLEMENT_3_AXLES";
  }

  if (category === "TRUCK") {
    if (axleCount != null) {
      if (axleCount >= 4) return "BITRUCK_4_AXLES";
      if (axleCount >= 3) return "TRUCK_3_AXLES";
    }

    return "TRUCK_2_AXLES";
  }

  return "TRUCK_2_AXLES";
}

export function getTireLayoutProfile(
  input?: TireLayoutInput | VehicleCategory | null,
): TireLinkProfile {
  if (typeof input === "string" || input == null) {
    return profiles[getDefaultProfileForVehicleCategory(input)];
  }

  return profiles[
    getDefaultProfileForVehicleCategory(input.category, input.axleCount)
  ];
}

function isVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Vehicle;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.plate === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.brand === "string"
  );
}

function normalizeLinkedImplement(item: CompositionItem): Vehicle | null {
  if (!item) return null;

  if (isVehicle(item)) {
    return item;
  }

  if (
    typeof item === "object" &&
    "implement" in item &&
    item.implement &&
    isVehicle(item.implement)
  ) {
    return item.implement;
  }

  return null;
}

function buildSlotsForVehicle(
  vehicle: Vehicle,
  startAxleIndex: number,
  sourceType: "VEHICLE" | "IMPLEMENT",
): TireLinkSlot[] {
  const axleCount = Number(vehicle.axleCount || 0);
  const slots: TireLinkSlot[] = [];
  const source = {
    sourceType,
    sourceVehicleId: vehicle.id,
    sourceVehicleLabel: `${vehicle.plate} • ${vehicle.brand} ${vehicle.model}`,
  };

  if (vehicle.category === "CAR" || vehicle.category === "UTILITY") {
    for (let i = 0; i < 2; i += 1) {
      slots.push(...createSimpleAxle(startAxleIndex + i, source));
    }

    return slots;
  }

  if (vehicle.category === "IMPLEMENT") {
    for (let i = 0; i < axleCount; i += 1) {
      slots.push(...createDualAxle(startAxleIndex + i, source));
    }

    return slots;
  }

  if (vehicle.category === "TRUCK") {
    if (axleCount <= 0) {
      return [
        ...createSimpleAxle(startAxleIndex, source),
        ...createDualAxle(startAxleIndex + 1, source),
      ];
    }

    const configuration = vehicle.axleConfiguration ?? "DUAL";

    if (axleCount === 2) {
      if (configuration === "SINGLE") {
        slots.push(...createSimpleAxle(startAxleIndex, source));
        slots.push(...createSimpleAxle(startAxleIndex + 1, source));
      } else {
        slots.push(...createSimpleAxle(startAxleIndex, source));
        slots.push(...createDualAxle(startAxleIndex + 1, source));
      }

      return slots;
    }

    if (axleCount >= 3) {
      slots.push(...createSimpleAxle(startAxleIndex, source));

      for (let i = 1; i < axleCount; i += 1) {
        if (configuration === "SINGLE") {
          slots.push(...createSimpleAxle(startAxleIndex + i, source));
        } else {
          slots.push(...createDualAxle(startAxleIndex + i, source));
        }
      }

      return slots;
    }
  }

  const fallbackAxles = axleCount > 0 ? axleCount : 2;

  for (let i = 0; i < fallbackAxles; i += 1) {
    slots.push(...createSimpleAxle(startAxleIndex + i, source));
  }

  return slots;
}

export function buildCompositionTireLayoutProfile({
  mainVehicle,
  linkedImplements = [],
}: CompositionInput): TireLinkProfile {
  if (!mainVehicle) {
    return {
      key: "COMPOSITION_DYNAMIC",
      label: "Composição",
      description: "Nenhum veículo selecionado.",
      slots: [],
    };
  }

  const normalizedImplements = linkedImplements
    .map(normalizeLinkedImplement)
    .filter((item): item is Vehicle => Boolean(item))
    .slice(0, 2);

  let nextAxleIndex = 1;

  const mainVehicleSlots = buildSlotsForVehicle(
    mainVehicle,
    nextAxleIndex,
    "VEHICLE",
  );
  nextAxleIndex += Number(mainVehicle.axleCount || 0);

  const implementSlots = normalizedImplements.flatMap((implement) => {
    const slots = buildSlotsForVehicle(implement, nextAxleIndex, "IMPLEMENT");
    nextAxleIndex += Number(implement.axleCount || 0);
    return slots;
  });

  const totalAxles =
    Number(mainVehicle.axleCount || 0) +
    normalizedImplements.reduce(
      (sum, implement) => sum + Number(implement.axleCount || 0),
      0,
    );

  const compositionLabelParts = [
    `${mainVehicle.plate}`,
    ...normalizedImplements.map((implement) => implement.plate),
  ];

  return {
    key: "COMPOSITION_DYNAMIC",
    label:
      totalAxles > 0
        ? `Conjunto total: ${totalAxles} eixos`
        : "Composição dinâmica",
    description:
      normalizedImplements.length > 0
        ? `Mapa composto por ${compositionLabelParts.join(" + ")}.`
        : "Mapa do veículo principal sem implementos vinculados.",
    slots: [...mainVehicleSlots, ...implementSlots],
  };
}