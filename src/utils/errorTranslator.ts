import type { AxiosError } from "axios";

const FIELD_LABELS: Record<string, string> = {
  plate: "placa",
  model: "modelo",
  brand: "marca",
  year: "ano",
  vehicleType: "tipo de categoria",
  category: "categoria",
  fuelType: "combustível",
  tankCapacity: "capacidade do tanque",
  chassis: "chassi",
  renavam: "renavam",
  branchId: "estabelecimento",
  driverId: "motorista",
  vehicleId: "veículo",
  description: "descrição",
  amount: "valor",
  debtDate: "data de lançamento",
  dueDate: "data de vencimento",
  status: "status",
  cost: "custo",
  km: "km",
  maintenanceDate: "data da manutenção",
  name: "nome",
  email: "e-mail",
  password: "senha",
};

function toFieldLabel(raw: string) {
  return FIELD_LABELS[raw] || raw;
}

function translateValidationMessage(input: string) {
  const msg = String(input || "").trim();
  if (!msg) return msg;

  const longerOrEqual = msg.match(/^(\w+)\s+must be longer than or equal to\s+(\d+)\s+characters$/i);
  if (longerOrEqual) {
    return `${toFieldLabel(longerOrEqual[1])} deve ter no mínimo ${longerOrEqual[2]} caracteres.`;
  }

  const shorterOrEqual = msg.match(/^(\w+)\s+must be shorter than or equal to\s+(\d+)\s+characters$/i);
  if (shorterOrEqual) {
    return `${toFieldLabel(shorterOrEqual[1])} deve ter no máximo ${shorterOrEqual[2]} caracteres.`;
  }

  const isString = msg.match(/^(\w+)\s+must be a string$/i);
  if (isString) return `${toFieldLabel(isString[1])} deve ser um texto.`;

  const isNumber = msg.match(/^(\w+)\s+must be a number/i);
  if (isNumber) return `${toFieldLabel(isNumber[1])} deve ser um número válido.`;

  const isInt = msg.match(/^(\w+)\s+must be an integer number$/i);
  if (isInt) return `${toFieldLabel(isInt[1])} deve ser um número inteiro.`;

  const isBool = msg.match(/^(\w+)\s+must be a boolean value$/i);
  if (isBool) return `${toFieldLabel(isBool[1])} deve ser verdadeiro ou falso.`;

  const notEmpty = msg.match(/^(\w+)\s+should not be empty$/i);
  if (notEmpty) return `${toFieldLabel(notEmpty[1])} é obrigatório.`;

  const notExists = msg.match(/^property\s+(\w+)\s+should not exist$/i);
  if (notExists) return `O campo ${toFieldLabel(notExists[1])} não deve ser enviado.`;

  const oneOf = msg.match(/^(\w+)\s+must be one of the following values:\s+(.+)$/i);
  if (oneOf) return `${toFieldLabel(oneOf[1])} deve ser um dos valores permitidos: ${oneOf[2]}.`;

  const isDate = msg.match(/^(\w+)\s+must be a Date instance$/i);
  if (isDate) return `${toFieldLabel(isDate[1])} deve ser uma data válida.`;

  const isISO = msg.match(/^(\w+)\s+must be a valid ISO 8601 date string$/i);
  if (isISO) return `${toFieldLabel(isISO[1])} deve ser uma data válida.`;

  const isEmail = msg.match(/^(\w+)\s+must be an email$/i);
  if (isEmail) return `${toFieldLabel(isEmail[1])} deve ser um e-mail válido.`;

  const isUUID = msg.match(/^(\w+)\s+must be a UUID$/i);
  if (isUUID) return `${toFieldLabel(isUUID[1])} inválido.`;

  return msg
    .replace(/Network Error/gi, "Erro de rede")
    .replace(/Request failed with status code/gi, "Falha na requisição (status)")
    .replace(/Bad Request/gi, "Requisição inválida")
    .replace(/Unauthorized/gi, "Não autorizado")
    .replace(/Forbidden/gi, "Acesso negado")
    .replace(/Not Found/gi, "Não encontrado")
    .replace(/Internal Server Error/gi, "Erro interno do servidor")
    .replace(/Invalid credentials/gi, "Credenciais inválidas")
    .replace(/Failed to fetch/gi, "Falha de conexão com o servidor");
}

function translateUnknownError(raw: unknown): unknown {
  if (typeof raw === "string") return translateValidationMessage(raw);
  if (Array.isArray(raw)) return raw.map((item) => translateUnknownError(item));
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const next: Record<string, unknown> = { ...obj };
    if (typeof obj.message === "string") next.message = translateValidationMessage(obj.message);
    if (Array.isArray(obj.message)) {
      next.message = obj.message.map((m) => (typeof m === "string" ? translateValidationMessage(m) : m));
    }
    if (typeof obj.error === "string") next.error = translateValidationMessage(obj.error);
    if (typeof obj.details === "string") next.details = translateValidationMessage(obj.details);
    return next;
  }
  return raw;
}

export function localizeAxiosError(error: AxiosError | unknown) {
  const err = error as AxiosError & { response?: { data?: any } };
  if (!err || typeof err !== "object") return error;

  if (typeof err.message === "string") {
    err.message = translateValidationMessage(err.message);
  }

  if (err.response?.data) {
    err.response.data = translateUnknownError(err.response.data);
  }

  return err;
}

