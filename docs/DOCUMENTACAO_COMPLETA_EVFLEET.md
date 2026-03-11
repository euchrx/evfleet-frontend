# EvFleet - Documentação Completa do Sistema

## 1. Visão Geral

O **EvFleet** é um sistema SaaS para gestão completa de frotas, com foco em operação corporativa:

- cadastro e controle de veículos e motoristas
- abastecimentos com análise de consumo e detecção de anomalias
- manutenção preventiva/corretiva com planos e gestão de pneus
- débitos e multas (custos e vencimentos)
- viagens e documentos
- dashboards e relatórios gerenciais
- administração de regras do sistema e visibilidade de módulos

## 2. Arquitetura e Stack

### Frontend

- **React + TypeScript + Vite**
- Estilização com classes utilitárias (layout corporativo padronizado)
- Estado local com hooks (`useState`, `useEffect`, `useMemo`)
- Persistência de algumas configurações em `localStorage`

### Backend (integração)

- API REST consumida via `axios`
- Endpoints sem prefixo `/api` (ex.: `http://localhost:3000/drivers`)

## 3. Perfis e Permissões

Perfis atuais:

- `ADMIN`
- `FLEET_MANAGER`

Regras principais:

- `ADMIN` vê tudo, incluindo **Administração** e **Usuários**
- `FLEET_MANAGER` não vê páginas administrativas restritas
- Página **Como usar**:
  - `ADMIN`: pode incluir/remover vídeos
  - `FLEET_MANAGER`: apenas visualiza manual e feed

## 4. Menu Lateral (ordem atual)

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
12. Usuários
13. Administração

Observação: a visibilidade dos itens pode ser alterada no módulo **Administração**.

## 5. Módulos do Sistema

### 5.1 Dashboard

Painel principal com indicadores operacionais e financeiros:

- custos consolidados
- rankings (veículos, motoristas)
- cards analíticos
- foco em visão executiva por período

### 5.2 Relatórios

Módulo orientado à extração:

- filtros por período e contexto operacional
- geração em PDF (base atual)
- fluxo pensado para exportar o que é visualizado no dashboard

### 5.3 Veículos

Cadastro completo com campos operacionais:

- identificação (placa, marca, modelo, ano, chassi, renavam)
- operação (tipo, categoria, combustível, capacidade do tanque, status)
- dados de consumo para regras de anomalia
- histórico de alterações por veículo

Recursos:

- ordenação de tabela por colunas
- validações de formulário
- status visual (ativo/manutenção/vendido)

### 5.4 Motoristas

Gestão de condutores:

- nome, CPF, CNH, categoria, validade
- vínculo com veículo
- status ativo/inativo

Recursos:

- filtros e ordenação
- padronização visual com demais tabelas

### 5.5 Manutenções

Página central com abas:

- **Manutenções**: registros executados/pendentes
- **Planos de manutenção**: recorrência por tempo/KM, alertas
- **Gestão de pneus**: cadastro técnico, leituras e histórico

Recursos:

- modais padronizados (registrar/editar)
- métricas por aba
- tabela com ordenação por coluna

### 5.6 Abastecimentos

Controle crítico para prevenção de fraude:

- veículo, motorista, filial, data/hora, combustível, litros, valor, odômetro
- cálculo de consumo médio
- detecção de anomalias por regra

Regras de anomalia:

- faixa padrão para pesado/diesel (configurada no sistema)
- faixa personalizada por veículo (quando aplicável)
- alertas e notificação no cabeçalho

### 5.7 Débitos e Multas

Gestão financeira de obrigações:

- multas, IPVA, licenciamento, seguro e demais débitos
- status (pendente, vencida, paga, recorrida)
- vencimento e alerta automático

Recursos:

- cards-resumo por status
- ordenação e filtros
- classificação de vencidas no topo (quando aplicável)

### 5.8 Gestão de Viagens

