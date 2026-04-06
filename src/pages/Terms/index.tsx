export function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Termos de Uso</h1>
        <p className="mt-3 text-sm text-slate-500">
          Estes termos regulam o uso da plataforma EvFleet.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-base font-semibold text-slate-900">1. Uso da plataforma</h2>
            <p>
              O sistema é destinado ao controle operacional e financeiro da frota,
              abastecimentos, produtos e rotinas ligadas à operação da empresa usuária.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">2. Responsabilidade de acesso</h2>
            <p>
              Cada usuário é responsável pelo uso das suas credenciais, pela veracidade
              dos dados informados e pelo cumprimento das rotinas internas da empresa.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">3. Informações registradas</h2>
            <p>
              O uso da plataforma pode envolver registros operacionais, financeiros,
              documentos, XML de NF-e e dados cadastrais necessários para o funcionamento
              do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">4. Continuidade e suporte</h2>
            <p>
              Melhorias, correções e suporte podem seguir as regras do plano contratado
              e da política comercial vigente.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
