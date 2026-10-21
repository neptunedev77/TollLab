# TollLab — Plano técnico

Versão inicial (Etapa 0, 21/10/2026). Este documento é atualizado sempre que uma decisão mudar.

## 1. Ambiente verificado

| Ferramenta | Versão |
| --- | --- |
| Sistema operativo | Windows 11 Pro 10.0.26300 |
| Node.js | 24.21.0 |
| npm | 11.19.0 |
| git | 2.55.0.windows.5 |
| pnpm / yarn | não instalados (usa-se npm) |

Versões base instaladas: Vite 8.3.5, React 19.3.1, TypeScript 6.0.3, Vitest 5.0.5, oxlint 1.89.0.

## 2. Arquitetura

O princípio orientador é **um núcleo de domínio em TypeScript puro**, sem dependências de React, Three.js
ou do DOM, envolvido por camadas finas de apresentação.

```
src/
  domain/        tipos e invariantes (nós, arestas, portagens, veículos, tarifas, cenários)
  simulation/    motor: percursos, procura, relógio, cobrança, economia (TS puro, testável em Node)
  data/          rede de demonstração esquemática + validação
  store/         Zustand: estado da UI e ponte com o motor
  components/
    map/         renderização do mapa e interação (pan/zoom/seleção)
    scene3d/     pórticos e veículos 3D (instancing)
    panels/      painel lateral contextual
    analytics/   métricas e comparação de cenários
  utils/         PRNG com semente, geometria, formatação
  tests/         testes transversais (os unitários ficam junto ao código ou aqui)
```

Fluxo de dados: `UI → store (ações) → motor (funções puras / instância do simulador) → resultados → store → UI`.
O motor nunca importa nada de `components/` nem de `store/`. Esta regra será verificada por um teste
de imports ou por uma regra de lint quando o código existir.

### Sistemas de coordenadas

São três e nunca se misturam:

1. **Topologia**: IDs de nós e arestas, sem qualquer coordenada.
2. **Coordenadas do mundo esquemático**: um plano cartesiano arbitrário (unidades "esquemáticas"), onde
   cada aresta tem uma polilinha. As portagens guardam `{ edgeId, t }` com `t ∈ [0, 1]` ao longo da
   polilinha, por isso ficam sempre ancoradas à estrada.
3. **Coordenadas de ecrã**: só existem na camada de renderização, através da câmara ou do viewport.

## 3. Decisões técnicas

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D1 | Fonte do mapa | **Vetorial esquemático**, não MapLibre | Não há geometria real validada nem licença definida, e a aplicação tem de funcionar offline e sem serviços externos. A especificação proíbe inventar coordenadas ou alegar precisão. Uma interface `MapSource` permite trocar mais tarde para dados reais (GeoJSON + MapLibre). |
| D2 | Renderização do mapa e 3D | **Proposta: uma única cena WebGL com React Three Fiber** (câmara ortográfica com inclinação ligeira), estradas como faixas, pórticos 3D e veículos com `InstancedMesh` | Evita sincronizar uma camada SVG com uma camada 3D separada (fonte de desfasamentos), dá instancing nativo para muitos veículos e permite picking por raycasting. A alternativa é SVG para o mapa mais Canvas 2D para veículos, sem 3D: é mais simples, mas fica aquém do requisito de pórticos e veículos 3D. **Requer confirmação antes da Etapa 3.** |
| D3 | Estado | **Zustand** | É leve e tem uma API "vanilla" que permite ao relógio da simulação escrever fora do ciclo do React. Os componentes subscrevem só o que precisam. |
| D4 | Lint | **oxlint** (padrão do create-vite 9) com os plugins react, typescript, jsx-a11y e vitest; falha com warnings | Uma só dependência, muito rápido e sem configuração ESLint extensa. Se faltar alguma regra crítica, adiciona-se ESLint pontualmente. |
| D5 | TypeScript | `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` e `no-explicit-any` como erro | O modelo de grafo tem muitos acessos por ID; `noUncheckedIndexedAccess` obriga a tratar referências em falta. |
| D6 | Aleatoriedade | PRNG próprio com semente (ex.: mulberry32) em `utils/` | Garante reprodutibilidade sem dependência externa. `Math.random` fica proibido no motor. |
| D7 | Relógio | Passo fixo de simulação (ex.: 100 ms simulados), independente do `requestAnimationFrame`. O render interpola entre estados | Cumpre a separação simulação/render, a reprodutibilidade e as velocidades 1x/2x/4x. |
| D8 | Regra de cobrança (proposta) | **Por pórtico**: cada travessia de um pórtico ativo que pertença ao percurso gera um evento com ID único e tarifa por classe de veículo | É a regra mais simples, consistente e testável. Os totais são sempre agregações de eventos. |
| D9 | Persistência | `localStorage` com envelope versionado `{ version, data }`, validação ao carregar e migrações explícitas | Funciona offline. Dados corrompidos repõem a configuração por omissão com aviso, sem bloquear o arranque. |
| D10 | Testes | Vitest (unitários e integração) agora; Testing Library + jsdom na Etapa 1; Playwright na Etapa 9 | Cada dependência entra quando é precisa. |
| D11 | Estrutura | O projeto fica na raiz da pasta/repositório `TollLab` | O repositório remoto estava vazio e a pasta só continha a especificação. |

