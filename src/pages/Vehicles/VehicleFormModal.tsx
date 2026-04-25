import type { Branch } from "../../types/branch";
import { resolveApiMediaUrl } from "../../utils/mediaUrl";
import {
  type AxleConfiguration,
  type FuelType,
  type VehicleFieldErrors,
  type VehicleFormData,
  getAllowedCategoriesByVehicleType,
  getAllowedFuelByCategory,
  getAllowedVehicleTypeByCategory,
  isSupportedVehicleProfileImage,
  syncVehicleRules,
} from "./helpers";

type VehicleFormModalProps = {
  isOpen: boolean;
  editingVehicleId?: string | null;
  currentCompanyName?: string | null;
  branchFieldsEnabled: boolean;
  branches: Branch[];
  form: VehicleFormData;
  setForm: React.Dispatch<React.SetStateAction<VehicleFormData>>;
  fieldErrors: VehicleFieldErrors;
  clearFieldError: (field: keyof VehicleFormData) => void;
  getFieldClass: (field: keyof VehicleFormData, extra?: string) => string;
  formErrorMessage: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  photoFiles: File[];
  setPhotoFiles: React.Dispatch<React.SetStateAction<File[]>>;
  selectedProfilePhotoPreview: string;
  currentProfilePhotoUrl: string;
  setFormErrorMessage: React.Dispatch<React.SetStateAction<string>>;
};

