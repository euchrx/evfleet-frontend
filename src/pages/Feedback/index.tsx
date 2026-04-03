import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";

type Step = "rating" | "tags" | "comment" | "done" | "error";

type RatingOption = {
  value: number;
  emoji: string;
  label: string;
};

type TagOption = {
  id: string;
  name: string;
};

const RATING_OPTIONS: RatingOption[] = [
  { value: 1, emoji: "😡", label: "Péssimo" },
  { value: 2, emoji: "😐", label: "Ruim" },
  { value: 3, emoji: "🙂", label: "Ok" },
  { value: 4, emoji: "😃", label: "Bom" },
  { value: 5, emoji: "🤩", label: "Excelente" },
];

const TAG_OPTIONS: TagOption[] = [
  { id: "1", name: "Atendimento" },
  { id: "2", name: "Rapidez" },
  { id: "3", name: "Limpeza" },
  { id: "4", name: "Produto" },
  { id: "5", name: "Ambiente" },
];

const RESET_DELAY_MS = 3000;

function getKioskTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token")?.trim() || "";
}

export default function FeedbackKiosk() {
  const [step, setStep] = useState<Step>("rating");
  const [rating, setRating] = useState<number | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const kioskToken = useMemo(() => {
    const fromUrl = getKioskTokenFromUrl();
    if (fromUrl) return fromUrl;

    return localStorage.getItem("evfeedback_kiosk_token")?.trim() || "";
  }, []);

  function resetFlow() {
    setStep("rating");
    setRating(null);
    setTagIds([]);
    setComment("");
    setIsSubmitting(false);
  }

  function handleSelectRating(value: number) {
    setRating(value);
    setStep("tags");
  }

  function handleToggleTag(id: string) {
    setTagIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function handleSubmit(skipComment = false) {
    if (!rating || !kioskToken || isSubmitting) return;

    try {
      setIsSubmitting(true);

      await api.post("/kiosk/feedback", {
        token: kioskToken,
        rating,
        comment: skipComment ? "" : comment.trim(),
        tagIds,
      });

      setStep("done");
    } catch (error) {
      console.error("Erro ao enviar feedback:", error);
      setStep("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (step !== "done") return;

    const timer = window.setTimeout(() => {
      resetFlow();
    }, RESET_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (kioskToken) return;
    setStep("error");
  }, [kioskToken]);

  const selectedRating = RATING_OPTIONS.find((item) => item.value === rating);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur p-6 md:p-10 shadow-2xl">
          {step === "rating" && (
            <section className="text-center">
              <p className="text-sky-400 text-sm md:text-base font-semibold tracking-[0.25em] uppercase">
                EvSistemas Feedback
              </p>

              <h1 className="mt-4 text-4xl md:text-6xl font-bold leading-tight">
                Como foi sua experiência hoje?
              </h1>

              <p className="mt-4 text-slate-300 text-lg md:text-xl">
                Toque em uma opção para avaliar rapidamente.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
                {RATING_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelectRating(option.value)}
                    className="rounded-3xl border border-slate-700 bg-slate-800 hover:bg-slate-700 active:scale-95 transition p-6 md:p-8 flex flex-col items-center justify-center min-h-[140px] md:min-h-[180px]"
                  >
                    <span className="text-5xl md:text-6xl">{option.emoji}</span>
                    <span className="mt-3 text-sm md:text-base font-medium text-slate-200">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === "tags" && (
            <section className="text-center">
              <p className="text-slate-400 text-sm md:text-base">
                Avaliação selecionada:
                <span className="ml-2 font-semibold text-white">
                  {selectedRating?.emoji} {selectedRating?.label}
                </span>
              </p>

              <h2 className="mt-4 text-3xl md:text-5xl font-bold">
                O que mais influenciou sua experiência?
              </h2>

              <p className="mt-4 text-slate-300 text-lg">
                Você pode marcar uma ou mais opções.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10">
                {TAG_OPTIONS.map((tag) => {
                  const active = tagIds.includes(tag.id);

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={`rounded-2xl border px-4 py-5 md:px-6 md:py-6 text-base md:text-lg font-medium transition active:scale-95 ${
                        active
                          ? "border-sky-400 bg-sky-500 text-white"
                          : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-10 flex flex-col md:flex-row gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setStep("rating")}
                  className="rounded-2xl bg-slate-800 hover:bg-slate-700 px-8 py-4 text-lg font-semibold transition"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={() => setStep("comment")}
                  className="rounded-2xl bg-sky-500 hover:bg-sky-400 px-8 py-4 text-lg font-semibold text-slate-950 transition"
                >
                  Continuar
                </button>
              </div>
            </section>
          )}

          {step === "comment" && (
            <section className="text-center">
              <p className="text-slate-400 text-sm md:text-base">
                Avaliação:
                <span className="ml-2 font-semibold text-white">
                  {selectedRating?.emoji} {selectedRating?.label}
                </span>
              </p>

              <h2 className="mt-4 text-3xl md:text-5xl font-bold">
                Deseja deixar um comentário?
              </h2>

              <p className="mt-4 text-slate-300 text-lg">
                Essa etapa é opcional.
              </p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escreva aqui sua opinião..."
                className="mt-8 w-full rounded-2xl border border-slate-700 bg-slate-800 px-5 py-4 text-white text-lg outline-none focus:border-sky-400 min-h-[140px] resize-none"
                maxLength={500}
              />

              <div className="mt-3 text-right text-sm text-slate-400">
                {comment.length}/500
              </div>

              <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setStep("tags")}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-8 py-4 text-lg font-semibold transition"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-8 py-4 text-lg font-semibold transition"
                >
                  Pular
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 px-8 py-4 text-lg font-semibold text-slate-950 transition"
                >
                  {isSubmitting ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </section>
          )}

          {step === "done" && (
            <section className="text-center py-10">
              <div className="text-7xl md:text-8xl">🙏</div>

              <h2 className="mt-6 text-4xl md:text-6xl font-bold">
                Obrigado!
              </h2>

              <p className="mt-4 text-slate-300 text-lg md:text-2xl">
                Sua opinião é muito importante para nós.
              </p>

              <p className="mt-6 text-slate-500 text-sm md:text-base">
                A tela será reiniciada automaticamente.
              </p>
            </section>
          )}

          {step === "error" && (
            <section className="text-center py-10">
              <div className="text-7xl md:text-8xl">⚠️</div>

              <h2 className="mt-6 text-3xl md:text-5xl font-bold">
                Não foi possível continuar
              </h2>

              <p className="mt-4 text-slate-300 text-lg">
                Verifique a configuração do kiosk ou a conexão com a API.
              </p>

              {!kioskToken && (
                <p className="mt-3 text-rose-400">
                  Token do kiosk não encontrado.
                </p>
              )}

              <button
                type="button"
                onClick={resetFlow}
                className="mt-8 rounded-2xl bg-sky-500 hover:bg-sky-400 px-8 py-4 text-lg font-semibold text-slate-950 transition"
              >
                Tentar novamente
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}