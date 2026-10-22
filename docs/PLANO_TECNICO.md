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
| D32 | Camadas | Nomes das cidades, pórticos e vias alternativas (interruptores); a cor das estradas é uma escolha à parte (D61) | Não se mostram camadas sem dados reais por trás. |

**Licenças e dados externos (verificado na Etapa 3):** não há dados geográficos, tiles nem serviços externos; a rede é local e esquemática. Licenças das dependências de execução: React, React DOM, three.js, React Three Fiber e Zustand (MIT), Lucide (ISC), Nunito (OFL-1.1). Ferramentas de desenvolvimento: MIT, exceto o TypeScript (Apache-2.0). Nenhuma exige atribuição visível na interface; as licenças acompanham os pacotes.

### Mapa de Portugal com posições reais (pedido após a Etapa 3)

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D33 | Fontes geográficas (escolhidas pelo utilizador) | Contorno: Natural Earth, Admin 0 Countries 1:50m (domínio público). Localidades: Wikidata P625 dos municípios (CC0 1.0) | Não exigem atribuição nem serviços pagos, e documentam-se com ID (ex.: Porto = Q36433). O 1:10m (13 MB) não acrescenta nada visível a esta escala. |
| D34 | Separação de camadas | `data/geo/basemap.ts` e `places.ts` guardam lon/lat originais; `projection.ts` projeta-os; a rede guarda só as posições projetadas | Mantém separadas a geografia (dados com fonte), a apresentação (plano do mapa) e a topologia. |
| D35 | Projeção | Equiretangular com latitude de referência 40°; 1 unidade = 250 m | É simples e linear, com distorção pequena à escala de Portugal continental (≈ ±6% leste–oeste nos extremos). Não serve para medições rigorosas. |
| D36 | Traçado dos troços | Continua aproximado (curva entre posições reais); comprimentos `null` | O traçado real exigiria o OpenStreetMap (ODbL, com atribuição) e muito mais dados. Fica assinalado na interface ("traçado das estradas aproximado") e em `geography.roadGeometry`. |
| D37 | Mapa base | Portugal em creme, Espanha (recortada) num tom neutro, mar azul suave; pan limitado ao plano; zoom mínimo mostra o país inteiro | A fronteira com Espanha não deve parecer costa. O mapa abre enquadrado na rede. |
| D38 | Rótulos | Prioridade por número de ligações; se colidirem tentam ficar por baixo do marcador, senão ficam ocultos; nome curto opcional (`shortName`) | Evita sobreposições sem perder as cidades principais; o nome acessível é sempre o completo. |

O script de extração (fora do repositório) lê o GeoJSON do Natural Earth, escolhe o maior polígono de PRT e ESP, recorta Espanha a lon [-10.2, -5.2] e lat [36.4, 44.0], e escreve `basemap.ts` com coordenadas arredondadas a 4 casas decimais (~10 m).

### Edição de portagens (Etapa 4)

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D39 | Operações | Funções puras em `domain/tolls.ts` (adicionar, mover, ativar, tarifa, remover); cada resultado é revalidado com `validateTolls` | É impossível obter um pórtico solto, duplicado, num troço inexistente ou com tarifa inválida (teste com 1000 operações aleatórias). |
| D40 | Ancoragem ao mover | O arrasto projeta o cursor no troço visível mais próximo (raio de 36 px no ecrã); a posição fica entre 4% e 96% do troço; posições em cima de outro pórtico são ignoradas | O pórtico encaixa sempre numa estrada e mantém a associação a um troço. |
| D41 | Estado editável | O store tem `tolls` próprios; o `dataset.tolls` original nunca é alterado ("Repor configuração" volta a ele) | Prepara os cenários independentes da Etapa 8. |
| D42 | Cancelar | Histórico de anular/refazer (100 passos; Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y, botão "Anular"); alterações seguidas ao mesmo controlo juntam-se num passo (1,5 s); Esc cancela um arrasto ou a colocação | Edição rápida e reversível sem confirmações intrusivas. |
| D43 | Tarifas na interface | Slider de 0 a 10 € (passos de 5 cêntimos) e campo em euros até 100 € (vírgula ou ponto; no máximo 2 casas decimais); erros claros; ao sair do campo, um valor inválido é descartado | O modelo nunca recebe valores inválidos e o campo nunca contradiz o modelo. |
| D44 | Classes | Tarifa editável por classe (1–4), independente das restantes | Não há regra que obrigue a classe 2 a custar mais do que a classe 1; fica à escolha do utilizador. |
| D45 | Acessibilidade da edição | A posição no troço também se edita com um slider (teclado); Delete remove o pórtico selecionado com o mapa focado | Mover e remover não dependem do rato. |

