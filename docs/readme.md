# SIR Dashboard — COP REDE Fibra RJ/ES

Sistema operacional web desenvolvido para o **Centro de Operações de Rede Fibra Empresarial RJ/ES**. Centraliza o acompanhamento de chamados, gerenciamento de incidentes e ferramentas de operação em uma única interface unificada, sem backend ou banco de dados externo.

---

## Visão Geral

O SIR Dashboard é uma **Progressive Web App (PWA)** completamente client-side. Toda a persistência de dados é local (localStorage + IndexedDB) e os dados de chamados são obtidos de arquivos CSV hospedados no GitHub, atualizados automaticamente a cada 5 minutos.

| | |
|---|---|
| **Stack** | HTML5 + CSS3 + JavaScript ES6+ (sem frameworks) |
| **Design** | Dark theme premium, glassmorphism, paleta Indigo |
| **Dados** | CSVs remotos (GitHub raw) — RAL e REC |
| **Persistência** | localStorage + IndexedDB (sem backend) |
| **Offline** | Service Worker + snapshot em IndexedDB |
| **Instalação** | PWA instalável (desktop e mobile) |

---

## Estrutura do Projeto

```
SIR-DASHBOARD/
├── index.html                  # Ponto de entrada e hub principal da aplicação
├── css/
│   └── styles.css              # Estilização completa (temas, animações, componentes)
├── js/
│   ├── app.js                  # Bootstrap, atalhos de teclado, inicialização
│   ├── config.js               # Constantes, regiões, URLs dos CSVs, mapeamentos de CF
│   ├── state.js                # Estado global da aplicação
│   ├── utils.js                # Funções utilitárias (escape HTML, parsing, formatação)
│   ├── ui.js                   # Feedback de UI (toasts, sons, contraste, PWA prompt)
│   ├── db.js                   # Operações IndexedDB (histórico, snapshots)
│   ├── persistence.js          # Persistência em localStorage (tickets, tabelas, inbox)
│   ├── data-loader.js          # Fetch/parse CSV do GitHub, timer de atualização
│   ├── csv-worker.js           # Web Worker para parsing de CSV em background
│   ├── dashboard.js            # Renderização do dashboard, modos de visualização
│   ├── modal.js                # Modal de detalhes, cálculo de SLA, gestão de OBS
│   ├── inbox.js                # Sistema de inbox para notificações de novos chamados
│   ├── settings.js             # Seleção de áreas, presets, gestão de CFs
│   ├── torpedos.js             # Gerenciador de eventos com timers de 60 min
│   ├── mascaras.js             # Templates de texto com timestamp automático
│   ├── scripts.js              # Biblioteca de textos reutilizáveis
│   ├── historico.js            # Registro histórico (IndexedDB)
│   ├── timer.js                # Cronômetro flutuante e timer regressivo
│   ├── backup.js               # Export/import de dados (JSON)
│   ├── siglas.js               # Integração modal do buscador de siglas
│   └── personalizacao.js       # Temas, densidade, modos de visualização, toolbar
├── pages/
│   └── lock.html               # Tela de autenticação (desafio SHA-256)
├── tools/
│   └── buscador_siglas.html    # Ferramenta de busca de siglas/CSL
├── assets/
│   ├── manifest.json           # Manifesto PWA
│   ├── sw.js                   # Service Worker (cache offline)
│   └── icon.svg                # Ícone da aplicação
└── docs/
    └── readme.md               # Esta documentação
```

---

## Módulos e Funcionalidades

### Dashboard Principal

Painel de visualização em tempo real dos chamados RAL (Repair Action Level) e REC (Reclamação) por região e CF (Centro de Fusão).

