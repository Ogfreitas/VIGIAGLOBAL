# Vigia Global: plano "cara de portal ao vivo"

> **Para o Claude Code.** Leia junto com o `CLAUDE.md`, que continua valendo inteiro.
> - Faça **uma fase por vez** e só passe para a próxima quando o dono aprovar.
> - Explique para o dono o que mudou na tela, não o código.

## Objetivo

O Vigia deve dar a sensação de **redação ao vivo**: o mundo acontecendo na tela.

Isso tem que acontecer:
- **sem perder o estilo** de central de vigilância / Matrix;
- **sem desfazer o ganho de desempenho** medido em 08/11/2026.

**Direção visual.** O Vigia deve parecer um terminal de inteligência, não um telejornal de emissora:
- nada de tarja colorida de TV;
- linhas finas, a cor do tema, códigos de país (`[IR]`) e horários, no estilo de texto que a janela já usa.

**Um único momento grande.** O plantão é o único efeito chamativo da tela. O resto é pequeno, curto e discreto. Movimento espalhado por todo lado cansa a vista e deixa de chamar atenção.

---

## Regras para todas as fases

### Desempenho (obrigatório)

- **Onde rodar:** toda animação nova roda no mesmo laço do globo / `animacoesPequenas`.
  - Nada de animação CSS infinita.
  - Nada de `backdrop-filter`.
  - Nada de `setInterval` próprio para desenhar.
- **Termina sozinha:** quando nada está acontecendo, o custo extra é zero.
- **Minimizado ou coberto:** continua em 0 fps. O que chegar nesse tempo **não** vira uma fila de animações para tocar depois (ver 1.1 e 1.6).
- **Modo leve:** cada item diz o que faz no modo leve. Se o item não diz nada, ele desliga no modo leve.
- **Animações do Windows desligadas:** se a configuração do Windows estiver assim (`prefers-reduced-motion`), o movimento se comporta como no modo leve.
- **Cálculos com cache:** o que não precisa mudar a cada quadro (dia e noite, hora local) é calculado no máximo 1 vez por minuto e guardado.
- **Medição no fim de cada fase:** meça de novo como em 08/11/2026.
  - Medir CPU e `nvidia-smi power.draw`, no modo normal e no modo leve.
  - Mostre ao dono a tabela antes/depois.
  - Meta: no modo normal, ficar perto de 5% de CPU e +2,3 W.
  - Se piorar de forma visível, avise o dono antes de seguir.

### Cores com significado

| Cor | Significa | Onde aparece |
|---|---|---|
| Verde do tema | notícia comum | ping, etiqueta, selos |
| Âmbar | bateu num Vigiado | ping, etiqueta, item no AO VIVO |
| Vermelho | **só plantão** | banner, ping de plantão |
| Ciano | natureza (terremoto, alerta de desastre) | marcador e ping (Fase 3) |

- Nenhum elemento novo usa vermelho fora do plantão.
- Se algo que já existe e não é plantão usa vermelho hoje, liste isso para o dono e **não mude sozinho**.

### Andares da tela

Cada coisa tem seu lugar, para a tela não encher:

- **Topo:** título, hora (Fase 2) e status.
- **Direita:** painéis (Termômetro, Vigiados, AO VIVO, Resumo).
- **Base:**
  - a faixa de manchetes;
  - o banner de plantão, logo acima da faixa;
  - nunca dois banners ao mesmo tempo;
  - com o banner aberto, a faixa pausa.
- **Globo:** pings, etiqueta de alvo, marcas de borda e arcos.

Regra geral: **no máximo um texto em movimento por andar** ao mesmo tempo.

### Confira os dados antes de desenhar

Antes de cada item, confira no motor se o dado necessário existe. Por exemplo: se `/api/aovivo` traz, em cada item, o país, o horário e a lista de fontes.

Se faltar algum dado:
- acrescente no motor sem mudar o que já funciona;
- reinicie o motor como manda o `CLAUDE.md`.

### Rotina de sempre

- **Backup:** antes de cada fase, copie para `versoes/` os arquivos que vão mudar.
- **Teste da janela:** use a cópia no Edge fora da tela, como no `CLAUDE.md`.
- **Telegram:**
  - não imprima `dados/config.json`;
  - não mande nada no Telegram sem o dono pedir ou aprovar.
- **Nada novo de fora:** nenhuma biblioteca nova e nenhum arquivo baixado sem perguntar. Tudo em JS puro.
- **Teclas novas:** antes de usar uma, confira se ela está livre. Sugestões: `H` (replay), `F` (modo TV) e `?` (ajuda).
- **Fim de cada fase:** atualize o `CLAUDE.md`.
  - Linha do tempo, teclas, rotas e arquivos.
  - Tire das "Ideias que ainda não foram feitas" o que foi feito.

