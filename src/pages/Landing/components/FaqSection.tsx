import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqItems = [
  {
    question: "O EvFleet faz sentido para rede de postos?",
    answer:
      "Sim. A proposta da landing está posicionada justamente para operações com matriz e várias unidades, onde existe necessidade de controlar frota, abastecimentos, manutenção, documentos e custos por filial.",
  },
  {
    question: "Consigo ter visão separada por posto e visão consolidada da rede?",
    answer:
      "Essa é uma das ideias centrais do sistema. A operação local precisa enxergar o que executa, enquanto a gestão central precisa comparar unidades, custos e pendências.",
  },
  {
    question: "O sistema ajuda a reduzir improviso na operação?",
    answer:
      "Sim. O objetivo é sair do controle espalhado em planilhas e mensagens e concentrar as rotinas em uma plataforma única, com histórico, indicadores e mais padronização.",
  },
  {
    question: "O EvFleet serve só para abastecimento?",
    answer:
      "Não. O valor do produto está na gestão completa: abastecimentos, manutenção, documentos, débitos, viagens, relatórios, visão executiva e operação multiempresa.",
  },
  {
    question: "Ele está preparado para crescer junto com a operação?",
    answer:
      "Sim. A estrutura do projeto já aponta para escopo por empresa, organização por módulos e uma base adequada para operações que querem escalar com mais governança.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="bg-slate-900/50">
      <div className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            FAQ
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Dúvidas comuns sobre a proposta da plataforma
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            Respostas objetivas para quem quer entender se o EvFleet encaixa na
            rotina da sua operação.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.question}
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-base font-semibold text-white">
                    {item.question}
                  </span>

                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen ? (
                  <div className="border-t border-white/10 px-6 py-5 text-sm leading-7 text-slate-400">
                    {item.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}