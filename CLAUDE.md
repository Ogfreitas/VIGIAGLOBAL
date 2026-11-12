# Vigia Global: contexto para o Claude

**Responda sempre em português do Brasil**, de forma simples e direta. O dono não é programador: explique o que muda para ele, não o código.

## O que é

O Vigia Global é um **portal de notícias do mundo em forma de globo**, que roda no PC do dono (Windows 11, notebook com Intel UHD + RTX 3050 Laptop).

- Na tela aparece um globo 3D de pontos com chuva Matrix, no estilo "central de vigilância".
- Ao clicar num país, aparecem as notícias dele. Também dá para mergulhar no país e clicar num estado.
- Ele avisa no Windows e no Telegram quando sai algo grande no mundo ("plantão").
- **Não usa IA e não gasta tokens.** Tudo vem de RSS público (Google Notícias, Reddit, BBC, Al Jazeera, g1, CNN Brasil, DW) e não precisa de chave de API. O Claude só entra quando o dono pede mudanças no código.
- A pasta é `C:\Users\Ogfreitaz\Cloud\Vigia Global`. Ela é **separada** do Escritório Dark (`C:\Users\Ogfreitaz\Cloud\Escritorio Dark`, fábrica de cortes para canais dark) e não deve se misturar com ele.
- O Escritório Trader é outro projeto do dono. O Vigia usa **o mesmo bot de Telegram do Trader** (o nome do bot não fica escrito aqui, porque o repositório é público).

## Como roda

São duas partes:

1. **Motor:** `servidor.js`, em Node, ouvindo em `127.0.0.1:8788`. Ele roda escondido e:
   - busca e guarda as notícias;
   - mede o calor dos países;
   - vigia os países e palavras do dono;
   - detecta plantões;
   - manda os avisos.
2. **Janela:** `vigia-global.html`, um único arquivo grande com canvas, CSS e JS. É servida pelo motor e aberta numa janela `--app` do Edge com perfil próprio (`%LOCALAPPDATA%\VigiaGlobal\janela-edge`).

`abrir.js` liga o motor, se ele ainda não estiver de pé (destacado, com log em `dados/motor.log`), e depois abre a janela. Com `--sem-janela`, só liga o motor.

Atalhos:
- **Área de trabalho e Menu Iniciar:** "Vigia Global.lnk", que roda `node abrir.js`.
- **Inicializar com o Windows:** `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Vigia Global (motor).lnk`, que roda `node.exe abrir.js --sem-janela` minimizado. O motor liga sozinho quando o PC liga, e os avisos chegam mesmo com a janela fechada.

**Depois de mudar o código:**
- **Mudou a janela** (`vigia-global.html`): o dono aperta F5, ou fecha e abre de novo.
- **Mudou o motor** (`servidor.js` ou `motor/*`): reinicie o motor com `node ferramentas/reiniciar-motor.js`.
  - Ele para o `node` do `servidor.js`, liga de novo por `abrir.js --sem-janela` e confere `/api/saude`.
  - Reiniciar apaga da memória as manchetes do Plantão e do AO VIVO. Elas voltam em 1 a 2 minutos, lidas de novo das fontes.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `servidor.js` | Servidor http e rotas da API (abaixo). Os POST conferem o `Origin`. Só serve os arquivos públicos. |
