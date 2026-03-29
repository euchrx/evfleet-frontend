import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqItems = [
  {
    question: "O EvFleet funciona para operação multiempresa?",
    answer:
      "Sim. O sistema já possui escopo por empresa, controle de acesso e gestão de assinatura por Company.",
  },
  {
    question: "Consigo acompanhar custos por veículo e por período?",
    answer:
      "Sim. Você consegue cruzar período, categoria, veículo e módulos para identificar onde está o maior impacto financeiro.",
  },
  {
    question: "O sistema ajuda com manutenção e conformidade?",
    answer:
      "Sim. Há controle de manutenção preventiva/corretiva, alertas de vencimento e gestão de documentos e débitos.",
  },
  {
    question: "É possível crescer sem trocar de plataforma?",
    answer:
      "Sim. A arquitetura SaaS já está preparada para escalar operação, usuários e empresas mantendo governança dos dados.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold text-slate-900">FAQ</h2>
      <p className="mt-2 text-sm text-slate-600">
        Dúvidas comuns de times de operação e gestores.
      </p>

      <div className="mt-5 space-y-2">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <article key={item.question} className="rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-slate-900">{item.question}</span>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen ? (
                <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                  {item.answer}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