### Motor de percursos e procura (Etapa 5)

Código em `src/simulation/` (TypeScript puro; o teste de arquitetura garante que não importa React, three.js nem o store).

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D46 | Custo generalizado | `tempo + portagem ÷ (VOT/60)`, em minutos equivalentes; VOT = valor do tempo do condutor (€/h) | É a forma padrão de juntar tempo e preço; uma portagem "vale" os minutos que o condutor pagaria para os poupar. |
| D47 | Perfis | Com pressa 20 €/h (30%), Equilibrado 10 €/h (45%), Poupado 4 €/h (25%), ilustrativos | Três perfis simples bastam para escolhas diferentes perante a mesma tarifa. |
| D48 | Variação controlada | VOT de cada veículo com ±15% (uniforme) em torno do perfil, arredondado a 0,1 €/h; PRNG mulberry32 com semente (2026 por omissão) | Evita escolhas "em bloco" e mantém resultados reprodutíveis: mesma semente e parâmetros → resultados idênticos (testado). |
| D49 | Caminhos | Dijkstra sobre a adjacência dirigida (respeita sentidos únicos); desempate por ID do troço | Só segue ligações existentes e é determinístico. Na rede de 13 nós a pesquisa linear é suficiente. |
| D50 | Congestionamento | BPR por sentido, `t = t0·(1 + 0,15·(v/c)^4)`; afetação incremental em 5 lotes (ordem baralhada com a semente); cada veículo decide uma vez | É simples, coerente com volume e capacidade e não oscila. Não é um equilíbrio exato (Wardrop); fica documentado como aproximação. |
| D51 | Sem percurso | Veículo com `route: null` e estado `no-route`, contado em `summary.noRoute`; não entra em volumes | Nunca há teletransporte (testado com sentidos únicos que impedem o regresso). |
| D52 | "Evitou portagens" | Um veículo evita portagens se paga menos do que pagaria no percurso mais rápido (só tempo, com os tempos finais); por pórtico, conta quem o teria no percurso mais rápido e escolheu outro caminho | Uma definição mensurável e independente da tarifa escolhida. |
| D53 | Procura de demonstração | 24 pares de cidades nos dois sentidos, 7000 viagens numa hora; 88% classe 1. **Pressupostos ilustrativos, não contagens reais** | Com estes valores a rede tem pouco congestionamento (carga máxima ≈ 23%); subir tarifas desvia tráfego de forma visível. |
| D54 | Integração | `AssignmentProvider` calcula a afetação uma vez por alteração de pórticos (valor diferido com `useDeferredValue`); cerca de 40 ms com 7000 veículos | A interface continua fluida a arrastar sliders; todos os painéis e o mapa leem o mesmo resultado. |
| D55 | Classes e PCE | Todas as classes contam como 1 veículo no congestionamento; pagam a tarifa da sua classe | Simplificação documentada; equivalentes de ligeiros por classe podem ser acrescentados depois. |

Resultados verificados com a semente 2026 (tarifa da classe 1 no pórtico A3 Maia): 1,85 € → 1714 veíc./h na A3 Maia–Famalicão; 4,00 € → 742; 8,00 € → 145. O tráfego desviado segue sobretudo pela A28 + A7 (via Vila do Conde), não pela N14.

### Cobrança, receitas e métricas (Etapa 6)