| `abrir.js` | Liga o motor e abre a janela do Edge. Usa a RTX por padrão (`--force_high_performance_gpu`) e um Edge enxuto (sem extensões, sincronização, tradutor e serviços de fundo). |
| `vigia-global.html` | Toda a interface: globo, filtros, painéis, mergulho nos estados, AO VIVO, Resumo e modo leve. |
| `motor/noticias.js` | Busca no Google Notícias RSS em pt-BR (`buscaUrl`, `lerFeed`), com fila de 4 buscas ao mesmo tempo e cache de 15 min. Guarda as 15 `CATEGORIAS`, `buscar(termo, cat, cod)` e `buscarEstado`. |
| `motor/paises-texto.js` | `paisesNoTexto(titulo)` descobre os países citados (nomes, apelidos, gentílicos, capitais), em ordem de posição no título. `ehFora(titulo)` é o filtro de lixo: esporte, novela, Enem, loteria, promoção, celebridade. |
| `motor/paises.json` | Os 175 países (código → nome). |
| `motor/calor.js` | **Termômetro**: 16 buscas mundiais a cada 15 min e histórico de 100 leituras em `dados/calor-historico.json`. Diz quais países "esquentaram". A última medição boa fica em `dados/calor-atual.json` e volta ao religar (se tiver menos de 6 h). Se a medição falha (sem internet), tenta de novo em 30 s, 1 min, 2 min e depois a cada 5 min, até conseguir. |
| `motor/sentinela.js` | **Vigiados**: os países e palavras do dono, com checagem a cada 15 min. Na 1ª checagem só semeia, sem avisar. Só conta notícia de até 6 h. Configuração em `dados/vigiados.json`. Sem resposta do Google, confere de novo em 2 min. |
| `motor/plantao.js` | **Plantão**: 8 fontes rápidas com GET condicional (ETag) e espera quando o servidor devolve 429. Junta as notícias por palavras e países numa janela de 3 h. Com 3 ou mais fontes vira plantão (avisa). Também alimenta a faixa de manchetes e a lista AO VIVO das últimas 12 h. Cada item do AO VIVO traz `fontes` (quantas fontes diferentes deram a mesma história) e `grupo` (id da história), calculados por `gruposDaLista` com a mesma regra do `agrupar`, para todas as manchetes. Fica em cache até chegar manchete ou tradução nova (`versaoItens`). |
| `motor/fontes-pais.js` | De que país é o veículo, para o "visto em". As fontes fixas são BBC (GB), Al Jazeera (QA), g1 (BR), CNN Brasil (BR) e DW (DE); o Reddit fica sem país. Também há uma lista de veículos conhecidos em `.com` (CNN e NYT são US, Guardian é GB, Sputnik Brasil é RU…). Os outros saem pelo final do site (`.br`, `.co.uk`, `.de`…), menos os finais usados à toa (`.co`, `.io`, `.tv`…). **Sem certeza, fica sem país.** |
| `motor/traduzir.js` | Traduz as manchetes em inglês pelo endpoint grátis do Google Tradutor (`client=gtx`), no máximo 60 a cada 10 min, com cache. |
| `motor/resumo.js` | **Resumo do dia**: as 10 histórias do Mundo e as 5 do Brasil que mais fontes deram. Cruza os destaques do Google com as fontes rápidas e os plantões. Vai para o Telegram uma vez por dia no horário escolhido (até 6 h depois, se o PC ligou tarde). |
| `motor/avisos.js` | Avisos do Windows (toast via PowerShell, AUMID `VigiaGlobal`, abre o link ao clicar) e do Telegram (`sendMessage`, com HTML opcional). |
| `motor/brave.js` + `trazer-brave.exe` | Abre as notícias no navegador Brave do dono e traz a janela dele para a frente. |
| `motor/tv.js` | **TV ao vivo**: a lista `LISTA` (35 países, 68 emissoras, por região; a primeira de cada país é a principal) com o id fixo do canal no YouTube (`UC…`). `aoVivo(id)` lê a página `youtube.com/channel/<id>/live` e devolve o vídeo que está no ar (`videoId`, título, quantos assistem, se deixa tocar fora do YouTube). Só procura quando alguém escolhe a emissora e guarda 10 min (2 min se estava fora do ar). |
| `tv.html` | A janela da TV (em `/tv`), no visual do Vigia: player grande, lista de países e emissoras à direita, busca e teclas. |
| `estados/XX.json` | Contornos dos estados de 175 países (Natural Earth admin-1, domínio público, 3,9 MB). Países muito picados foram agrupados por região (Reino Unido por nação, França, Itália, Espanha…). |
| `ferramentas/converter-estados.js` | Gera os `estados/*.json` de novo a partir do arquivo do Natural Earth. |
| `ferramentas/reiniciar-motor.js` | Reinicia o motor e confere se voltou. |
| `ferramentas/conferir-tv.js` | Confere quais emissoras da TV ao vivo estão no ar agora e tocam dentro do Vigia. |
| `versoes/` | Backups de cada fase, no formato `nome-AAAA-MM-DD-antes-do-X.ext`. |
| `melhorias-portal.md` | O plano "cara de portal ao vivo", em 4 fases. Ele vale junto com este arquivo. Faça uma fase por vez e só passe para a próxima com a aprovação do dono. |
| `dados/` | Estado do motor: `config.json`, `vigiados.json`, `vistos.json`, `achados.json`, `plantao.json`, `resumo.json`, `calor-historico.json`, `calor-atual.json` e `motor.log`. |
| `README.md` / `HANDOFF.md` | A apresentação do projeto (para que serve, como ligar) e o handoff técnico (arquitetura, módulos, rotas, regras, testes, próximos passos). Atualize os dois junto com este arquivo. |
| `config.exemplo.json` | Modelo do `dados/config.json`, sem segredo. |