- Dados atualizados automaticamente a cada **5 minutos** via CSV remoto
- Quatro **modos de visualização:** Cards, Barras, Bolhas (animação orbital) e Heatmap
- Agrupamento por regiões: **ES** (4 CFs), **RIO A** (7 CFs), **RIO B** (5 CFs)
- **Timers de SLA** ao vivo: 4h para REC, 6h para RAL
- **Código de cores** por quantidade: Verde (<5), Amarelo (5–9), Vermelho (>10)
- Seleção de áreas para filtrar quais CFs monitorar

### Inbox

Sistema de notificação para novos chamados detectados na atualização.

- Alerta sonoro e visual ao detectar novos RAL/REC
- Marcação de itens como vistos (acknowledgment)
- Filtro por tipo (RAL/REC)
- Estado persistido entre recarregamentos
- Badge de contagem no título da aba

### Torpedos — Gerenciador de Incidentes

Ferramenta central para acompanhamento de eventos de rede em andamento.

- Criação de múltiplos eventos simultâneos com numeração automática
- Formulário com **15 campos** por evento:
  - Contadores REC/RAL, Cluster, Cidade, Referências
  - Horários de Abertura, Recebimento e Acionamento Técnico
  - Status, Causa, Previsão, Fechamento
  - Métricas SLA: Esert4h% e Esert6h%
- **Timer regressivo de 60 minutos** por evento com alerta ao expirar
- Botão COPIAR formata e envia o torpedo para a área de transferência
- Exclusão do evento somente quando os campos de fechamento estão preenchidos
- Auto-save a cada keystroke via localStorage

**Fluxo típico:**
1. Criar novo evento → preencher formulário
2. COPIAR → colar no grupo de equipe → timer reinicia
3. Atualizar status a cada acionamento
4. EXCLUIR somente após encerramento completo

### Máscaras — Templates de Texto

Geração rápida de mensagens padronizadas com timestamp automático.

- Timestamp arredondado para o múltiplo de 5 minutos mais próximo
- Nome do operador persistido entre sessões
- Biblioteca de variações salváveis
- Modo de texto livre com preview em tempo real
- Cópia com um clique

### Scripts — Biblioteca de Textos

Repositório de textos e respostas reutilizáveis.

- Cadastro com nome e conteúdo
- Tags de categoria para organização
- Busca e filtro em tempo real
- Clique no card copia instantaneamente
- Atalho `Shift + Enter` para salvar

### Histórico

Registro persistente de atividades e observações operacionais.

- Armazenado em **IndexedDB** (sobrevive a limpeza de cache)
- Operações completas: criar, visualizar, editar, excluir
- Exportação para ZIP com todos os registros
- Busca por título ou conteúdo
- Migração automática de dados do localStorage na primeira carga

### Timer

Cronômetro flutuante independente.

- Arraste e redimensione na tela
- Alternância entre modo stopwatch e timer regressivo
- Alerta quando o timer regressivo chega a zero
- Estado persistido entre sessões

### Backup e Restauração

Exportação e importação completa de todos os dados do sistema.

- Exporta scripts, histórico, torpedos, máscaras e configurações em **JSON**
- Importação via drag-and-drop ou seleção de arquivo
- Exibe estatísticas de uso de armazenamento
- Restauração sobrescreve todos os dados atuais

### Buscador de Siglas

Ferramenta de consulta de siglas e localidades da rede (`tools/buscador_siglas.html`).

---

## Autenticação

Acesso protegido por uma chave de acesso verificada via **SHA-256** no navegador.

- Nenhuma senha é armazenada em texto claro
- Flag de sessão em localStorage (`sir_auth_v1`)
- Tela de bloqueio: `pages/lock.html`
- Redirecionamento automático se não autenticado

---

## Personalização

| Configuração | Opções |
|---|---|
| **Tema de cor** | Indigo, Blue, Cyan, Green, Amber, Rose, AMOLED |
| **Densidade** | Padrão / Compacto |
| **Contraste** | Normal / Alto Contraste |
| **Som** | Ativado / Desativado |
| **Visualização** | Cards / Barras / Bolhas / Heatmap |
| **Toolbar** | Reordenar e ocultar botões |
| **Áreas** | Presets de seleção de CFs por região |