Controle de uso da frota:

- veículo, motorista, origem/destino
- KM saída e retorno
- motivo, data/hora

### 5.9 Gestão de Documentos

Controle documental da frota:

- cadastro de documento por veículo
- anexos
- monitoramento de vencimento

### 5.10 Filiais

Cadastro e manutenção de unidades:

- edição e exclusão
- integração com filtros e escopos dos demais módulos

### 5.11 Como usar

Módulo de onboarding interno:

- manual de uso no frontend (sem PDF)
- feed de vídeos explicativos
- inclusão manual de vídeos por `ADMIN`

### 5.12 Usuários

Gestão de usuários e perfis com regras de acesso por papel.

### 5.13 Administração

Configuração central do sistema em três áreas principais:

- parâmetros gerais e padrões
- visibilidade de páginas do menu lateral
- publicação manual de atualizações (system logs)

## 6. Notificações

Notificações no header contemplam:

- anomalias de abastecimento
- manutenções próximas
- débitos a vencer e vencidos

Características:

- contador de pendências
- modal com itens individuais
- redirecionamento contextual para a tela relacionada

## 7. Logs do Sistema (System Logs)

O modal de logs foi configurado para apresentar **somente atualizações manuais**.

Fonte única:

- botão **Informar atualização** na página **Administração**

Não entram mais nos logs:

- eventos automáticos de API
- login/logout
- ações técnicas internas

## 8. Configuração de Visibilidade do Menu

Na Administração existe a seção:

- **Visibilidade do menu lateral**

Funções:

- marcar/desmarcar páginas visíveis
- salvar configuração
- restaurar menu padrão

Persistência:

- `localStorage` (chave: `evfleet_menu_visibility_v1`)

Atualização em tempo real:

- evento de janela `evfleet-menu-visibility-updated`

## 9. Fluxo Operacional Recomendado

1. Cadastrar filiais
2. Cadastrar veículos
3. Cadastrar motoristas
4. Registrar abastecimentos com odômetro
5. Criar planos de manutenção
6. Registrar débitos/documentos e vencimentos
7. Acompanhar dashboard e notificações
8. Extrair relatórios por período

## 10. Padrões de UX/UI Adotados

- layout corporativo consistente entre páginas
- tabelas com ordenação por categorias
- status com semântica visual
- modais padronizados para cadastro/edição
- mensagens de validação claras no formulário

## 11. Persistência Local (Frontend)

Dados em `localStorage` usados no frontend:

- configurações administrativas
- visibilidade do menu
- feed de vídeos da página Como usar
- metadados de autenticação (token/nome)

## 12. Solução de Problemas (Troubleshooting)

### Erro de CORS ou `Network Error`

- validar URL do backend
- validar porta e disponibilidade da API
- confirmar políticas CORS no backend

### Erro `404` em endpoint

- verificar rota no backend
- validar se frontend está chamando endpoint correto (sem prefixo indevido)

### Erro `401/403`

- validar token e perfil do usuário
- confirmar autorização do papel para a ação

### Erro de data (dia anterior)

- usar parse de data local (`YYYY-MM-DD`) sem converter para UTC indevidamente

## 13. Evolução Recomendada

- migração de configurações de `localStorage` para backend persistente
- versionamento formal de releases
- trilha de auditoria completa no backend
- controle de feature flags por tenant
- testes automatizados por módulo crítico

## 14. Referências de Código (Frontend)

- Layout e menu: `src/layouts/AppLayout.tsx`
- Administração: `src/pages/Administration/index.tsx`
- Manutenções: `src/pages/MaintenanceRecords/index.tsx`
- Como usar: `src/pages/HowTo/index.tsx`
- Rotas: `src/routes/index.tsx`
- Serviços:
  - `src/services/menuVisibility.ts`
  - `src/services/systemLogs.ts`
  - `src/services/howToVideos.ts`
  - `src/services/api.ts`