**GitHub (12/11/2026):** a pasta é um repositório git (branch `main`), enviado para `github.com/Ogfreitas/VIGIAGLOBAL`, criado pelo dono como **público**: nada de segredo nem dado pessoal (nome do bot, vigiados, chatId) em arquivo que vai para o git. O `.gitignore` deixa de fora `dados/` (token do Telegram, vigiados, histórico, log), `versoes/` e `motor/trazer-brave.exe`. Antes de cada commit, confira com `git status` que nada de `dados/` entrou. Commit e push só quando o dono pedir.

**Rotas:**
- `GET /api/saude`
- `/api/noticias?p=PAIS&cats=a,b&e=ESTADO`
- `/api/calor`
- `/api/plantao?p=&e=`
- `/api/aovivo`
- `/api/resumo`
- `POST /api/resumo/enviar`
- `GET`/`POST /api/vigiados`
- `POST /api/vigiados/testar`
- `POST /api/abrir` (abre o link no Brave; aceita manchetes e, desde a TV, o endereço de um vídeo do YouTube `watch?v=` e nada mais)
- `/tv` (a janela da TV), `GET /api/tv` (lista de emissoras), `GET /api/tv/aovivo?c=<id do canal>[&denovo=1]` (só canais da lista)

## O que a janela tem

- **Globo:** projeção ortográfica com cerca de 10.700 pontos. Dá para arrastar e usar a rodinha do mouse. Quando ninguém mexe, ele viaja sozinho de país em país mostrando manchetes.
- **Busca de país:** tecla `/`. Digite com ou sem acento e aperte Enter.
- **15 filtros de assunto**, em grade de 2 colunas. Shift + tecla deixa só aquele assunto; `T` volta para tudo.

  | Tecla | Assunto | Tecla | Assunto | Tecla | Assunto |
  |---|---|---|---|---|---|
  | 1 | Economia | 6 | Tecnologia e IA | G | Conflitos e segurança |
  | 2 | Mercados | 7 | Energia | J | Justiça e corrupção |
  | 3 | Cripto | 8 | Commodities e agro | E | Ciência e espaço |
  | 4 | Geopolítica (só diplomacia) | 9 | Clima e desastres | M | Migração e direitos humanos |
  | 5 | Política e eleições | 0 | Saúde | R | Religião |

- **Termômetro** (tecla `C`): pinta os países pelo volume de notícias e mostra uma caixa à direita com os mais quentes.
- **Vigiados** (tecla `V`): os países e palavras para vigiar, os canais de aviso (Windows e Telegram), a sensibilidade do plantão (alta 6, normal 7,5, baixa 9,5) e o resumo do dia (Telegram ligado ou desligado, horário entre 05:00 e 11:00).
- **Plantão:** uma faixa de manchetes rolando embaixo, que para quando o mouse passa por cima, e um banner vermelho quando sai um plantão.
- **AO VIVO** (tecla `A`): lista das últimas 12 h, com as abas Mundo, Brasil, Urgentes e Tudo, um campo de filtro e o aviso "↑ N novas".
- **Resumo do dia** (tecla `D`): abre sozinho uma vez por dia, quando a janela abre.
- **Mergulho nos estados:**
  - Ao clicar num país, a câmera mergulha nele e desenha os estados, com efeito de radar e nomes.
  - Ao clicar num estado, aparecem as notícias daquele estado: Geral nos últimos 2 dias, ou por assunto.
  - Esc volta do estado para o país, e do país para o mundo.
- **Modo leve** (tecla `L`, ou `#leve` na URL): fica salvo em `localStorage` (`vigia.leve`).

### Cara de portal ao vivo (Fase 1, 08/11/2026)

