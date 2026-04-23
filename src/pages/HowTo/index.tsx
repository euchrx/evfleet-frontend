import { useMemo, useState } from "react";
import { BookOpenCheck, CirclePlay, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import {
  addHowToVideo,
  deleteHowToVideo,
  getHowToVideos,
  type HowToVideo,
} from "../../services/howToVideos";

type VideoForm = {
  title: string;
  url: string;
  category: string;
  description: string;
};

const initialForm: VideoForm = {
  title: "",
  url: "",
  category: "Operação",
  description: "",
};

const manualSteps = [
  {
    title: "1. Cadastre a base da frota",
    route: "Caminho: Veículos > + Cadastrar veículo",
    steps:
      "Inclua placa, marca, modelo, ano, tipo, combustível, capacidade e status. Depois vincule filial para manter custos e relatórios corretos.",
  },
  {
    title: "2. Vincule motoristas e veículos",
    route: "Caminho: Motoristas > + Cadastrar motorista",
    steps:
      "Cadastre dados de CNH e status. Mantenha apenas perfis ativos para evitar vínculos incorretos em abastecimentos, viagens e multas.",
  },
  {
    title: "3. Registre abastecimentos com KM",
    route: "Caminho: Abastecimentos > + Registrar",
    steps:
      "Informe veículo, motorista, filial, litros, valor e odômetro. O sistema calcula consumo médio e aponta anomalias automaticamente.",
  },
  {
    title: "4. Planeje manutenção preventiva",
    route: "Caminho: Manutenções",
    steps:
      "Registre e acompanhe as manutenções programadas e pendentes da frota. Use o módulo de pneus para leituras técnicas e controle de desgaste.",
  },
  {
    title: "5. Controle débitos e documentos",
    route: "Caminho: Gestão de Finanças / Gestão de Documentos",
    steps:
      "Registre vencimentos, status e responsáveis. Monitore as notificações para itens a vencer e pendências vencidas.",
  },
  {
    title: "6. Acompanhe indicadores no dashboard",
    route: "Caminho: Dashboard",
    steps:
      "Use os cards e rankings para decidir com rapidez: custo total, custos por categoria, motoristas e veículos com maior impacto financeiro.",
  },
];

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function formatDateTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("pt-BR");
}

export function HowToPage() {
  const { user } = useAuth();
  const canManageVideos = user?.role === "ADMIN";
  const [videos, setVideos] = useState<HowToVideo[]>(() => getHowToVideos());
  const [form, setForm] = useState<VideoForm>(initialForm);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [videoToDelete, setVideoToDelete] = useState<HowToVideo | null>(null);

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return videos;
    const term = search.toLowerCase();
    return videos.filter((video) =>
      [video.title, video.category, video.description || "", video.url].join(" ").toLowerCase().includes(term),
    );
  }, [videos, search]);

  function handleChange<K extends keyof VideoForm>(field: K, value: VideoForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError("");
  }

  function handleAddVideo(event: React.FormEvent) {
    event.preventDefault();
    if (!canManageVideos) return;
    if (!form.title.trim() || !form.url.trim()) {
      setFormError("Informe título e URL do vídeo.");
      return;
    }

    try {
      const parsed = new URL(form.url);
      if (!parsed.protocol.startsWith("http")) {
        setFormError("Informe uma URL válida iniciando com http:// ou https://.");
        return;
      }
    } catch {
      setFormError("Informe uma URL válida.");
      return;
    }

    const created = addHowToVideo({
      title: form.title,
      url: form.url,
      category: form.category,
      description: form.description,
    });
    setVideos((prev) => [created, ...prev]);
    setForm(initialForm);
    setFormError("");
  }

  function handleDeleteVideo(video: HowToVideo) {
    if (!canManageVideos) return;
    setVideoToDelete(video);
  }

  function confirmDeleteVideo() {
    if (!videoToDelete) return;
    deleteHowToVideo(videoToDelete.id);
    setVideos((prev) => prev.filter((item) => item.id !== videoToDelete.id));
    setVideoToDelete(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Como usar</h1>
          <p className="text-sm text-slate-500">Manual completo no sistema e feed de vídeos explicativos.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BookOpenCheck size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Manual rápido</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {manualSteps.map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-xs font-medium text-blue-700">{item.route}</p>
              <p className="mt-2 text-sm text-slate-600">{item.steps}</p>
            </article>
          ))}
        </div>
      </section>

      {canManageVideos ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Incluir vídeo</h2>
          </div>
          <form onSubmit={handleAddVideo} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Título</label>
              <input
                value={form.title}
                onChange={(event) => handleChange("title", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                placeholder="Ex: Como registrar abastecimento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Categoria</label>
              <select
                value={form.category}
                onChange={(event) => handleChange("category", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              >
                <option value="Operação">Operação</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Administração">Administração</option>
                <option value="Treinamento">Treinamento</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">URL do vídeo</label>
              <input
                value={form.url}
                onChange={(event) => handleChange("url", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Descrição (opcional)</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                placeholder="Resumo do conteúdo do vídeo"
              />
            </div>
            {formError ? <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div> : null}
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
                + Adicionar ao feed
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-sm text-blue-800">
            Seu perfil é de visualização neste módulo. Apenas administradores podem incluir ou remover vídeos.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CirclePlay size={18} className="text-red-600" />
            <h2 className="text-lg font-semibold text-slate-900">Vídeos explicativos</h2>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título, categoria ou descrição"
            className="w-full max-w-md rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          />
        </div>

        {filteredVideos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum vídeo encontrado no feed.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredVideos.map((video) => {
              const embedUrl = getYouTubeEmbedUrl(video.url);
              return (
                <article key={video.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="aspect-video w-full bg-slate-100">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={video.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-slate-500">
                        Preview disponível para links do YouTube.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{video.title}</h3>
                      <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{video.category}</span>
                    </div>
                    {video.description ? <p className="line-clamp-2 text-sm text-slate-600">{video.description}</p> : null}
                    <p className="text-xs text-slate-500">Incluído em {formatDateTime(video.createdAt)}</p>
                    <div className="flex items-center justify-between pt-1">
                      <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
                        Abrir vídeo <ExternalLink size={14} />
                      </a>
                      {canManageVideos ? (
                        <button type="button" onClick={() => handleDeleteVideo(video)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">
                          <Trash2 size={13} /> Remover
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDeleteModal
        isOpen={Boolean(videoToDelete)}
        title="Remover vídeo"
        description={videoToDelete ? `Deseja remover o vídeo "${videoToDelete.title}"?` : ""}
        confirmText="Remover"
        onCancel={() => setVideoToDelete(null)}
        onConfirm={confirmDeleteVideo}
      />
    </div>
  );
}