---

## Fase 1: o mundo pulsando

### 1.1 Ping de notícia nova

**O que o dono vê:** um anel que cresce a partir do país quando chega uma notícia, como num radar.

**Quais notícias pingam**
- Só itens com país identificado. Use o primeiro país do título, que vem de `paisesNoTexto`.
- **Brasil:** como as fontes em pt-BR fariam o Brasil piscar sem parar, o Brasil só pinga com 2 fontes ou mais. Plantão e Vigiado são exceção.
- **Ao abrir a janela ou voltar do minimizado:** não toque os pings atrasados. Isso vira o cartão "enquanto você estava fora" (1.6).

**Tamanho e cor**

| Caso | Anel |
|---|---|
| 1 fonte | pequeno e fraco |
| 2 fontes | médio |
| 3 fontes ou mais | forte |
| Vigiado | âmbar |
| Plantão | vermelho, maior, com 2 anéis |

**Muitas notícias juntas**
- No máximo 3 anéis ao mesmo tempo.
- Se chegarem muitas notícias de uma vez:
  - solte os anéis com uns 0,5 s entre eles;
  - descarte os mais fracos.

**Movimento:** dura uns 2 s, desacelera no fim e some sozinho.

**Modo leve:** só pingam plantão e Vigiado, com um anel só.

### 1.2 Marca na borda do globo

Metade do mundo fica escondida atrás do globo. Quando um ping ou plantão acontece num país escondido:

- **Marca:** aparece uma marca pequena na borda do globo, na direção do país, com o código dele (`[JP]`).
- **Duração:** some em 6 s.
- **Clique:** um clique na marca gira o globo até o país.
- **Modo leve:** mantém, porque é estático.

### 1.3 Etiqueta de alvo (no lugar da tarja de TV)

Quando o globo viaja sozinho, a manchete aparece como uma etiqueta presa ao país: uma linha fina sai do ponto do país até uma caixa pequena.

- **Conteúdo:**
  - código e nome do país;
  - hora;
  - fonte;
  - na Fase 2, também o "visto em".
- **Posição:**
  - a caixa fica do lado em que há mais espaço;
  - nunca sai da tela;
  - nunca cobre o centro do globo.
- **Entrada:** a linha "se desenha" em uns 300 ms e o texto aparece em seguida.
- **Saída:** some esmaecendo.
- **O que ela substitui:** a forma atual de mostrar a manchete na viagem automática. Leia como é hoje antes de trocar.
- **Modo leve:** sem animação de entrada; a etiqueta só aparece e some.

### 1.4 Plantão com câmera, sem roubar o mouse

**A câmera**
- **Dono parado:** se ele não mexe em nada há 20 s e não está no mergulho, o globo gira até o país (uns 1,2 s, suave) e depois o banner entra.
- **Dono mexendo ou no mergulho:** a câmera não se mexe. Aparece a marca de borda (1.2), e o banner ganha um botão "ir para lá".

**Efeito teletipo**
- O título do banner aparece letra por letra.
- É rápido: uns 0,6 s no total.
- Um clique mostra o título inteiro na hora.
- O teletipo existe **só** aqui, em nenhum outro lugar.

**Som**
- Opcional e **desligado por padrão**.
- Curto e original, gerado no próprio JS (Web Audio), sem arquivo.
- Liga e desliga no painel Vigiados.

**Modo leve:** sem voo (se o dono estiver parado, o globo pula direto para o país) e sem teletipo.

### 1.5 Selo de tempo

- **Onde:** "agora", "há 8 min", "há 3 h" nas notícias do AO VIVO, do país e do plantão.
- **Cor:** a cor **não** muda para vermelho. O selo vai apagando (brilho e opacidade) conforme a notícia envelhece.
- **Atualização:** 1 vez por minuto.

### 1.6 "Enquanto você estava fora"

- **Registro:** guarde em `localStorage` (`vigia.ultimaVisita`) a última vez que a janela esteve visível.
- **Cartão:** ao abrir ou voltar depois de mais de 1 h, aparece um cartão discreto.
  - Por exemplo: "Desde 22:10: 2 plantões, 14 notícias do Mundo e 6 do Brasil".
  - Mostra as 3 principais.
  - Fecha sozinho em 15 s, ou com Esc.