function formatCurrencyInput(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function VehicleFormModal({
  isOpen,
  editingVehicleId,
  currentCompanyName,
  form,
  setForm,
  fieldErrors,
  clearFieldError,
  getFieldClass,
  formErrorMessage,
  saving,
  onClose,
  onSubmit,
  photoFiles,
  setPhotoFiles,
  selectedProfilePhotoPreview,
  currentProfilePhotoUrl,
  setFormErrorMessage,
}: VehicleFormModalProps) {
  if (!isOpen) return null;

  const allowedCategoryOptions = getAllowedCategoriesByVehicleType(form.vehicleType);
  const allowedFuelOptions = getAllowedFuelByCategory(form.category);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
      <div className="relative mx-auto my-4 flex h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl md:my-6 md:h-[calc(100dvh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {editingVehicleId ? "Editar veículo" : "Cadastrar veículo"}
            </h2>
            <p className="text-sm text-slate-500">
              Preencha os dados operacionais e documentais do veículo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex-1 space-y-5 overflow-y-auto px-6 pb-0 pt-6"
        >
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Identificação
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Placa</span>
                <input
                  value={form.plate}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      plate: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 7),
                    }));
                    clearFieldError("plate");
                  }}
                  className={getFieldClass("plate", "uppercase")}
                  placeholder="ABC1234"
                />
                {fieldErrors.plate ? (
                  <p className="text-xs text-red-600">{fieldErrors.plate}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Empresa</span>
                <input
                  value={currentCompanyName || "Empresa não selecionada"}
                  disabled
                  className={`${getFieldClass("branchId")} cursor-not-allowed bg-slate-200 text-slate-500`}
                  placeholder="Empresa vinculada"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Marca</span>
                <input
                  value={form.brand}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, brand: e.target.value }));
                    clearFieldError("brand");
                  }}
                  className={getFieldClass("brand")}
                  placeholder="Volvo"
                />
                {fieldErrors.brand ? (
                  <p className="text-xs text-red-600">{fieldErrors.brand}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Modelo</span>
                <input
                  value={form.model}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, model: e.target.value }));
                    clearFieldError("model");
                  }}
                  className={getFieldClass("model")}
                  placeholder="FH 540"
                />
                {fieldErrors.model ? (
                  <p className="text-xs text-red-600">{fieldErrors.model}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Ano</span>
                <input
                  value={form.year}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, year: e.target.value }));
                    clearFieldError("year");
                  }}
                  className={getFieldClass("year")}
                  placeholder="2024"
                />
                {fieldErrors.year ? (
                  <p className="text-xs text-red-600">{fieldErrors.year}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Valor Tabela Fipe
                </span>
                <input
                  value={form.fipeValue || ""}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      fipeValue: formatCurrencyInput(e.target.value),
                    }));
                    clearFieldError("fipeValue");
                  }}
                  className={getFieldClass("fipeValue")}
                  placeholder="0,00"
                  inputMode="numeric"
                />
                {fieldErrors.fipeValue ? (
                  <p className="text-xs text-red-600">{fieldErrors.fipeValue}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Informe o valor de referência da Tabela Fipe.
                  </p>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Data de aquisição
                </span>
                <input
                  type="date"
                  value={form.acquisitionDate}
                  disabled={form.noAcquisitionDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, acquisitionDate: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.noAcquisitionDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        noAcquisitionDate: e.target.checked,
                        acquisitionDate: e.target.checked ? "" : prev.acquisitionDate,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                  />
                  Sem data de aquisição
                </label>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Chassi</span>
                <input
                  value={form.chassis}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      chassis: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 30),
                    }));
                    clearFieldError("chassis");
                  }}
                  className={getFieldClass("chassis", "uppercase")}
                  placeholder="9BWZZZ..."
                />
                {fieldErrors.chassis ? (
                  <p className="text-xs text-red-600">{fieldErrors.chassis}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Renavam</span>
                <input
                  value={form.renavam}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      renavam: e.target.value.replace(/\D/g, "").slice(0, 11),
                    }));
                    clearFieldError("renavam");
                  }}
                  className={getFieldClass("renavam")}
                  placeholder="11 dígitos"
                />
                {fieldErrors.renavam ? (
                  <p className="text-xs text-red-600">{fieldErrors.renavam}</p>
                ) : null}
              </label>

              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Foto de perfil do veículo
                </span>

                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {selectedProfilePhotoPreview ||
                    currentProfilePhotoUrl ||
                    form.photoUrls[0] ? (
                      <img
                        src={
                          selectedProfilePhotoPreview ||
                          resolveApiMediaUrl(
                            currentProfilePhotoUrl || form.photoUrls[0],
                          )
                        }
                        alt="Foto de perfil do veículo"
                        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-400">
                        Sem foto
                      </div>
                    )}

                    <p className="text-xs text-slate-500">
                      Essa foto será usada na identificação visual dos cards.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                      Selecionar foto
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];

                          if (!file) {
                            setPhotoFiles([]);
                            e.currentTarget.value = "";
                            return;
                          }

                          if (!isSupportedVehicleProfileImage(file)) {
                            setPhotoFiles([]);
                            setFormErrorMessage(
                              "Formato não suportado para foto de perfil. Use JPG, PNG ou WEBP.",
                            );
                            e.currentTarget.value = "";
                            return;
                          }

                          setFormErrorMessage("");
                          setPhotoFiles([file]);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {photoFiles.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setPhotoFiles([])}
                        className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Operação
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Tipo de categoria
                </span>
                <select
                  value={form.vehicleType}
                  onChange={(e) => {
                    const nextValue = e.target.value as VehicleFormData["vehicleType"];

                    const nextForm = syncVehicleRules({
                      ...form,
                      vehicleType: nextValue,
                      category:
                        nextValue === "LIGHT" &&
                        (form.category === "TRUCK" || form.category === "IMPLEMENT")
                          ? ""
                          : nextValue === "HEAVY" &&
                              (form.category === "CAR" || form.category === "UTILITY")
                            ? ""
                            : form.category,
                    });

                    setForm(nextForm);
                    clearFieldError("vehicleType");
                    clearFieldError("category");
                    clearFieldError("axleCount");
                    clearFieldError("axleConfiguration");
                    clearFieldError("fuelType");
                    clearFieldError("tankCapacity");
                  }}
                  className={getFieldClass("vehicleType")}
                >
                  <option value="">Seleciona a categoria</option>
                  <option value="LIGHT">Leve</option>
                  <option value="HEAVY">Pesado</option>
                </select>

                {fieldErrors.vehicleType ? (
                  <p className="text-xs text-red-600">{fieldErrors.vehicleType}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Leve permite carro e utilitário. Pesado permite caminhão e
                    implemento.
                  </p>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Tipo de veículo
                </span>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const nextCategory = e.target.value as
                      | "CAR"
                      | "TRUCK"
                      | "UTILITY"
                      | "IMPLEMENT"
                      | "";

                    const allowedFuelValues = getAllowedFuelByCategory(nextCategory).map(
                      (item) => item.value,
                    );

                    const nextForm = syncVehicleRules({
                      ...form,
                      category: nextCategory,
                      vehicleType:
                        getAllowedVehicleTypeByCategory(nextCategory) ||
                        form.vehicleType,
                      fuelType:
                        form.fuelType &&
                        allowedFuelValues.includes(form.fuelType as FuelType)
                          ? form.fuelType
                          : "",
                    });

                    setForm(nextForm);
                    clearFieldError("category");
                    clearFieldError("vehicleType");
                    clearFieldError("fuelType");
                    clearFieldError("axleCount");
                    clearFieldError("axleConfiguration");
                    clearFieldError("tankCapacity");
                  }}
                  className={getFieldClass("category")}
                >
                  <option value="">Selecione o tipo de veículo</option>
                  {allowedCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {fieldErrors.category ? (
                  <p className="text-xs text-red-600">{fieldErrors.category}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    As opções mudam conforme o tipo selecionado.
                  </p>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Configuração dos eixos traseiros do cavalo
                </span>

                {form.category === "TRUCK" ? (
                  <select
                    value={form.axleConfiguration}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        axleConfiguration: e.target.value as AxleConfiguration,
                      }));
                      clearFieldError("axleConfiguration");
                    }}
                    className={getFieldClass("axleConfiguration")}
                  >
                    <option value="">Selecione</option>
                    <option value="SINGLE">Simples</option>
                    <option value="DUAL">Duplo</option>
                  </select>
                ) : (
                  <input
                    value="-"
                    disabled
                    className={`${getFieldClass("axleConfiguration")} cursor-not-allowed bg-slate-100`}
                  />
                )}

                {fieldErrors.axleConfiguration ? (
                  <p className="text-xs text-red-600">
                    {fieldErrors.axleConfiguration}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Obrigatório apenas para caminhão.
                  </p>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Quantidade de eixos
                </span>

                {form.category === "TRUCK" ? (
                  <select
                    value={form.axleCount}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, axleCount: e.target.value }));
                      clearFieldError("axleCount");
                    }}
                    className={getFieldClass("axleCount")}
                  >
                    <option value="2">2 eixos</option>
                    <option value="3">3 eixos</option>
                  </select>
                ) : form.category === "IMPLEMENT" ? (
                  <select
                    value={form.axleCount}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, axleCount: e.target.value }));
                      clearFieldError("axleCount");
                    }}
                    className={getFieldClass("axleCount")}
                  >
                    <option value="2">2 eixos</option>
                    <option value="3">3 eixos</option>
                    <option value="4">4 eixos</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    value={form.axleCount}
                    disabled
                    className={`${getFieldClass("axleCount")} cursor-not-allowed bg-slate-100`}
                    placeholder="Ex: 2"
                  />
                )}

                {fieldErrors.axleCount ? (
                  <p className="text-xs text-red-600">{fieldErrors.axleCount}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Carro e utilitário usam 2 eixos fixos. Caminhão usa 2 ou 3.
                    Implemento usa 2, 3 ou 4.
                  </p>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Combustível
                </span>
                <select
                  value={form.category === "IMPLEMENT" ? "" : form.fuelType}
                  disabled={form.category === "IMPLEMENT"}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      fuelType: e.target.value as VehicleFormData["fuelType"],
                    }));
                    clearFieldError("fuelType");
                  }}
                  className={
                    form.category === "IMPLEMENT"
                      ? `${getFieldClass("fuelType")} cursor-not-allowed bg-slate-100`
                      : getFieldClass("fuelType")
                  }
                >
                  <option value="">
                    {form.category === "IMPLEMENT"
                      ? "-"
                      : "Selecione o combustível"}
                  </option>

                  {form.category !== "IMPLEMENT" &&
                    allowedFuelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>

                {fieldErrors.fuelType ? (
                  <p className="text-xs text-red-600">{fieldErrors.fuelType}</p>
                ) : form.category === "IMPLEMENT" ? (
                  <p className="text-xs text-slate-500">
                    Implemento não utiliza combustível no cadastro.
                  </p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Capacidade do tanque (L)
                </span>
                <input
                  type="number"
                  value={form.category === "IMPLEMENT" ? "" : form.tankCapacity}
                  disabled={form.category === "IMPLEMENT"}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, tankCapacity: e.target.value }));
                    clearFieldError("tankCapacity");
                  }}
                  className={
                    form.category === "IMPLEMENT"
                      ? `${getFieldClass("tankCapacity")} cursor-not-allowed bg-slate-100`
                      : getFieldClass("tankCapacity")
                  }
                  placeholder={form.category === "IMPLEMENT" ? "-" : "120"}
                />
                {fieldErrors.tankCapacity ? (
                  <p className="text-xs text-red-600">{fieldErrors.tankCapacity}</p>
                ) : form.category === "IMPLEMENT" ? (
                  <p className="text-xs text-slate-500">
                    Implemento não utiliza capacidade de tanque.
                  </p>
                ) : null}
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as VehicleFormData["status"],
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="MAINTENANCE">Manutenção</option>
                  <option value="SOLD">Vendido</option>
                </select>
              </label>

              {form.vehicleType === "LIGHT" || form.category === "UTILITY" ? (
                <>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                      Consumo mínimo (km/L)
                    </span>
                    <input
                      value={form.consumptionMinKmPerLiter}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          consumptionMinKmPerLiter: e.target.value,
                        }));
                        clearFieldError("consumptionMinKmPerLiter");
                      }}
                      className={getFieldClass("consumptionMinKmPerLiter")}
                      placeholder="Ex: 6.0"
                    />
                    {fieldErrors.consumptionMinKmPerLiter ? (
                      <p className="text-xs text-red-600">
                        {fieldErrors.consumptionMinKmPerLiter}
                      </p>
                    ) : null}
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                      Consumo máximo (km/L)
                    </span>
                    <input
                      value={form.consumptionMaxKmPerLiter}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          consumptionMaxKmPerLiter: e.target.value,
                        }));
                        clearFieldError("consumptionMaxKmPerLiter");
                      }}
                      className={getFieldClass("consumptionMaxKmPerLiter")}
                      placeholder="Ex: 10.0"
                    />
                    {fieldErrors.consumptionMaxKmPerLiter ? (
                      <p className="text-xs text-red-600">
                        {fieldErrors.consumptionMaxKmPerLiter}
                      </p>
                    ) : null}
                  </label>
                </>
              ) : null}
            </div>
          </div>

          {formErrorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formErrorMessage}
            </div>
          ) : null}

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Salvando..." : "Salvar veículo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}