# SIR Dashboard — regras de trabalho

## Duas versões no mesmo site (desde a v70)

| Versão | Pasta no repositório | Endereço |
|---|---|---|
| **Principal** (usada no dia a dia) | raiz do repositório | `…/sir-92387960d4/` |
| **Backup** (onde as mudanças são feitas e testadas) | `backup/` | `…/sir-92387960d4/backup/` |

1. **Toda alteração no dashboard é feita SÓ dentro de `backup/`.** Não mexer nos arquivos da raiz.
2. Quando o usuário disser **"publique na principal"**: copiar todo o conteúdo de `backup/` para a raiz,
   substituindo os arquivos (não copiar a própria pasta `backup/`), e enviar ao ramo `main`.
   Conferir depois que a raiz ficou igual à `backup/`, por exemplo com:
   `diff -rq --exclude backup --exclude .git --exclude .github --exclude worker --exclude docs --exclude CLAUDE.md --exclude AGENTS.md --exclude .nojekyll . backup`
3. Ficam fora dessa regra (existem só na raiz e servem às duas versões):
   `worker/` (servidor de notificações/nodes no Cloudflare), `.github/` (publicações automáticas),
   `docs/`, `CLAUDE.md`, `AGENTS.md`, `.nojekyll`.
   Mudança nesses itens afeta as duas versões — avisar o usuário antes.
4. O código é o mesmo nas duas versões. A backup se identifica sozinha pelo endereço (`/backup/`):
   selo "BACKUP" no rodapé, título da aba com "BACKUP ·" e caches próprios do service worker
   (`sir-backup-vNN`). Não criar diferenças manuais entre as duas.
5. A cada mudança: aumentar a versão em `js/layout-v2.js` (`SIR_APP_VERSION`) e no `sw.js` (`CACHE_NAME`),
   sempre com o mesmo número.
6. As duas versões estão no mesmo endereço de site, então compartilham as preferências salvas no aparelho
   (localStorage) e a chave de acesso. Mudanças no formato de dados salvos precisam continuar lendo o formato antigo.

## Outras regras do usuário
- Não publicar na principal sem o pedido "publique na principal" (ou "publique").
- Se o usuário não aprovar uma versão, oferecer voltar para até 5 versões anteriores (a imediatamente anterior primeiro).

## Revisão automática por agentes (desde a v78)
Depois de cada alteração em `backup/` e ANTES de enviar ao GitHub, rodar os agentes de revisão **sem esperar o usuário pedir**.
As definições ficam em `.claude/agents/`. Rodar em paralelo os que se aplicam:

| Quando | Agente | Skills que ele usa |
|---|---|---|
| Qualquer mudança de tela (layout, cor, texto, animação) | `sir-visual` | frontend-design, design:design-critique, design:design-system, design:ux-copy |
| Mudança em gráfico, cartão de números, mapa de calor | `sir-graficos` | dataviz |
| Qualquer mudança de tela | `sir-acessibilidade` | design:accessibility-review |
| Toda mudança de código (sempre) | `sir-codigo` | engineering:code-review, engineering:debug, engineering:testing-strategy |
| Pedido "publique na principal" / "publique" | `sir-publicacao` | engineering:deploy-checklist |

Como agir com o resultado:
- Itens **[corrigir agora]**: corrigir na hora e rodar de novo só o agente que apontou.
- Itens **[sugestão]**: não aplicar sozinho; listar em 1–3 linhas no fim da resposta para o usuário escolher.
- Na resposta ao usuário, dizer em uma linha que a revisão passou (ou o que foi corrigido), sem detalhar o processo.
- Ferramenta sem agentes (ex.: Antigravity): seguir o "Checklist" de cada arquivo em `.claude/agents/` como roteiro de revisão.