- **Ping:** um anel cresce do país quando chega notícia nova pelo `/api/aovivo`, usando o primeiro país do título.
  - Força pelo número de fontes: 1 fonte, anel pequeno; 2, médio; 3 ou mais, forte.
  - Âmbar quando bate num Vigiado (`ehVigiado`: palavra no título, ou país vigiado com notícia urgente, a mesma regra do motor).
  - Vermelho, com 2 anéis, só no plantão.
  - No máximo 3 anéis ao mesmo tempo, soltos a cada 0,5 s; as notícias mais fracas são descartadas.
  - A mesma história só pinga de novo se ficar mais forte (`pingados`, por `grupo`).
  - O Brasil só pinga com 2 fontes ou mais.
  - Não pinga notícia com mais de 45 min nem o que chegou com a janela escondida.
- **Marca na borda:** `[JP]` na borda do globo quando o ping é num país escondido.
  - Some em 6 s e não cai atrás dos filtros, do painel, da faixa ou do banner.
  - Clicar gira o globo até o país (`irPara`). No mergulho, mergulha no país.
- **Etiqueta de alvo:** no lugar do pop-up da viagem automática (`mostrarPop`).
  - Uma linha fina se desenha do país até uma caixa com `[US] NOME`, hora, manchete, fonte e selo.
  - A caixa fica do lado com mais espaço, sem cobrir o centro do globo.
- **Plantão:**
  - Com o dono parado há 20 s (`ultimoInput`) e fora do mergulho, o globo gira até o país em 1,2 s (`girarAte`, com `alvoGiro.dur`) e depois o banner entra.
  - Se o dono está mexendo, a câmera fica parada, aparece a marca na borda e o banner ganha o botão "ir para lá".
  - O banner fica embaixo, logo acima da faixa, e a faixa pausa enquanto ele está aberto.
  - O título entra como teletipo (0,6 s); um clique mostra tudo.
  - Som opcional, desligado por padrão (`vigia.som`). Liga em Vigiados.
- **Selo de tempo:** "agora", "há 8 min"… (`selo()`). Vai apagando com a idade e nunca fica vermelho. Atualiza 1 vez por minuto.
- **"Enquanto você estava fora":** a última vez que a janela esteve visível fica em `vigia.ultimaVisita`.
  - Ao abrir ou voltar depois de mais de 1 h, aparece um cartão no topo com as contagens e as 3 principais. Fecha em 15 s ou com Esc.
  - Se o Resumo do dia abrir junto, vira uma linha no topo do Resumo.
- **AO VIVO:** separadores de hora, marca âmbar nos vigiados e realce verde que apaga em 3 s na notícia que acabou de chegar.
- **Regras de movimento:**
  - Tudo anda no quadro do globo: `efeito()` / `rodarEfeitos()` para os DOM, e desenho no canvas.
  - `semMovimento()` = modo leve ou "animações desligadas" do Windows. Nesse caso, só pingam plantão e vigiado, sem teletipo, sem voo e sem realces.

### Credibilidade e contexto (Fase 2, 08/11/2026)

- **"Visto em GB QA BR":** de quais países vem a cobertura, no lugar de "N fontes".
  - O motor manda `vistoEm` (códigos de país) no AO VIVO, na faixa, no país, no estado, nos plantões e nas notícias do Google (`/api/noticias`).
  - Nas notícias do Google, cada item tem só o país do próprio veículo.
  - Na janela: `vistoEmEl()` / `linhaFonte()`. Aparece no AO VIVO, no banner de plantão, na etiqueta e nas notícias do país e do estado.
  - São códigos, não bandeiras: a janela não desenha bandeiras e o emoji de bandeira não aparece no Windows.
- **Dia e noite:**
  - O lado da noite fica com ~40% do brilho, em 4 degraus de luz (`NLUZ`, `LUZ_F`); o calor apaga menos (`LUZ_FC`).
  - `calcularLuz(ms)` calcula pela posição do Sol (`posicaoDoSol`) 1 vez por minuto e guarda o nível de cada ponto em `LUZ`. O replay da Fase 3 pode chamar com outra hora.
  - Os baldes de pontos agora são 3 + 6×4: `BALDES[3 + profundidade*4 + luz]` e `BALDES[15 + (calor-1)*4 + luz]`.
- **Hora local:**
  - Tabela `CAPITAL` (175 capitais em português). `FUSO_QUE_FALTAVA` completou os 39 países sem fuso; só a Antártida fica sem hora.
  - No painel do país e do estado aparece "Teerã, 03:14 (madrugada)" (`horaLocal`, `horaLocalEl`).
- **Relógios no topo:** UTC e Brasília, mais até 3 cidades.
  - O botão "+" põe uma cidade e um clique na cidade tira (`vigia.relogios`).
  - Atualizam na virada de cada minuto, junto com a hora local dos painéis. Sem status de bolsa.
