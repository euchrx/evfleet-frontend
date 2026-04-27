# EvFleet - Documentação Completa do Sistema

## 1. Visão geral

O **EvFleet** é uma plataforma SaaS de gestão operacional e financeira com foco em **rede de postos**, abastecimentos, produtos comprados no posto e controle da frota vinculada à operação.

O sistema foi organizado para atender dois cenários ao mesmo tempo:
- operação diária da frota
- visão gerencial e financeira da empresa

Objetivos principais:
- centralizar veículos, motoristas, abastecimentos, pneus, manutenções, viagens, documentos, débitos e produtos
- reduzir retrabalho operacional com fluxos rápidos e contexto por veículo
- apoiar a gestão de custos e compliance
- dar rastreabilidade para mudanças, cobranças, suporte e histórico operacional

## 2. Stack e arquitetura

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Axios para integração com a API

### Backend
- NestJS
- Prisma
- PostgreSQL
- JWT para autenticação

### Modelo de operação
- frontend SPA consumindo API REST
- módulos administrativos e operacionais convivendo no mesmo produto
- escopo por empresa, com filtros e permissões por perfil

## 3. Perfis e permissões

Perfis ativos:
- `ADMIN`
- `FLEET_MANAGER`

Regras principais:
- `ADMIN` acessa empresas, usuários, administração, assinatura, suporte e visão global
- `FLEET_MANAGER` atua no fluxo operacional da empresa vinculada
- algumas páginas ficam visíveis ou ocultas conforme configuração da Administração

## 4. Assinatura, planos e cobrança

O EvFleet possui gestão de assinatura por empresa.

### Regras atuais
- período de teste permitido apenas no plano `Starter`
- o trial pode ser obrigatório ou opcional conforme configuração administrativa do aceite legal
- mudança de plano por checkout só altera o plano ativo após confirmação de pagamento
- histórico exibido ao cliente mostra apenas pagamentos efetivamente pagos
- administradores podem aplicar ações manuais como:
  - marcar como pago
  - aplicar período de teste

### Status relevantes
- `ACTIVE`
- `TRIALING`
- `PAST_DUE`
- `CANCELED`

## 5. Login, aceite de termos e privacidade

O login foi endurecido para separar claramente o fluxo do administrador e o fluxo da empresa.

### Regras atuais
- `ADMIN` não aceita termos pela empresa
- usuários vinculados à empresa podem ser obrigados a aceitar os termos no login
- o aceite é persistido na empresa, com versão
- aceites anteriores continuam válidos até mudança de versão
- a obrigatoriedade do aceite pode ser ativada ou desativada pela Administração

### Comportamento esperado
- se a obrigatoriedade estiver desligada, o login segue normalmente
- se estiver ligada, o aceite vira obrigatório para usuários não admin quando a empresa ainda não aceitou a versão vigente

## 6. Menu lateral atual

Ordem atual da navegação principal:

1. Dashboard
2. Relatórios
3. Veículos
4. Motoristas
5. Abastecimentos
6. Produtos
7. Manutenções
8. Gestão de pneus
9. Débitos e Multas
10. Gestão de Viagens
11. Gestão de Documentos
12. Filiais
13. Como usar
14. Suporte

Itens administrativos:
- Empresas
- Usuários
- Administração
- Assinatura

Observação:
- a Administração controla a visibilidade do menu lateral
- algumas páginas operacionais podem ser ocultadas
- o suporte fica acessível mesmo sem empresa selecionada para o administrador

## 7. Módulos do sistema

### 7.1 Dashboard
- indicadores de custo:
  - combustível
  - produtos
  - manutenção
  - pneus
  - débitos e multas
- total consolidado de despesas
- rankings e detalhes por motorista e veículo
- cards e modais de detalhamento financeiro

### 7.2 Relatórios
- filtros por período
- consolidação por módulos
- exportação em PDF
- cobertura atual de:
  - abastecimentos
  - produtos
  - manutenções
  - pneus
  - débitos
  - viagens
  - documentos
- tradução de labels operacionais para pt-BR

### 7.3 Veículos
- cadastro e edição de veículo
- vínculo principal por empresa
- filial opcional
- histórico do veículo
- tipos e categorias, incluindo `Implemento`
- suporte a combustível `ARLA32`
- status operacional com reflexo automático de manutenção pendente

### 7.4 Motoristas
- cadastro de motoristas
- vínculo opcional com veículo
- controle de CNH
- criação automática do documento de CNH ao cadastrar motorista
- visualização rápida do número da CNH com atalho para o módulo de documentos
- alerta de vencimento de CNH com antecedência e contagem regressiva

### 7.5 Abastecimentos
- cadastro manual de abastecimentos
- consumo médio
- comparação por veículo e motorista
- anomalias de consumo
- importação moderna de XML com preview + confirm
- consolidação de itens importáveis por nota fiscal
- suporte a combustível e `ARLA 32`

### 7.6 Produtos
- módulo de produtos comprados na rede de postos
- foco em itens de conveniência, perfumaria, cosméticos, lubrificantes e similares
- tabela no padrão operacional do sistema
- importação de XML com preview + confirm
- exclusão em lote
- categorização automática, com grupos como:
  - `PERFUMARIA`
  - `COSMETICOS`
  - `LUBRIFICANTES`
  - `CONVENIENCIA`
  - `LIMPEZA`
  - `OUTROS`