### Decisões da Etapa 1

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D12 | Tema | Um único tema claro "cozy": neutros quentes, raios generosos (14/20/28 px), botões em pílula com "lábio" tátil, sombras suaves e micro-interações com uma ligeira mola. Os tokens estão em `src/index.css` (`@theme` do Tailwind v4) | Dá uma experiência lúdica e fluida sem mecânicas de jogo. Os tokens permitem acrescentar um tema escuro mais tarde sem mexer nos componentes. |
| D12a | Tipografia | Nunito Variable via `@fontsource-variable/nunito` (licença OFL-1.1), incluída no bundle | É arredondada e legível em números, e funciona offline, sem pedidos a serviços externos. O browser só descarrega o subconjunto latino. |
| D12b | Layout em ilhas | O mapa e o painel são cartões flutuantes sobre um fundo quente, separados por 8 px | Visual mais suave; o mapa fica com ≈ 74% da largura a 1280 e a 1440. |
| D12c | Animações de entrada | Não se usa fade de opacidade em conteúdo essencial | Se a animação for congelada (separador em segundo plano, por exemplo), o conteúdo nunca fica invisível. |
| D13 | Ações ainda sem modelo | Usam `aria-disabled` com o motivo num tooltip, em vez de `disabled` | Ficam focáveis e explicam porque estão indisponíveis. Não fingem fazer nada, por isso não são botões decorativos. |
| D14 | Tooltips | O balão é desenhado num portal com posição fixa e limitado à janela. A descrição acessível fica sempre junto ao alvo | Evita cortes e scroll horizontal dentro do painel lateral. |
| D15 | Painel lateral | Fica ao lado do mapa (não sobreposto), com 312 px abaixo de 1440 px de largura e 344 px a partir daí. Abre e fecha a deslizar. Quando fechado fica `inert` | O mapa ocupa ≈ 74% a 1280 e a 1440 e nunca fica tapado. |
| D16 | Animação de interface | Sem Framer Motion por agora: transições CSS e redução global com `prefers-reduced-motion` | Ainda não há animações complexas que justifiquem a dependência. |
| D17 | Galeria do design system | `?gallery`, só em desenvolvimento; eliminada do build de produção | Permite rever os componentes isoladamente. |