- **Ajuda de teclas:** tecla `?` (`alternarAjuda`). Fecha com Esc, `?` ou clique fora.
- **Arcos entre países** (`arcoDaNoticia`, `desenharArcosNot`):
  - Saem quando o título cita exatamente 2 países e a história está em 2 fontes ou mais (ou é plantão).
  - Sem seta, na cor neutra `#A7C4B5`, no máximo 2 ao mesmo tempo, somem em 6 s. No modo leve, desligados.
  - **Estão desligados por padrão** (`vigia.arcos`) até o dono aprovar os exemplos.
  - Os arcos decorativos aleatórios antigos (`novoArco`) continuam e podem ser confundidos com os de verdade.
- **Detecção de país:** o tradutor às vezes escreve em português de Portugal, então "Irão" e "Benim" foram acrescentados em `paises-texto.js`.

### TV ao vivo (09/11/2026, pedido do dono, fora das fases do plano)

- **O que é:** os canais de notícia de cada país ao vivo, numa janela à parte no visual do Vigia. Só transmissões oficiais no YouTube, de canal verificado e liberadas para tocar fora do YouTube.
- **Como abre:** botão "▶ TV ao vivo" no menu da esquerda, tecla `N`, ou o botão "▶ TV" no painel do país (só aparece nos países da lista). Com um país aberto, a TV já começa nele.
  - `abrirTV(cod)` usa `window.open('', 'vigia-tv', 'popup,…')`: se a janela da TV já existe, só muda o `#BR` (troca de canal sem recarregar). A janela lembra o último canal (`vigia.tv`).
- **Na janela da TV:** `↑ ↓` muda de país, `← →` muda de emissora no país, `M` liga/desliga o som, `/` busca país ou canal. Mostra "lá são 02:14 (madrugada)", para entender quando o canal está em reprise.
- **Som:** o navegador só deixa começar com som depois de um clique na janela. Por isso a TV começa muda, com o botão "🔊 Ligar o som". Depois do primeiro clique, as trocas de canal já saem com som.
- **Fora do ar ou bloqueado:** aparece um aviso em âmbar com as outras emissoras do país. Se o YouTube recusar o player, aparece o botão "↗ Abrir no YouTube", que abre no Brave e para o player daqui, para não tocar dois ao mesmo tempo.
- **Por que o motor procura o vídeo:** o jeito antigo de embutir "o ao vivo do canal" (`embed/live_stream?channel=`) dá erro 150 desde 2025. O player usa `youtube-nocookie.com` e conversa com a página por `postMessage` (estado, mudo, erro), sem a biblioteca do YouTube.
- **Ficaram de fora (conferido em 09/11/2026):** Globo e GloboNews (o ao vivo só existe no Globoplay, com login), Rússia (RT e Rossiya 24 saíram do YouTube), Sky TG24 da Itália (bloqueada no Brasil), Portugal, Chile, África do Sul, Quênia, Israel em inglês e Coreia em inglês (sem ao vivo aberto naquela hora). Para conferir de novo as emissoras da lista: `node ferramentas/conferir-tv.js`. Para achar um canal novo, leia a página `youtube.com/@canal/live` dele e veja se `videoDetails.isLive` é verdadeiro e se `playabilityStatus.playableInEmbed` não é falso.
- **Não confundir com o "modo TV" da Fase 4** (o globo em tela cheia, tecla `F`).

## Desempenho (medido em 08/11/2026)

Limites de quadros por segundo:

| Situação | Normal | Modo leve |
|---|---|---|
| Em uso | 30 | 20 |
| Em outro programa | 12 | 6 |
| Arrastando ou dando zoom | 60 | 60 |
| Minimizado ou coberto | 0 | 0 |

- O modo leve também tira a chuva Matrix e a varredura, desenha em resolução normal (DPR 1) e não desenha os pontos do lado de trás do globo.
- Não há `backdrop-filter` nem animações CSS infinitas: elas forçavam a tela inteira a ser recomposta 60 vezes por segundo.
- O glitch do título, o piscar e a faixa rolando andam em JS (`animacoesPequenas`), no mesmo ritmo do globo.

Resultado, medido com `nvidia-smi power.draw`:

