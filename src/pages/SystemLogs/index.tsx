import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import {
  clearSystemLogs,
  getSystemLogs,
  type SystemLogEntry,
} from "../../services/systemLogs";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUCCESS" | "ERROR" | "INFO">(
    "ALL"
  );
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  function loadLogs() {
    setLogs(getSystemLogs());
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    let data = logs;
    if (statusFilter !== "ALL") data = data.filter((log) => log.status === statusFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      data = data.filter((log) =>
        `${log.actor} ${log.action} ${log.endpoint} ${log.details || ""}`
          .toLowerCase()
          .includes(term)
      );
    }
    return [...data].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [logs, search, statusFilter]);

  function handleClearLogs() {
    const confirmed = window.confirm("Deseja limpar todo o histórico de logs?");
    if (!confirmed) return;
    clearSystemLogs();
    loadLogs();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Logs</h1>
          <p className="text-sm text-slate-500">
            Histórico de atualizacoes e operacoes executadas no sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleClearLogs}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Trash2 size={16} />
            Limpar logs
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Buscar por usuario, a??o, endpoint ou detalhe"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "SUCCESS" | "ERROR" | "INFO")}
            className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          >
            <option value="ALL">Todos os status</option>
            <option value="SUCCESS">Sucesso</option>
            <option value="ERROR">Erro</option>
            <option value="INFO">Informativo</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Data/Hora</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Usuario</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Metodo</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">A??o</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Endpoint</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-700">{formatDateTime(log.timestamp)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{log.actor}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{log.method}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{log.endpoint}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-700"
                            : log.status === "ERROR"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{log.details || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Database size={16} className="text-orange-600" />
          Produzido por EvTech | Solu??es em Sistemas
        </div>
      </div>
    </div>
  );
}