### Modelo de dados (Etapa 2)

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D18 | Camadas de dados | `RoadNetwork` (topologia, só IDs), `SchematicLayout` (coordenadas esquemáticas) e `geography: null` | Cumpre a separação entre topologia, apresentação e geografia. Os extremos da geometria vêm sempre das posições dos nós, por isso a geometria não se pode desligar da topologia. |
| D19 | Ancoragem dos pórticos | `{ edgeId, position }` com `position` em ]0, 1[ ao longo da polilinha do troço; separação mínima de 0,02 no mesmo troço | Um pórtico nunca fica solto nem em cima de um nó, e não há duplicados no mesmo ponto. |
| D20 | Dinheiro | Cêntimos inteiros, entre 0 e 10 000 (100 €); formatação `pt-PT` | Evita erros de vírgula flutuante; os valores absurdos são rejeitados. |
| D21 | Classes de veículos | `c1`–`c4`, seguindo a convenção portuguesa de classes 1 a 4; tarifa obrigatória para todas | Prepara as tarifas por classe sem complicar o modelo. |
| D22 | Conectividade | A rede tem de ser fortemente conexa, respeitando os sentidos | Garante que existe sempre algum percurso entre quaisquer dois nós da rede de base. A ausência de percurso fica para cenários editados, tratados pelo motor. |
| D23 | Valores da rede de demonstração | Tempos, capacidades e tarifas ilustrativos; comprimentos `null` | Não há fonte validada; os dados assinalam-se como ilustrativos (`illustrativeValues: true`). |
| D24 | Validação | Funções puras que devolvem todos os problemas (código, caminho e mensagem), sem lançar exceções | Mensagens compreensíveis na interface e testes precisos por tipo de erro. |
| D25 | Configuração TypeScript dos testes | `tsconfig.test.json` com tipos de Node; o código da aplicação continua sem acesso a eles | Os testes de arquitetura leem ficheiros, mas a aplicação nunca deve depender de APIs de Node. |

**Rede de demonstração:** 13 nós (12 cidades e o Nó da Maia) e 29 troços (15 de autoestrada: A3, A4, A7, A28 e A11; 14 de vias nacionais: N13, N14, N15, N101, N201 e N206). Tem 6 pórticos, 5 deles ativos. Todas as cidades estão ligadas também só por vias alternativas, para o motor ter sempre alternativas às portagens.

### Mapa e navegação (Etapa 3)

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D2 | Renderização (confirmada) | Uma única cena WebGL com React Three Fiber 9 e three.js 0.186, sem drei | O mapa, os pórticos e (mais tarde) os veículos partilham a mesma câmara, sem camadas desalinhadas. O drei não é necessário: os rótulos e os controlos usam a nossa matemática da vista. |
| D26 | Câmara | Ortográfica, inclinada 28°; `frameloop="demand"`; `flat` (sem tone mapping) | O chão projeta-se de forma afim, por isso pan, zoom e projeção são funções puras e testáveis (`viewMath.ts`). Só renderiza quando algo muda, e as cores coincidem com os tokens CSS. |
| D27 | Fonte de verdade da vista | `view` no store (Zustand); a câmara e os rótulos DOM seguem-na | Os rótulos ficam sempre alinhados com os nós; recentrar anima o próprio estado (e respeita `prefers-reduced-motion`). |
| D28 | Geometria canónica | Curva Catmull-Rom amostrada (`edgeCurve`) definida no domínio | O desenho, a ancoragem dos pórticos e, mais tarde, os veículos usam exatamente a mesma linha. |
| D29 | Seleção | `select()` só aceita elementos que existem e estão visíveis; esconder uma camada limpa a seleção que deixou de estar visível; clicar no vazio limpa, arrastar não | Mantém a seleção sempre consistente com o que se vê. |
| D30 | Acessibilidade do mapa | Viewport `role="application"` focável (setas, + e −, 0, Esc); rótulos das cidades são botões; o painel de uma cidade lista as ligações como botões | O canvas WebGL não é acessível por si; isto permite selecionar cidades e troços só com o teclado. |
| D31 | Carregamento | A cena 3D é um chunk à parte (`lazy`), com estado de carregamento e fallback sem WebGL | A interface abre sem esperar pelo three.js (~243 kB comprimido). O limite do aviso de chunk subiu para 1000 kB só por causa desse chunk. |
| D32 | Camadas | Nomes das cidades, pórticos e vias alternativas; tráfego, preço e receita aparecem como indisponíveis ("Requer simulação") | Não se mostram camadas sem dados reais por trás. |

**Licenças e dados externos (verificado na Etapa 3):** não há dados geográficos, tiles nem serviços externos; a rede é local e esquemática. Licenças das dependências de execução: React, React DOM, three.js, React Three Fiber e Zustand (MIT), Lucide (ISC), Nunito (OFL-1.1). Ferramentas de desenvolvimento: MIT, exceto o TypeScript (Apache-2.0). Nenhuma exige atribuição visível na interface; as licenças acompanham os pacotes.

## 4. Dependências previstas (ainda não instaladas)

| Etapa | Pacotes |
| --- | --- |
| quando necessário | `motion` (Framer Motion), se as transições CSS não chegarem |
| 4 | `zustand` |
| 9 | `@playwright/test` |

## 5. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Versões muito recentes (Vite 8, TS 6, Vitest 5, React 19.3) podem ainda não ser suportadas por alguns plugins (Tailwind, R3F) | Instalação ou build falham | Verificar `peerDependencies` antes de instalar; fixar versões compatíveis; documentar. |
| Desempenho com centenas de veículos 3D | FPS baixo | `InstancedMesh`, matrizes escritas fora do React, limite configurável de veículos e degradação gradual. |
| Sincronizar o evento visual com o evento económico | Cobrança no sítio errado | A cobrança acontece no motor (passo fixo); o render só reflete os eventos já emitidos. Haverá um teste de integração. |
| Rede esquemática confundida com cartografia real | Credibilidade | Aviso permanente "Mapa esquemático — não cartográfico", sem coordenadas geográficas e sem distâncias reais não documentadas. |
| Convergência do congestionamento (feedback volume → tempo → escolha) | Oscilações e resultados instáveis | Atribuição incremental ou função BPR com amortecimento e iterações limitadas; testes de reprodutibilidade. |
| Acessibilidade de um mapa WebGL | Utilizadores de teclado excluídos | Lista navegável por teclado de troços e portagens no painel, espelhada na seleção do mapa; foco visível. |
| Ambiente Windows (caminhos, finais de linha) | Ruído nos diffs | `.gitattributes` com `eol=lf`. |

## 6. Questões em aberto para o utilizador

1. **D2**: confirmar a cena WebGL única (R3F) para o mapa e o 3D, ou preferir SVG 2D com 3D só nos pórticos e veículos.
2. **D8**: confirmar a cobrança por pórtico (alternativas: por segmento ou por percurso).
