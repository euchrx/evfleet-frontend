export type SystemLogStatus = "SUCCESS" | "ERROR" | "INFO";

export type SystemLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  method: string;
  action: string;
  endpoint: string;
  status: SystemLogStatus;
  details?: string;
};

const STORAGE_KEY = "evfleet_system_logs_v1";
const MAX_LOGS = 1500;

function readLogs(): SystemLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SystemLogEntry[];
  } catch {
    return [];
  }
}

function writeLogs(logs: SystemLogEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
}

function resolveActor() {
  const name = localStorage.getItem("auth_user_name")?.trim();
  return name || "Sistema";
}

export function addSystemLog(
  input: Omit<SystemLogEntry, "id" | "timestamp" | "actor"> & { actor?: string }
) {
  const next: SystemLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor: input.actor?.trim() || resolveActor(),
    method: input.method,
    action: input.action,
    endpoint: input.endpoint,
    status: input.status,
    details: input.details,
  };

  const logs = readLogs();
  logs.unshift(next);
  writeLogs(logs);
}

export function getSystemLogs() {
  return readLogs();
}

export function clearSystemLogs() {
  localStorage.removeItem(STORAGE_KEY);
}