- **Junto com o Resumo:** se o Resumo do dia abrir sozinho nessa hora, o cartão **não** aparece separado. Ele vira uma linha no topo do Resumo. Nunca duas janelinhas.
- **Mais de 12 h fora:** o AO VIVO só guarda 12 h, então o cartão diz "nas últimas 12 h".

### 1.7 AO VIVO com cara de cobertura ao vivo

- **Separadores:** a lista ganha separadores de hora ("14h", "13h").
- **Item novo:** entra com um realce que apaga em 3 s. Não pisca para sempre.
- **Vigiado:** item que bateu num Vigiado ganha uma marca âmbar.

**Para fechar a Fase 1:**
- mostre a tabela de desempenho;
- o dono vê na tela: ping, marca de borda, etiqueta, plantão, selo, cartão e AO VIVO.

---

## Fase 2: credibilidade e contexto

### 2.1 "Visto em" (no lugar de "contada por N fontes")

Contar fontes engana: três sites brasileiros repetindo a mesma agência viram "3 fontes". É melhor mostrar **de quais países** vem a cobertura.

**Veículo → país**
- **Fixos:**

  | Veículo | País |
  |---|---|
  | BBC | Reino Unido |
  | Al Jazeera | Catar |
  | g1 | Brasil |
  | CNN Brasil | Brasil |
  | DW | Alemanha |

- **Reddit:** fica sem bandeira.
- **Google Notícias:** use o elemento `<source>` de cada item e o domínio (`.br`, `.co.uk`, `.de`, `.fr`…).
- **Sem certeza:** fica sem bandeira. Nunca chute.

**Como mostrar**
- Exemplo: "visto em" seguido das bandeiras.
- Use as bandeiras que o Vigia já desenha. O emoji de bandeira não aparece no Windows.

**Agrupamento**
- Use o agrupamento que o `plantao.js` já faz (janela de 3 h).
- Notícia que não está em nenhum grupo mostra só a própria fonte.

**Onde aparece:**
- AO VIVO;
- banner de plantão;
- etiqueta de alvo;
- notícias do país e do estado.

### 2.2 Dia e noite no globo

- **Visual:**
  - os pontos do lado da noite ficam mais apagados (uns 40% do brilho);
  - a transição na linha entre dia e noite é suave.
- **Cálculo:** 1 vez por minuto, guardando o fator de brilho de cada ponto.
- **Modo leve:** mantém, porque o custo é um cálculo por minuto.

### 2.3 Hora local

**No painel do país**
- Mostrar a hora da capital, por exemplo: "Teerã, 03:14 (madrugada)". Isso explica por que um país está quieto.
- Use uma tabela país → fuso da capital (IANA) com `Intl.DateTimeFormat`. Não precisa de internet.
- Países com vários fusos usam o fuso da capital.

**No topo da tela**
- Uma linha compacta com UTC e Brasília. Dá para pôr mais até 3 cidades, que o dono escolhe.
- Atualiza 1 vez por minuto.
- Sem status de bolsa (ver "Fica de fora").

### 2.4 Ajuda de teclas (`?`)

- Mostra por cima da tela todas as teclas:
  - filtros;
  - `C`, `V`, `A`, `D`, `L`, `/`, `T`, Esc;
  - as teclas novas.
- Fecha com Esc ou `?`.

### 2.5 Arcos entre países (com regras)

- **Quando desenhar:** só quando as duas condições valem:
  - o título cita exatamente 2 países diferentes;
  - a história está em 2 fontes ou mais, ou é plantão.
- **Visual:**
  - o arco não tem seta, porque sem IA não dá para saber quem fez o quê;
  - usa a cor neutra do tema, nunca vermelho;
  - no máximo 2 arcos ao mesmo tempo, que somem em 6 s.
- **Antes de ligar:** mostre ao dono 10 exemplos reais de títulos e dos arcos que eles gerariam, para pegar falsos positivos do `paisesNoTexto`.
- **Modo leve:** desliga.

---

## Fase 3: funções novas com dados que já existem ou são grátis

### 3.1 Replay das últimas 24 h (tecla `H`)

**Dados**
- Usa `dados/calor-historico.json`: 100 leituras de 15 min, ou seja, umas 25 h.
- Confira se o arquivo guarda o valor de cada país em cada leitura. Se não guardar:
  - passe a guardar;
  - avise o dono que o replay só fica completo depois de 25 h.

**Como mostrar**
- Mostre a **variação**: cada país comparado com a própria média. Se não for assim, EUA e Brasil ficam sempre quentes.
- O replay toca tudo em 30 s, com uma barra de play/pausa e o horário.
- O dia e noite (2.2) anda junto com o horário do replay, para dar para ver as notícias seguindo o sol.