---

## Modos de Operação Offline

O sistema funciona sem conectividade graças a duas camadas de fallback:

1. **Service Worker** (`assets/sw.js`) — faz cache dos assets da aplicação
2. **IndexedDB Snapshot** — ao falhar o fetch do CSV, carrega o último snapshot salvo

Um banner é exibido para indicar ao operador que os dados podem estar desatualizados.

---

## Regiões e CFs Monitoradas

| Região | CFs |
|---|---|
| **ES** | MTN, MTS, NOR, SUL |
| **RIO A** | SUF, SEF, NOF, LGS, CZS, SU2, OE1 |
| **RIO B** | NO1, NO2, BX1, MTP, NO3 |

---

## SLA — Indicadores de Qualidade

| Indicador | Tipo | Prazo |
|---|---|---|
| **Esert6h** | RAL — deslocamento técnico | 6 horas |
| **Esert4h** | REC — reclamação de cliente | 4 horas |

**Fórmula:** `((Total − Excedidos) / Total) × 100`

---

## Armazenamento Local

**localStorage** (configurações e estado operacional):

| Chave | Conteúdo |
|---|---|
| `sir_auth_v1` | Flag de autenticação |
| `sir_minhas_areas` | CFs selecionados |
| `sir_presets` | Presets de área |
| `minha_central_scripts` | Biblioteca de scripts |
| `minhas_variacoes_bw` | Templates de máscaras |
| `cop_rede_premium_data` | Cache de torpedos |
| `sir_inbox_state_v5` | Estado do inbox |
| `sir_ticket_state_v5` | Cores e OBS por ticket |
| `sir_table_state_v5` | Ordenação e estado do modal |
| `sir_theme` | Tema de cor selecionado |
| `sir_view_mode` | Modo de visualização |

**IndexedDB** (`sir-dashboard`):

| Store | Uso |
|---|---|
| `historico` | Registros do histórico operacional |
| `snapshots` | Últimos dados CSV (fallback offline) |

---

## Como Usar

Não requer instalação de servidor ou dependências.

1. Abra `index.html` diretamente no navegador, ou sirva via servidor HTTP local
2. Insira a chave de acesso na tela de bloqueio
3. A interface carrega o dashboard automaticamente
4. Use a **toolbar lateral** para navegar entre as ferramentas

> **Recomendado:** Google Chrome ou Microsoft Edge para suporte completo a todas as Web APIs utilizadas.

**Instalação como PWA:** Após autenticar, o navegador oferece a opção de instalar o app — ele passa a funcionar como aplicativo nativo sem barra do navegador.

---

## Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `Shift + Enter` | Salvar script (na tela de scripts) |
| `Enter` | Navegar entre campos (torpedos) |
| `?refresh=1` | Forçar atualização via URL |

---

## Compatibilidade de Navegadores

| Navegador | Suporte |
|---|---|
| Chrome / Edge 90+ | Completo |
| Firefox 88+ | Completo |
| Safari 15+ | Parcial (limitações de PWA) |

**APIs necessárias:** ES6+, CSS Grid, IndexedDB, Web Workers, Service Workers, Crypto API, Clipboard API, Web Audio API.

---

## Glossário

| Termo | Significado |
|---|---|
| **COP** | Centro de Operações |
| **CF** | Centro de Fusão (nó regional da rede) |
| **REC** | Reclamação — ticket de cliente |
| **RAL** | Repair Action Level — ordem de deslocamento técnico |
| **Torpedo** | Mensagem de status enviada às equipes |
| **Esert** | Indicador de SLA de restabelecimento de serviço |
| **CSL** | Identificador de localidade/sigla na rede |
| **OBS** | Observação de status de um ticket |
| **SLA** | Service Level Agreement — acordo de nível de serviço |
