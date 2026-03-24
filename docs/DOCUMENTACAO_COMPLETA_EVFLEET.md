# EvFleet - Documentação Completa do Sistema

## 1. Visão geral

O **EvFleet** é um sistema SaaS para gestão corporativa de frota, com foco em operação, custos, compliance e rastreabilidade.

Objetivos principais:
- Centralizar dados de veículos, motoristas, abastecimentos, manutenções, viagens, documentos e débitos.
- Melhorar controle financeiro e operacional com dashboard executivo e relatórios.
- Reduzir risco operacional com notificações e regras de validação.

## 2. Stack e arquitetura

### Frontend
- React + TypeScript + Vite
- Tailwind utility classes para UI padronizada
- Estado local com `useState`, `useEffect`, `useMemo`
- Integração HTTP via `axios`

### Backend (integração)
- API REST consumida pelo frontend
- Endpoints sem prefixo `/api` (ex.: `/vehicles`, `/drivers`, `/fuel-records`)

### Persistências usadas no frontend
- Configurações administrativas: `evfleet_admin_settings_v1`
- Visibilidade do menu: `evfleet_menu_visibility_v1`
- Regras de consumo por veículo: `evfleet_consumption_rules_v1`

## 3. Perfis e permissões

Perfis ativos no sistema:
- `ADMIN`
- `FLEET_MANAGER`

Regras:
- `ADMIN`: acesso completo, inclusive **Usuários** e **Administração**.
- `FLEET_MANAGER`: acesso operacional, sem páginas administrativas restritas.

## 4. Menu lateral (ordem atual)

1. Dashboard
2. Relatórios
3. Veículos
4. Motoristas
5. Manutenções
6. Abastecimentos
7. Débitos e Multas
8. Gestão de Viagens
9. Gestão de Documentos
10. Filiais
11. Como usar
12. Usuários (ADMIN)
13. Administração (ADMIN)

Observação:
- A visibilidade dos módulos pode ser habilitada/desabilitada em **Administração > Visibilidade do menu lateral**.

## 5. Módulos do sistema

### 5.1 Dashboard
- Indicadores de custos e operação.
- Cards de totais por módulo.
- Rankings corporativos (veículos e motoristas) com filtros de período/categoria.
- Modais de detalhamento financeiro com agrupamentos.

### 5.2 Relatórios
- Filtros de período e cruzamento de dados.
- Seletores multi-select para estabelecimento, veículos, motoristas e módulos.
- Exportação em PDF.
- Prévia de indicadores no período selecionado.

### 5.3 Veículos
- Cadastro completo:
  - Placa, marca, modelo, ano, chassi, renavam
  - Categoria e tipo (leve/pesado)
  - Combustível, capacidade do tanque, status
  - Data de aquisição (com opção sem data)
- Histórico por veículo (edições e eventos relacionados).
- Upload de anexos/fotos.
- Ordenação por colunas e filtros.

Regra administrativa:
- Limite global de cadastro de veículos controlado em Administração.
- Mensagem ao atingir o limite:
  - **"Limite máximo atingido para cadastro de veículos. Entre em contato com o suporte."**

### 5.4 Motoristas
- Cadastro de condutores com status.
- Vínculo com veículo.
- Controle de ativos/inativos e filtros.

### 5.5 Manutenções
Estrutura em abas:
- **Manutenções** (preventiva/corretiva/periódica)
- **Planos de manutenção**
- **Gestão de pneus**

Recursos:
- Modais padronizados de cadastro/edição.
- Tabelas com ordenação.
- Alertas e histórico por veículo.

Gestão de pneus (versão atual):
- Cadastro técnico simplificado
- Campo de **pressão recomendada**
- Sem campos de sulco/pressão atual no CRUD principal

### 5.6 Abastecimentos
- Registro de veículo, motorista, posto/filial, data, combustível, litros, valor e KM.
- Cálculo de consumo médio.
- Comparativo entre veículos.
- Detecção de anomalias por regra de consumo.

### 5.7 Débitos e Multas
- Gestão consolidada de débitos da frota:
  - Multa, IPVA, licenciamento, seguro, pedágio, imposto e outros.
