# 🌐 Vigia Global

**Um portal de notícias do mundo em forma de globo 3D, no estilo "central de vigilância", que roda no seu próprio PC.**

Você gira o globo, clica num país e vê as notícias dele. Ele também mostra em que lugar do mundo está acontecendo mais coisa agora, fica de olho nos países e assuntos que você escolher e avisa no Windows e no Telegram quando sai algo grande.

> **Não usa IA, não precisa de chave de API e não tem mensalidade.** Tudo vem de fontes públicas (RSS do Google Notícias, BBC, Al Jazeera, g1, CNN Brasil, DW e Reddit) e das transmissões oficiais das emissoras no YouTube.

---

## Para que serve

- **Ver o mundo de uma vez só:** quais países estão "quentes" de notícia agora, sem abrir 20 sites.
- **Não perder o que importa:** você escolhe países e palavras (ex.: "Irã", "eleições", "petróleo") e o Vigia avisa quando sai manchete nova sobre eles, mesmo com a janela fechada.
- **Saber na hora quando acontece algo grande:** quando várias fontes diferentes dão a mesma notícia urgente em pouco tempo, vira **plantão**, com banner vermelho, aviso do Windows e mensagem no Telegram.
- **Ler o dia em 2 minutos:** o **Resumo do dia** junta as 10 maiores histórias do mundo e as 5 do Brasil, com mais fontes, e manda no Telegram no horário escolhido.
- **Assistir ao vivo:** a **TV ao vivo** abre os canais de notícia oficiais de 35 países (68 emissoras), como CNN Brasil, BBC/Sky, Al Jazeera, DW e NHK.

## O que tem na tela

| Função | O que faz | Tecla |
|---|---|---|
| **Globo** | Globo 3D de pontos com chuva Matrix, dia e noite e relógios. Quando ninguém mexe, viaja sozinho de país em país mostrando manchetes. | arrastar / rodinha |
| **Notícias do país** | Clique num país: as notícias aparecem e a câmera "mergulha" nele, desenhando os estados. Clique num estado para ver as notícias de lá. | clique, `Esc` volta |
| **15 assuntos** | Economia, Mercados, Cripto, Geopolítica, Política, Tecnologia e IA, Energia, Commodities, Clima, Saúde, Conflitos, Justiça, Ciência, Migração e Religião. | `1`–`0`, `G J E M R`, `T` = tudo |
| **Termômetro** | Pinta os países pelo volume de notícias das últimas 24 h e lista os mais quentes. | `C` |
| **Vigiados** | Seus países e palavras vigiados, avisos (Windows e Telegram), sensibilidade do plantão e horário do resumo. | `V` |
| **Plantão** | Faixa de manchetes rolando embaixo e banner vermelho quando sai notícia bomba. | — |
| **AO VIVO** | Tudo o que chegou nas últimas 12 h, com as abas Mundo, Brasil, Urgentes e Tudo, e de quais países veio a cobertura ("visto em GB QA BR"). | `A` |
| **Resumo do dia** | As maiores histórias do dia, que abre sozinho uma vez por dia. | `D` |
| **TV ao vivo** | Janela verde à parte com as emissoras de notícia ao vivo de cada país. | `N` |
| **Modo leve** | Menos quadros por segundo e sem chuva Matrix, para gastar menos. | `L` |
| **Ajuda** | Mostra todas as teclas. | `?` |

Na janela da TV: `↑ ↓` muda de país, `← →` muda de emissora, `M` liga e desliga o som e `/` busca.

## Do que precisa

- **Windows 10 ou 11.** Os avisos e a abertura de links usam recursos do Windows.
- **[Node.js](https://nodejs.org/) 20 ou mais novo.** Foi testado no Node 26.
- **Microsoft Edge**, que já vem no Windows, para abrir a janela do app.
- *(Opcional)* **Brave**, para abrir as notícias. Sem ele, as notícias abrem no próprio Edge.
- *(Opcional)* **Um bot do Telegram**, para receber os avisos no celular.

Não há nada para instalar com `npm`: o projeto não tem dependências.

## Como ligar

1. Baixe ou clone esta pasta:
   ```bash
   git clone https://github.com/Ogfreitas/VIGIAGLOBAL.git
   ```
2. *(Opcional, para o Telegram)* Crie a pasta `dados` e copie o arquivo `config.exemplo.json` para dentro dela com o nome `config.json`. Depois coloque o token do bot e o seu chatId.
   > ⚠️ O `dados/config.json` **nunca** vai para o GitHub (está no `.gitignore`). Não cole o token em nenhum outro arquivo.
3. Abra:
   ```bash
   node abrir.js
   ```
   Isso liga o **motor** escondido (um servidor local em `http://localhost:8788`) e abre a **janela**.

- Para só ligar o motor, sem abrir a janela (os avisos continuam chegando): `node abrir.js --sem-janela`.
- Para ligar junto com o Windows: crie um atalho para `node.exe abrir.js --sem-janela` na pasta *Inicializar* (`shell:startup`).
- Depois de mudar o código do motor: `node ferramentas/reiniciar-motor.js`.

## Privacidade e segurança

- Tudo roda **só no seu PC**: o motor escuta apenas em `127.0.0.1`, e nenhum site de fora consegue mandar comandos para ele (os pedidos `POST` conferem a origem).
- O token do Telegram fica só em `dados/config.json` e **nunca** vai para a janela nem para o GitHub.
- Os seus vigiados, o histórico do termômetro e os logs ficam em `dados/`, fora do repositório.

## Documentação

| Arquivo | Para quem | O que tem |
|---|---|---|
| **[HANDOFF.md](HANDOFF.md)** | Quem vai mexer no código | Como tudo funciona por dentro: arquitetura, módulos, rotas, dados, regras, testes, estado atual e próximos passos. |
| [CLAUDE.md](CLAUDE.md) | Claude Code | O contexto completo do projeto e as regras de trabalho, com a linha do tempo. |
| [melhorias-portal.md](melhorias-portal.md) | Dono e Claude Code | O plano "cara de portal ao vivo", em 4 fases. As fases 1 e 2 estão prontas. |

## Fontes e créditos

- **Notícias:** Google Notícias (RSS público), Reddit r/worldnews, BBC World, Al Jazeera, g1, CNN Brasil e DW Brasil.
- **Tradução das manchetes em inglês:** o tradutor público do Google.
- **Mapas dos estados:** [Natural Earth](https://www.naturalearthdata.com/) admin-1 (domínio público).
- **TV ao vivo:** as transmissões oficiais das próprias emissoras no YouTube, tocadas pelo player oficial (`youtube-nocookie.com`).

Projeto pessoal, feito para uso próprio.