**Modo leve:** funciona, a 20 fps.

### 3.2 Terremotos e alertas de desastre

**Fontes**
- **USGS:** terremotos de magnitude 4,5 ou mais no dia (GeoJSON).
  - Endereço provável: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson`
- **GDACS:** só alertas laranja e vermelho (RSS).
  - Endereço provável: `https://www.gdacs.org/xml/rss.xml`
- As duas são grátis e sem chave. **Confirme os endereços atuais antes de usar.**
- Busque a cada 10 min, com o mesmo cuidado do plantão: GET condicional (ETag) e espera quando o servidor devolve 429.

**No globo**
- Marcador ciano, do tamanho da magnitude, com ping quando chega.
- Ao clicar: local, magnitude, hora e link.

**Avisos (Windows e Telegram)**
- Só para terremoto de 6,5 ou mais, ou alerta vermelho do GDACS.
- Ficam **desligados por padrão** no painel Vigiados.

**Rota nova:** `/api/natureza`.

### 3.3 Seguir uma história

- **Botão:** "seguir" numa notícia cria um **Vigiado temporário** com:
  - o país (o primeiro do título);
  - 2 ou 3 palavras-chave do título: primeiro os nomes próprios, sem palavras vazias.
- **Antes de confirmar:** o dono pode editar as palavras.
- **Validade:** expira em 72 h.
  - Fica num campo `expiraEm` em `dados/vigiados.json`.
  - O painel mostra quanto falta e deixa renovar.
- **Motor:** usa o `sentinela.js` como ele é. Como a 1ª checagem só semeia, a mesma notícia não é avisada de novo.
- **Avisos:** usa os canais que o dono já escolheu.

---

## Fase 4: as maiores (só se o dono quiser)

### 4.1 Visão de dentro (só quando o dono clica)

**Primeiro passo: "Capa de lá"**
- No painel do país, um botão mostra as principais manchetes da edição local do Google Notícias daquele país (`hl`, `gl`, `ceid`).
- Traduz só as 5 primeiras.
- Não precisa traduzir nenhuma busca.

**Depois, se o dono gostar: "Esta história lá"**
- Fica numa notícia específica.
- Traduz as palavras-chave para a língua do país (1 tradução).
- Busca na edição local e traduz os 5 primeiros títulos.

**Cota do tradutor**
- Respeite o limite do `traduzir.js` (60 traduções a cada 10 min).
- Reserve uma parte para o plantão: a Visão de dentro usa no máximo 20.

**Sem edição local:** países sem edição do Google Notícias não mostram o botão.

### 4.2 Modo TV (tecla `F`)

- **Visual:**
  - tela cheia, com os painéis escondidos;
  - o globo fica na viagem automática, com etiquetas maiores;
  - no topo, a história vista em mais países.
- **Entrar sozinho:** opção de entrar depois de X minutos sem ninguém mexer. Fica desligada por padrão.
- **Sair:** qualquer tecla ou movimento do mouse volta ao normal.
- **Modo leve:** funciona, sem a chuva Matrix.

### 4.3 Fotos em verde de câmera de vigilância

- **Quais notícias:** só as que o RSS já traz com miniatura. BBC, Al Jazeera e DW costumam trazer; o Google Notícias normalmente não traz.
- **Visual:**
  - foto monocromática verde, feita com filtro CSS parado numa imagem pequena (não é `backdrop-filter`);
  - a foto só carrega quando aparece na tela.
- **Confira antes:** se a janela tem alguma regra que bloqueia imagens de fora.
- **Modo leve:** sem fotos.
- **Opção para desligar:** se o dono achar que quebra o estilo.

---

## Fica de fora (com o motivo)

| Ideia | Motivo |
|---|---|
| Faixa de mercado e bolsas abertas | Mercado é assunto do Escritório Trader. Enche a tela e foge de "o Vigia é notícia". Se o dono quiser mesmo, vira um item separado depois. |
| Índice único de "tensão mundial" | Volume de notícia não mede perigo real. Um número só passaria uma falsa precisão. |
| Teletipo em tudo | Atrasa a leitura. Fica só no banner de plantão. |
| Tarja no estilo emissora de TV | Brigaria com o visual de central de vigilância. Foi trocada pela etiqueta de alvo. |

---

## Como pedir ao Claude Code

1. "Leia `melhorias-portal.md` e faça a Fase 1."
2. Confira na tela, aprove e diga "pode seguir para a Fase 2".
3. Repita para as Fases 3 e 4 (a 4 é opcional).

Se quiser só um item, peça pelo número. Exemplo: "faça só o 1.1 e o 1.2".
