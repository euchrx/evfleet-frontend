import { AlertTriangle, CarFront, Wrench } from "lucide-react";

type VehicleCardItem = {
  id: string;
  plate: string;
  label: string;
  branchName: string;
  tireCount: number;
  installedCount: number;
  maintenanceCount: number;
  alertCount: number;
};

type Props = {
  vehicles: VehicleCardItem[];
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string) => void;
};

export function TireVehicleCards({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}: Props) {
  if (vehicles.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Veículos com pneus vinculados
          </h2>
          <p className="text-sm text-slate-500">
            Clique em um veículo para visualizar e fazer manutenção rápida dos
            pneus na tabela abaixo.
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {vehicles.length} veículo{vehicles.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {vehicles.map((vehicle) => {
          const active = selectedVehicleId === vehicle.id;

          return (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onSelectVehicle(vehicle.id)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                active
                  ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100"
                  : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                        active
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <CarFront size={18} />
                    </span>

                    <div>
                      <p className="text-base font-bold text-slate-900">
                        {vehicle.plate}
                      </p>
                      <p className="text-sm font-medium text-slate-600">
                        {vehicle.label}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                    {vehicle.branchName || "Sem filial"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    active
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {vehicle.tireCount} pneu{vehicle.tireCount > 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-700">
                    Instalados
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">
                    {vehicle.installedCount}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 px-3 py-2">
                  <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-700">
                    <Wrench size={12} />
                    <span>Manutenção</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-amber-700">
                    {vehicle.maintenanceCount}
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 px-3 py-2">
                  <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-red-700">
                    <AlertTriangle size={12} />
                    <span>Alertas</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-red-700">
                    {vehicle.alertCount}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}