| | CPU | RTX a mais |
|---|---|---|
| Versão antiga | 13% | +3,7 W |
| Agora | 5% | +2,3 W |
| Modo leve | 4% | +1,9 W |

Na Intel ficou pior: a placa ficava 51% ocupada, e é ela que desenha a tela do Windows. Para forçar a Intel, coloque `"gpuDedicada": false` em `dados/config.json`.

O motor pesa de 45 a 82 MB de RAM e quase 0% de CPU.

**Fase 1 do portal (08/11/2026, à noite):** sem diferença que dê para medir.
- O PC estava ocupado (vídeo na Brave), então os watts gerais não serviram.
- Mediu-se só o que é do Vigia: CPU e placa 3D por processo (contador do Windows `\GPU Engine(*engtype_3D)\Utilization Percentage`, filtrado pelos PIDs).
- Médias de 3 rodadas, versão antiga contra a nova:

| Medida | Antes | Agora |
|---|---|---|
| Placa 3D | ~19,7% | ~18,8% |
| CPU | ~8% | ~7% (oscilando de 5 a 12% com o PC ocupado) |
| Modo leve, placa 3D | 13,1% | 12,8% |
| Modo leve, CPU | 4,7% | 3,7% |

- Com um ping a cada 1,5 s (bem mais que o real), a placa foi a 23,7%.

**Fase 2 (08/11/2026, de noite, com o PC mais calmo):** médias de 2 rodadas, versão da Fase 1 contra a nova.

| Medida | Antes | Agora |
|---|---|---|
| Em uso, CPU | 4,4% | 3,8% |
| Em uso, placa 3D | 23,2% | 24,7% |
| Modo leve, CPU | 2,7% | 2,2% |
| Modo leve, placa 3D | 16,9% | 16,6% |

- RTX geral de 9,3 a 9,7 W nas duas versões: cerca de +2,2 W sobre a base de 7,3 W, perto da meta de +2,3 W.
- O dia e noite desenha 24 baldes em vez de 6 (+1,5 ponto na placa no modo normal).
- O script de medição é o `medir-fase.js` do teste: ele abre a versão antiga numa porta temporária, mede CPU, placa 3D e RAM por processo, e usa `-ExecutionPolicy Bypass` só no processo.

**TV ao vivo (09/11/2026, de madrugada):** medido só nos processos da cópia de teste do Edge, 30 s cada.

| Situação | CPU | Placa 3D | RTX geral |
|---|---|---|---|
| Nada aberto | 0% | 0% | 8,0 W |
| Só o globo, em uso | 4,0% | 23,6% | 10,3 W (+2,3 W) |
| Só a TV tocando (CNN Brasil) | 2,0% | 13,2% | 9,4 W (+1,4 W) |

- A TV pesa menos que o globo. A janela do globo não mudou (só ganhou um botão), e a TV só gasta enquanto a janela dela está aberta. Fechou, parou.
- A cópia do Edge com a TV ocupou cerca de 730 MB de RAM, a maior parte do player do YouTube.

## Regras de trabalho

- **Nunca mostre nem mande para a janela o token ou o chatId do Telegram.** Eles ficam só em `dados/config.json`. Não imprima esse arquivo.
- **Só mande mensagem no Telegram quando o dono pedir ou aprovar** (testes também).
- **Pergunte antes** de baixar arquivos e antes de mexer em configurações persistentes do Windows (inicialização, registro, atalhos).
- **Antes de mudar uma fase grande, copie para `versoes/`** os arquivos que vão mudar, com o nome `arquivo-AAAA-MM-DD-antes-do-X.ext`.
- Ao editar o `vigia-global.html`, que tem uns 165 KB, leia o trecho antes e use a ferramenta Edit. `sed` e `node -e` já comeram barras invertidas de regex.
- **Para testar a janela:** o painel de navegador do app Claude falha quando está escondido (largura 0) ou em aba de fundo. O que funcionou foi abrir uma cópia de teste no Edge, fora da tela, e apagar a cópia e o perfil depois.
  - A cópia usa `--window-position=-2600,40`, perfil próprio, `--disable-features=CalculateNativeWinOcclusion` e `--remote-debugging-port`.
  - Ela é comandada por um script Node via CDP (`Runtime.evaluate` e `Page.captureScreenshot`; o Node 26 já tem `WebSocket`).
  - Use `#foco` na URL para medir como "em uso" e `#foco-leve` para o modo leve.
  - Para comparar com a versão antiga, sirva o HTML de `versoes/` numa porta temporária, repassando o resto para a 8788.
  - Recarregar a página grava `vigia.ultimaVisita` na saída. Para testar o cartão "fora", mude `ultimaVisita` e chame `depoisDoBoot()`.