### 7.7 Manutenções
- módulo centrado em:
  - registros de manutenção
  - custos
  - histórico técnico
  - serviços executados
  - filtros e listagens
- a gestão visual de pneus foi removida de dentro de Manutenções
- agora Manutenções conversa com Gestão de pneus por rota e contexto

### 7.8 Gestão de pneus
- módulo oficial de operação visual de pneus
- mapa de pneus por veículo
- vinculação por `vehicleId` em query string
- cadastro de pneu
- movimentação
- rodízio e posicionamento
- estoque, reserva e estepe
- histórico de movimentação
- integração com manutenção do veículo e manutenção do pneu

### 7.9 Débitos e Multas
- gestão financeira da frota:
  - IPVA
  - multas
  - licenciamento
  - seguros
  - pedágios
  - impostos
  - outros débitos
- status rápidos
- ação rápida de alteração de status direto na tabela
- notificações de vencimento

### 7.10 Gestão de Viagens
- planejamento e execução
- veículo, motorista, rota, datas, KM e status
- integração com o dashboard para cálculo de KM rodado

### 7.11 Gestão de Documentos
- módulo dividido por abas:
  - Veículos
  - Motoristas
  - Documentos gerais
- suporte a documentos monitoráveis por vencimento
- exemplos atuais:
  - CNH
  - MOPP
  - exame toxicológico
  - CRLV
  - CIV
  - CIPP
  - autorização ambiental
  - RNTRC
  - RG
  - CPF
  - ficha de registro / contrato
- campos condicionais por tipo de documento
- ação `Ver anexo` / `Anexar`
- alteração rápida de status

### 7.12 Filiais
- cadastro de filiais por empresa
- uso opcional para organização operacional e relatórios
- só aparecem filiais da empresa selecionada ou da empresa do usuário

### 7.13 Como usar
- base de onboarding no próprio sistema
- conteúdo visual e textual para orientar operação

### 7.14 Suporte
- módulo de pedidos de suporte do cliente
- visível para clientes do plano `Starter`
- uso para:
  - bugs
  - melhorias
  - pedidos relacionados ao software
- fluxo:
  - cliente abre pedido
  - admin responde
  - admin define prazo
  - admin conclui
- notificações:
  - admin é notificado sobre pedido novo
  - cliente é notificado sobre resposta
  - cliente é notificado sobre conclusão
- apenas administrador pode excluir chamado

### 7.15 Empresas
- cadastro de empresas
- exclusão definitiva com backup
- tabela operacional + visão financeira
- ação rápida para saltar da empresa para a tabela de finanças com destaque

### 7.16 Administração
- visibilidade do menu lateral
- limites operacionais
- aceite legal
- configurações gerais
- publicações de atualização do sistema

## 8. Importação de XML

O EvFleet possui dois fluxos principais de importação de NF-e:

### 8.1 XML de Abastecimentos
- preview por nota
- confirmação por grupos consolidados
- combustível e ARLA tratados como itens operacionais de abastecimento
- bloqueio de duplicidade

### 8.2 XML de Produtos
- preview por nota
- seleção por item
- ignora combustível e ARLA
- categorização automática
- bloqueio de duplicidade por item da nota

## 9. Notificações

As notificações ficam no header.

### Regras atuais
- `ADMIN` vê apenas notificações de suporte
- usuários operacionais veem notificações da empresa
- pendências continuam registradas para conferência

### Janelas de alerta
- débitos: até 30 dias antes do vencimento
- documentos: até 30 dias antes do vencimento
- manutenções: até 15 dias antes do prazo
- itens vencidos ou atrasados continuam aparecendo enquanto estiverem pendentes

## 10. Regras funcionais importantes

### 10.1 Escopo por empresa
- o sistema trabalha com escopo por empresa
- usuários veem apenas dados da empresa vinculada
- admin pode selecionar empresa quando necessário

### 10.2 Veículo em manutenção
- se existir manutenção pendente do veículo, o status operacional pode refletir isso automaticamente

### 10.3 Documentação automática da CNH
- ao cadastrar motorista, a base documental da CNH é criada automaticamente
- depois o anexo pode ser feito pela Gestão de Documentos

### 10.4 Ações rápidas de status
- documentos
- débitos
- manutenções

### 10.5 Foco em rede de postos
- o sistema não é apenas frota genérica
- ele foi moldado para operação conectada a posto:
  - combustível
  - ARLA
  - produtos de conveniência
  - XML de NF-e
  - custos associados à rotina do posto e da frota

## 11. Fluxo operacional recomendado

1. Configurar empresa, assinatura e administração.
2. Definir visibilidade dos módulos.
3. Cadastrar veículos.
4. Cadastrar motoristas.
5. Validar documentos de veículos e motoristas.
6. Operar abastecimentos e produtos com importação de XML quando aplicável.
7. Acompanhar manutenção e gestão de pneus em módulos separados.
8. Monitorar débitos, viagens e vencimentos.
9. Usar dashboard e relatórios para controle gerencial.
10. Usar suporte quando o cliente estiver no plano elegível.

## 12. Observações finais

- o produto evoluiu bastante e hoje a documentação precisa acompanhar o fluxo real do sistema
- o centro do produto é a operação integrada entre rede de postos, produtos, abastecimentos e frota
- as páginas e regras administrativas foram reorganizadas para reduzir duplicidade e melhorar clareza operacional