- Status financeiros:
  - Pendente, vencida, paga, recorrida.
- Filtros por status/categoria/busca textual.
- Notificações de vencimento.

### 5.8 Gestão de Viagens
- Planejamento e execução:
  - Veículo, motorista, rota, data de saída/retorno, KM saída/retorno, status.
- Sugestão de motorista vinculado ao veículo.
- Atualização de KM para histórico operacional.

### 5.9 Gestão de Documentos
- Cadastro documental por veículo.
- Upload de arquivo.
- Controle de vencimento.
- Notificações para vencendo/vencido (janela de 30 dias).

### 5.10 Filiais
- Cadastro e manutenção de estabelecimentos.
- Integração com filtros globais e bloqueio por estabelecimento padrão.

### 5.11 Como usar
- Manual interno no próprio frontend.
- Feed de vídeos explicativos.
- Administração de conteúdo de onboarding.

### 5.12 Usuários
- Gestão de usuários e papéis.
- Regras de acesso por perfil.

### 5.13 Administração
- Parâmetros gerais do software.
- Visibilidade de menu lateral.
- Publicação manual de updates para System Logs.
- Configurações de estabelecimento padrão do sistema.

## 6. Notificações

As notificações ficam no header com:
- contador de pendências
- modal de listagem
- redirecionamento contextual para o módulo relacionado

Eventos contemplados:
- anomalias de abastecimento
- manutenção próxima/programada
- débitos vencendo e vencidos
- documentos vencendo/vencidos

Comportamento de destaque:
- ao redirecionar para a tabela, o item é destacado
- destaque é removido após interação do usuário (clique/navegação/abertura de modal)

## 7. System Logs

Formato:
- modal acionado no rodapé (sem página dedicada)
- exibe nome do sistema, versão e lista de tópicos

Origem dos logs:
- apenas lançamentos manuais via **Administração > Informar atualização**

## 8. Regras funcionais importantes

### 8.1 Limite de veículos
- Campo em Administração:
  - **Limite máximo de veículos permitidos no sistema**
- O cadastro de novos veículos respeita esse limite.
- Botão de cadastro muda visual conforme limite.

### 8.2 Escopo por estabelecimento
- Quando ativado:
  - estabelecimento padrão é aplicado automaticamente
  - campos de estabelecimento ficam bloqueados nos fluxos aplicáveis

### 8.3 Ordenação e paginação
- Tabelas padronizadas com:
  - ordenação por coluna
  - paginação (`10` itens por página em módulos principais)

### 8.4 Validação de formulários
- Erros de validação por campo (estilo visual vermelho no input).
- Mensagens em português.

## 9. Eventos globais de atualização (frontend)

Eventos usados para sincronizar UI:
- `evfleet-settings-updated`
- `evfleet-default-branch-updated`
- `evfleet-menu-visibility-updated`
- `evfleet-notifications-updated`

## 10. Fluxo operacional recomendado

1. Configurar Administração (empresa, limite de veículos, estabelecimento padrão).
2. Cadastrar filiais.
3. Cadastrar veículos.
4. Cadastrar motoristas.
5. Registrar abastecimentos e manutenções.
6. Registrar débitos e documentos.
7. Acompanhar Dashboard e notificações.
8. Emitir relatórios por período e filtros de cruzamento.

## 11. Boas práticas para operação corporativa

- Manter cadastros de veículos e motoristas sempre com status atualizado.
- Registrar KM em todos os eventos operacionais.
- Validar periodicamente alertas de manutenção e vencimentos.
- Usar o módulo de Relatórios para auditoria mensal de custos.
- Publicar updates relevantes no System Logs para rastreabilidade interna.

## 12. Roadmap recomendado (próximas evoluções)

- Controle de centro de custo por unidade/veículo.
- Aprovação em fluxo para lançamentos financeiros.
- SLA de manutenção por tipo de incidente.
- Exportadores adicionais (CSV/XLSX).
- Integração com canal externo de notificações (e-mail/WhatsApp backend-driven).