Código em `src/simulation/charging.ts` (livro de cobranças) e `src/simulation/economics.ts` (receitas e custos).

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D8 | Regra de cobrança (confirmada) | **Por pórtico**: cada travessia de um pórtico ativo do percurso gera um evento com a tarifa da classe do veículo; nos troços de dois sentidos cobra nos dois sentidos; dois pórticos no mesmo troço cobram duas vezes | Simples, consistente e verificável; é também a forma de cobrança das antigas SCUT (pórticos eletrónicos). |
| D56 | Unicidade dos eventos | ID `veículo#passo@pórtico`; o livro recusa duplicados, pórticos inativos, inexistentes ou fora do passo indicado do percurso, e conta as recusas por motivo | Garante "cada passagem elegível é cobrada exatamente uma vez" (testado na rede inteira) e prepara a animação, que vai registar travessias no tempo com o mesmo livro. |
| D57 | Ordem e momento | As travessias seguem a ordem de passagem (invertida no sentido contrário do troço); `atMinute` = tempo até ao passo + fração do troço × tempo do troço com congestionamento | O registo de eventos tem uma cronologia coerente com o percurso. |
| D58 | Totais | Receita bruta, por pórtico, por classe e por troço são sempre somas dos eventos registados | Não há números paralelos: os totais batem com as portagens de cada viagem (testado). |
| D59 | Custos (ilustrativos) | 25 €/h fixos por pórtico instalado (amortização + manutenção, mesmo inativo) e 0,08 € por passagem cobrada | Permite distinguir receita bruta de resultado líquido e mostra que um pórtico inativo continua a custar dinheiro. Não são valores reais. |
| D60 | Resultado líquido | Receita bruta − custos estimados; pode ser negativo; apresentado sempre separado da receita bruta | Evita confundir receita com lucro. |
| D61 | Cor das estradas | Uma escolha exclusiva: classe da via, tráfego (carga), preço (tarifa C1 dos pórticos ativos) ou receita (receita bruta do troço); faixas definidas uma só vez (`COLOR_SCALES`) e partilhadas por mapa e legenda | Substitui as camadas antes indisponíveis; nunca há duas cores de dados sobrepostas. |

**Pressupostos e limitações:** o período é uma hora de procura; os veículos de classes 2–4 contam como 1 veículo no congestionamento mas pagam a tarifa da sua classe; os custos são ilustrativos; a receita não inclui IVA nem descontos.

Resultados com a semente 2026 e os pórticos iniciais: 4853 passagens cobradas, 3494 veículos pagantes, receita bruta 9101,82 €, custos 538,24 € (6 × 25 € + 4853 × 0,08 €), resultado líquido 8563,58 €.

### Animação 3D e sincronização (Etapa 7)

