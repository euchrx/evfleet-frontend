export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-slate-500">
          Esta política descreve como os dados tratados no EvFleet são utilizados.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-base font-semibold text-slate-900">1. Dados tratados</h2>
            <p>
              Podemos tratar dados cadastrais, informações de usuários, dados de veículos,
              abastecimentos, documentos, XML de NF-e e registros operacionais necessários
              para a prestação do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">2. Finalidade</h2>
            <p>
              Os dados são utilizados para autenticação, operação do sistema, geração de
              relatórios, suporte, auditoria, melhoria do serviço e cumprimento de rotinas
              administrativas e operacionais.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">3. Segurança</h2>
            <p>
              O sistema adota controles técnicos e operacionais compatíveis com a natureza
              dos dados tratados, buscando reduzir riscos de acesso indevido e uso não autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">4. Retenção e suporte</h2>
            <p>
              Alguns registros podem ser mantidos para continuidade da operação, histórico,
              conformidade e suporte técnico, observadas as regras aplicáveis ao contrato e ao ambiente.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