- **Cores:** vermelho só no plantão. Em elementos novos, o verde do tema é notícia comum, o âmbar é vigiado e o ciano é natureza (Fase 3).
  - Partes antigas que ainda usam vermelho sem ser plantão: faixa de manchetes, botão e painel AO VIVO, etiqueta URGENTE, "NOVO" no painel do país, risco dos novos no AO VIVO, números dos botões, filtro Conflitos e "fervendo" do termômetro.
  - Só mude essas partes se o dono pedir.
- **Filtros de texto:** cuidado com palavras de duplo sentido. "rodada de negociações" e "jogo político" não são esporte. "Técnico da Nasa" já foi pego por engano pela regra "técnico da", que foi removida. "ao vivo" puxava futebol e foi tirado da lista de urgência.
- **Para colocar uma bandeira**, use o primeiro país do título (`paisesNoTexto` devolve em ordem de posição). Nas notícias do Brasil, o padrão é a bandeira do Brasil.

## Linha do tempo

- **07/11/2026:**
  - O projeto foi trazido de outro projeto para esta pasta própria.
  - Entraram os filtros por assunto, a abertura no Brave, o Termômetro, os Vigiados e os avisos do Windows e do Telegram.
- **08/11/2026:**
  - Plantão com fontes rápidas e tradução.
  - Mergulho nos estados.
  - Teste real no Telegram, que chegou.
  - Painel AO VIVO.
  - Revisão dos filtros: geopolítica virou só diplomacia, o filtro de lixo ficou mais rígido e entraram 5 assuntos novos (Conflitos, Justiça, Ciência, Migração, Religião).
  - Resumo do dia (janela e Telegram).
  - Ligar com o Windows.
  - Versão mais leve.
  - **Fase 1 do plano "cara de portal ao vivo"** (`melhorias-portal.md`): ping, marca na borda, etiqueta de alvo, plantão com câmera e teletipo, selo de tempo, cartão "enquanto você estava fora" e AO VIVO com separadores de hora. O motor passou a mandar `fontes` e `grupo` no AO VIVO.
  - **Fase 2:** "visto em", dia e noite, hora local, relógios do topo, ajuda `?` e arcos (prontos, mas desligados até o dono aprovar os exemplos). **A Fase 3 espera a aprovação do dono.**
- **09/11/2026:**
  - **TV ao vivo** (pedido do dono): janela à parte com 68 emissoras de 35 países, tecla `N` e botão "▶ TV" no painel do país. Os arcos continuam desligados e a Fase 3 continua esperando a aprovação.
  - **Termômetro parado depois de ligar o PC** (corrigido): o motor liga junto com o Windows e o termômetro media 3 s depois, antes de o Wi-Fi conectar. A medição falhava e só tentava de novo 15 min depois, com a caixa vazia. Agora tenta de novo logo (30 s, 1 min, 2 min, 5 min…) e já mostra a última medição guardada. Os Vigiados também conferem de novo em 2 min. As linhas de erro do termômetro no `motor.log` agora têm a hora.
- **12/11/2026:** o projeto foi para o GitHub (`Ogfreitas/VIGIAGLOBAL`, público), com `README.md` e `HANDOFF.md`.

## Ideias que ainda não foram feitas

As próximas fases já estão planejadas em `melhorias-portal.md`:
- **Fase 3:** replay 24 h, terremotos e alertas, seguir uma história.
- **Fase 4:** visão de dentro, modo TV e fotos.

Outras ideias, para oferecer só se o dono pedir:

- "Onde o mundo fala de X": digitar um assunto e o globo acende os países que falam dele.
- Faixa de mercado: dólar, bolsa, bitcoin, petróleo. O plano deixou de fora: mercado é assunto do Escritório Trader. Se for feita, vira um item separado.
- Terremotos e desastres em tempo real (USGS / GDACS) no globo.
- Ficha do país: capital, população, moeda, governo.
- "Visão de dentro": a mesma história contada pela imprensa local do país.
- A mesma história em várias fontes, lado a lado.
- Salvar notícia para ler depois.
- Bolsas abertas por fuso (o plano deixou de fora, como a faixa de mercado).