Código: `src/simulation/motion.ts` (pose), `src/simulation/playback.ts` (motor no tempo), `src/components/simulation/PlaybackProvider.tsx` (relógio) e `src/components/scene3d/Vehicles.tsx` (render).

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D62 | Pose analítica | Posição e direção são funções do minuto da viagem, ao longo das curvas canónicas dos troços; velocidade constante dentro de cada passo (duração = tempo com congestionamento) | O render pode pedir a pose em qualquer instante sem recalcular o motor; a posição é contínua entre troços (testado: deslocação ≤ velocidade × Δt). |
| D63 | Direção suave | Direção entre dois pontos a ±1,5 unidades no percurso (atravessa nós) | Sem rotações bruscas nas viragens (testado: variação máxima < 0,35 rad em passos de 0,02 min). |
| D64 | Faixas | Afastamento de 1,1 unidades para a direita do sentido de marcha | Os dois sentidos não se sobrepõem. |
| D65 | Relógio | Motor em passos fixos de 0,05 min simulados; o controlador tem o seu `requestAnimationFrame`, converte tempo real × velocidade em minutos e avança o motor; a cena só lê `renderMinute` | Separa a simulação do render: o mesmo resultado com qualquer taxa de fotogramas (testado com saltos grandes e pequenos). Fotogramas longos são limitados a 0,25 s reais. |
| D66 | Escala de tempo | 1x = 1 minuto simulado por segundo (a hora de procura dura 60 s); 2x e 4x | Ritmo legível a 1x e rápido a 4x. |
| D67 | Partidas | Minuto de partida uniforme em [0, 60[ por veículo, com semente; veículos sem percurso nunca partem | Reprodutível; sem teletransporte. |
| D68 | Cobrança no tempo | O motor regista cada travessia no livro de cobranças (Etapa 6) no passo fixo em que acontece; o pórtico pulsa nesse instante | A animação corresponde ao motor: no fim, o livro da reprodução tem exatamente os eventos da cobrança estática do período; em cada evento, o veículo está em cima do pórtico (< 0,05 unidades; atraso ≤ 1 passo). |
| D69 | Alterações durante a reprodução | `setPlan` atualiza pórticos e percursos só para quem ainda não partiu; o livro passa a usar o estado novo para as passagens seguintes | Não interrompe o movimento; os veículos em viagem não mudam de percurso a meio. |
| D70 | Render | Dois `InstancedMesh` (carroçaria e cabine), matrizes escritas diretamente em `useFrame`; cada veículo desenhado representa 4 simulados (amostra estável por ordem de geração); todos contam nos totais | Sem atualizações React por veículo; menos ruído visual com 7000 veículos/h. |
| D71 | Movimento reduzido | Com `prefers-reduced-motion`, os pulsos dos pórticos ficam desligados; os veículos só se movem quando o utilizador inicia a simulação | O movimento dos veículos é o próprio conteúdo e é sempre iniciado pelo utilizador. |
| D72 | Separação de chunks | O controlador não importa three.js nem R3F: a cena regista a sua função `invalidate` no runtime | A interface continua a abrir sem carregar o three.js (327 kB vs 923 kB do chunk 3D). |

**Carga de demonstração e desempenho medido.** Carga: procura de demonstração (7000 veículos numa hora), até 1025 veículos desenhados em simultâneo (amostra 1/4), 6 pórticos com pulso. Trabalho de CPU por fotograma a 4x (avançar o motor + calcular todas as poses), medido em Node 24 nesta máquina: média 0,58 ms, p95 1,00 ms, máximo 2,00 ms em 1801 fotogramas — bem abaixo dos 16,7 ms de um fotograma a 60 FPS. O render usa duas draw calls de instâncias para os veículos. A medição de FPS no browser não foi possível nesta sessão (a janela da aplicação esteve escondida e o browser suspende o `requestAnimationFrame`); fica por confirmar em hardware real.

### Cenários, comparação e fecho (etapa final: 8 + 9 com âmbito reduzido)

Por decisão do utilizador, as Etapas 8 e 9 foram juntas numa etapa final, com o âmbito do critério de conclusão do MVP.

| # | Decisão | Escolha | Justificação |
| --- | --- | --- | --- |
| D73 | Conteúdo de um cenário | `datasetId` (a rede não é editável), pórticos com tarifas, procura, semente e resumo dos resultados do motor | Cumpre "rede, pórticos, tarifas, procura, semente e resultados" sem duplicar a rede inteira em cada cenário. |
| D74 | Isolamento | Cada cenário é uma cópia profunda (`structuredClone`) e congelada; carregar um cenário usa a lista imutável dele e qualquer edição cria listas novas | Alterar um cenário — ou a configuração atual — nunca altera outro (testado, incluindo tentativas de mutação direta). |
| D75 | Persistência | `localStorage`, chave `tolllab:scenarios`, envelope `{ app, version: 2, scenarios }` gravado a cada alteração | Funciona offline e sem contas. |
| D76 | Versões e dados inválidos | v1 (sem procura nem resultados) é migrado; JSON corrompido é copiado para `tolllab:scenarios:corrupted` e ignorado; cada cenário é validado com as regras do domínio e descartado com aviso se for inválido; resultados em falta são recalculados; uma versão mais recente bloqueia a gravação | Nunca bloqueia o arranque nem apaga dados em silêncio (testado em unidade e E2E). |
| D77 | Comparação | Métricas do motor (receita bruta, líquido, passagens, tráfego, evitam portagens, tempo médio, sem percurso) com diferença absoluta e relativa, e cor "melhor/pior" | "Não comparáveis" quando a rede ou a procura diferem; aviso quando só a semente difere. |
| D78 | Semente | Editável no painel de cenários (inteiro 0–2³¹−1); mudar a semente reinicia a reprodução e recria as partidas | Permite repetir experiências com parâmetros controlados. |
| D79 | Apagar | Sem diálogo de confirmação: notificação com "Anular" que repõe o cenário | Consistente com a edição de pórticos; reversível e rápido. |
| D80 | Testes E2E | Playwright 1.64 (Chromium, WebGL por software) sobre o build de produção (`vite preview`) | Testa a aplicação real, incluindo a cena 3D, sem serviços externos. |

**Verificação final:** `npm audit` sem vulnerabilidades (dependências de execução e de desenvolvimento). Versões novas disponíveis e não aplicadas: `zustand` 5.0.16 (patch), TypeScript 7 e `@types/node` 26 (major, com risco de incompatibilidade). Os testes E2E confirmam a consola sem erros em todo o fluxo do MVP. A animação foi verificada por capturas no Chromium de testes (veículos nas duas faixas, a seguir as curvas, e pulsos nos pórticos); com renderização por software (sem GPU) a cena corre a 17–22 FPS, que é um limite inferior e não representa hardware com GPU.

## 4. Dependências

Todas as dependências previstas foram instaladas quando foram precisas (`zustand` na Etapa 3, `@playwright/test`
na etapa final). O Framer Motion (`motion`) nunca foi necessário: as transições CSS chegaram.

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
