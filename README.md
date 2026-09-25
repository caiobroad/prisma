# Prisma

Uma única biblioteca para tudo que você joga. Steam, Epic Games, GOG, Xbox PC e executáveis avulsos reunidos num launcher desktop de vidro fosco para Windows 11. Cada pessoa da casa tem o próprio perfil, com Game DNA, amigos e estatísticas. A atmosfera da interface muda com o jogo (Modo Zona) e com o Mood escolhido, a biblioteca toca trailers ao repousar o cursor, e o launcher sai do caminho quando o jogo abre.

Electron 44 · React 19 · TypeScript · SQLite (`node:sqlite` embutido) · hls.js (carregado só quando um trailer toca).

Criado por **Caio Broad** e **Agenor Antonio**.

## Rodar

Pré-requisito: Node.js 22 ou mais novo. Se o Node não estiver no PATH, os scripts `.cmd` e o `Prisma.exe` usam a cópia portátil em `C:\Claude\tools\node`.

```bash
npm install
```

```bash
npm run dev
```

Para abrir o build de produção, use `Prisma.exe` ou `start.cmd`.

| Comando             | O que faz                                          |
| ------------------- | -------------------------------------------------- |
| `npm run typecheck` | Checa os tipos do processo principal e do renderer |
| `npm run build`     | Gera `out/`                                        |
| `npm run dist`      | Gera instalador NSIS e versão portátil em `dist/`  |

Teste de carga: `NEXUS_FAKE_GAMES=1200` soma 1.200 jogos sintéticos à lista (não vão para o banco).

## Telas e modos

| Onde                 | O que faz                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Introdução           | Ao abrir: o feixe de luz atravessa o prisma, o som de abertura toca e aparece "clique em qualquer lugar" (desligável em Ajustes → Geral) |
| Quem está jogando?   | A cada abertura do app, escolha (ou crie) o perfil. Num PC novo, é aqui que se cria o primeiro. Cada perfil tem foto, banner, nickname, ajustes, sessões, histórico de busca e a própria conta Steam |
| Menu lateral         | Início, Instalados, Biblioteca, Emulação, Loja, Amigos e Perfil; embaixo, Adicionar jogo e Modo Controle |
| Barra de cima        | Busca, menu de modos (Modo Performance, Modo Zona, Modo Controle, Desempenho e Mood), perfil e engrenagem de Ajustes |
| Início               | Destaque, Continuar jogando, Instalados e Biblioteca, com ícones por seção                                   |
| Instalados           | Aba fixa com o que está no disco e o espaço ocupado                                                         |
| Biblioteca           | Todos os jogos da conta (e os de emulador, no filtro Emuladores) em grade virtualizada. Hover (ou foco pelo teclado): inclinação 3D, brilho e sombra dinâmica; após 0,8 s, trailer sem som, com volta imediata à capa |
| Coleção              | A biblioteca como estante: % concluído, horas totais, mais jogados, gosto por gênero, lançamentos por ano e prateleiras por franquia |
| Loja                 | Ofertas, mais vendidos, lançamentos e pré-vendas da Steam, grátis e promoções da Epic, em reais; busca na Steam; com a chave do IsThereAnyDeal, o menor preço histórico de cada jogo |
| Página do jogo       | Trailer tocando sem som no banner; abas Visão geral, Conquistas (todas, com as bloqueadas), Avaliações (Steam, em português) e Oficina (itens em alta). Jogar/Instalar, "concluído", Smart Resume, Radar da Comunidade, requisitos mínimos (com checagem de RAM), avaliação da Steam, Metacritic, tags, franquia, tamanho |
| Emulação             | Os jogos de console (por emulador), com filtro por console e o passo a passo para configurar |
| Perfil               | Abas Visão geral e Timeline Gamer. Foto e banner editáveis, horas, sessões, conquistas, Game DNA (radar compartilhável em PNG), comparação de horas e bibliotecas, jogos em comum, amigos online |
| Amigos               | Amigos da Steam (jogando, online, ausente, offline recentemente) e os outros perfis do PC, com atalho para o perfil de cada um |
| Timeline Gamer       | Aba do Perfil. Primeira sessão, último acesso, horas totais, recorde de sessão, sequências de dias, conquistas com data     |
| Performance          | GPU, CPU, RAM, temperaturas, FPS e VRAM ao vivo; configuração do Modo Performance; histórico das sessões     |
| Modo Controle        | Abre no último jogo jogado (Smart Resume), intro de console, prateleira 3D, sons de sistema, vibração, abas no L2/R2, ajustes próprios e cursor virtual no analógico direito (R3 clica) |
| Vitrine ociosa       | Sem interação e com o launcher em foco, passeia pela biblioteca com banners e trailers                        |
| Créditos             | Ajustes → Créditos                                                                                            |

## Novidades desta versão

- **Conta Steam por perfil:** cada perfil escolhe qual conta da Steam deste PC ele usa (ou nenhuma) e vê só os jogos, o tempo de jogo, as conquistas e os amigos dela. Antes, com duas contas no mesmo PC, as bibliotecas se misturavam. Sem chave, a separação usa o que a Steam guarda no disco por conta (jogos já jogados e jogos instalados, pelo dono do manifesto); com a chave da Steam Web API do próprio perfil, vem a lista completa, inclusive os nunca abertos. Perfis antigos continuam vendo tudo até escolherem a conta (a Biblioteca avisa).
- **PC novo sem "Jogador" automático:** a primeira abertura pede para criar o perfil, com nickname e conta Steam.
- **Introdução de abertura:** feixe de luz, prisma, espectro e um som de abertura sintetizado; clique, tecla ou botão do controle para entrar, com transição suave para a escolha de perfil.
- **Barra lateral:** Emulação (com passo a passo quando vazio), Perfil como aba própria, e atalhos para Adicionar jogo e Modo Controle. A Timeline Gamer virou uma aba do Perfil.
- **Aviso sobre as chaves de API** (Steam e IsThereAnyDeal): opcionais, pessoais como senha, guardadas só no PC, usadas só para ler; o que fazer se vazar.
## 0.2.4

- **Loja:** ofertas da Steam e da Epic com preço em reais, desconto e até quando vale. Com a chave gratuita do [IsThereAnyDeal](https://isthereanydeal.com/apps/my/) (Ajustes → Loja), cada jogo mostra o menor preço que já teve e um selo quando o preço atual é o menor de todos. A SteamDB não permite uso por apps, por isso o histórico vem do IsThereAnyDeal.
- **Emuladores:** DuckStation (PS1), PCSX2 (PS2), PPSSPP (PSP), Dolphin (GameCube/Wii), Ryujinx (Switch) e mGBA (GBA). O Prisma não emula nada: aponte o emulador e a pasta dos jogos em Ajustes → Emuladores e eles entram na biblioteca com capa (libretro-thumbnails). Com "Saves na nuvem", os saves vão para uma pasta sincronizada (OneDrive, Google Drive ou Dropbox): o mais novo é trazido antes de jogar e enviado ao fechar.
- **Página do jogo em abas:** Conquistas completas, Avaliações da Steam (em português, completando com inglês) e Oficina. O trailer toca sozinho, sem som, no banner.
- **Sincronização automática:** sem botão. Além de ao abrir e a cada 30 min, o Prisma observa os manifestos da Steam e da Epic e sincroniza sozinho quando um jogo é instalado, atualizado ou desinstalado (nunca durante um jogo).
- **Popup de atualização com changelog** e, depois de atualizar, um popup "Novidades" com as notas da versão (também em Ajustes → Atualizações → Ver novidades).
- **Modo Controle:** abre no último jogo jogado com "Continuar"; ↑/↓ não pulam mais 8 jogos.
- **Interface enxuta:** menu lateral com cinco itens; Ajustes numa engrenagem ao lado do perfil; Modo Performance, Modo Zona, Modo Controle, Desempenho, Timeline e Mood num só menu.

## Versões anteriores
- **Perfis:** tela "Quem está jogando?" em toda abertura. O primeiro perfil herda as sessões e ajustes antigos e é o "dono da conta Steam" (soma o tempo registrado pela Steam). Os demais contam as sessões feitas pelo Prisma.
- **Game DNA:** RPG, FPS, Terror, Corrida, Estratégia e Sobrevivência, calculado das tags da Steam de cada jogo, pesadas por horas^0,7 (um jogo de 2.000 h não apaga o resto). Aparece no perfil de amigos e pode ser salvo ou copiado como imagem.
- **Amigos:** sem configuração, o Prisma mostra os amigos que o cliente Steam guarda neste PC (nome e foto). Com a chave pessoal da Steam Web API (Ajustes → Amigos e comunidade), mostra quem está online ou jogando e compara bibliotecas públicas. A Epic não oferece lista de amigos para apps de terceiros.
- **Smart Resume:** durante o jogo, uma captura da tela aos 45 s e depois a cada 3 min (uma imagem por sessão, só as 200 mais recentes ficam em `%AppData%\Prisma\resume`). Se você tirar screenshots com F12 na Steam, a mais recente vence. O cartão mostra duração, FPS médio, temperaturas máximas de CPU e GPU e as conquistas da sessão. Dá para desligar em Ajustes.
- **Conquistas por cima do jogo:** o Prisma observa o cache de estatísticas da Steam durante o jogo e mostra um cartão no canto da tela (janela transparente, sem foco e sem cliques), com som opcional. Jogos em tela cheia exclusiva escondem janelas por cima; em modo sem borda aparece normalmente.
- **Radar da Comunidade:** jogadores agora, avaliação atual, total de análises, atualizações oficiais e notícias (cache de 10 min).
- **Mood da Biblioteca:** Prisma, Resident Evil, Silent Hill, Cyberpunk, S.T.A.L.K.E.R., Minecraft, DOOM e Elden Ring. Só cores, luz, partículas e vidro; o tema claro saiu.
- **Busca:** histórico, sugestões de jogos e filtros (`genero:terror`, `plataforma:epic`, `franquia:"resident evil"`, `ano:2020`, `ano>2018`, `ano:2015-2020`, `nota>80`, `instalado`, `!instalado`, `concluido`, `favorito`, `roda` = requisitos mínimos de RAM atendidos). Filtros ativos viram chips removíveis.
- **Navegação sem mouse:** setas movem o foco pela tela (inclusive entre menu e grade), Enter abre, Esc volta, Ctrl ↑/↓ troca de tela. No controle, fora do Modo Controle: direcional, A, B e L2/R2.
- **Enriquecimento em segundo plano:** tags, avaliações, requisitos e Metacritic chegam da loja Steam em lotes, pausando enquanto um jogo roda e recuando se a loja limitar.
- **Transições:** toda troca de tela passa por View Transitions na GPU; capas e banners surgem com fade sobre um esqueleto.

## Modo Performance

Quando ligado, ao clicar em Jogar:

1. Pede o fechamento dos processos listados em Performance (sem forçar, como clicar no X).
2. Baixa a prioridade dos processos do launcher.
3. Destrói a janela do launcher depois da animação, liberando a memória da interface. Bandeja, contagem de tempo, monitor, Smart Resume e conquistas continuam.
4. Quando o jogo fecha, recria a janela com a transição de retorno e restaura a prioridade.

Sem o Modo Performance, a janela só minimiza durante o jogo e volta sozinha quando ele fecha.

## Leituras de desempenho

| Métrica                   | Fonte                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| CPU e RAM                 | Node (`os`)                                                           |
| GPU, VRAM, temperatura GPU | `nvidia-smi` em modo contínuo; sem NVIDIA, contadores WMI (sem temperatura) |
| Temperatura do processador | Zona térmica ACPI via WMI (aproximada; sem administrador)            |
| FPS                       | PresentMon, se o caminho for configurado em Performance (costuma exigir administrador) |

O monitor fica desligado quando nada o usa, lê a cada 1 s com uma tela de desempenho aberta e a cada 5 s durante o jogo. Médias de CPU, GPU, FPS e os picos de temperatura de CPU e GPU ficam gravados em cada sessão.

## Desempenho e memória

Medido nesta máquina (Intel UHD + RTX 4050, monitor de 165 Hz):

| Situação                                  | Custo                                       |
| ----------------------------------------- | ------------------------------------------- |
| Início com partículas, janela visível     | GPU ~7% e renderer ~3% de um núcleo         |
| Janela minimizada                         | renderer 0,1%, GPU 0%                       |
| Vitrine ociosa                            | GPU ~9% e renderer ~11% de um núcleo        |
| 1.362 jogos                               | Coleção em 44 ms, Biblioteca em 49 ms, busca com filtros em ~185 ms, ~600 nós no DOM, heap JS ~17 MB |
| Durante o jogo no Modo Performance        | renderer destruído                          |

O que mantém isso baixo:

- Estado global com seletores: um aviso ou uma leitura do monitor não re-renderizam a biblioteca.
- Telas pouco visitadas (Perfil, Amigos, Coleção, Timeline, Performance, Ajustes, Créditos, Modo Controle) são carregadas sob demanda; o bundle é minificado.
- Grade virtualizada; prateleiras da Coleção fora da tela não pintam (`content-visibility`).
- Esqueleto de carregamento movido só por `transform`, três passadas e para; nenhuma animação infinita nova. O Mood não liga o reflexo metálico (que é um ciclo).
- Partículas a 30 FPS por temporizador, 15 FPS com o usuário parado; o controle é lido a 60 Hz, não no ritmo do monitor.
- Tudo pausa com a janela minimizada ou coberta; trailers param quando a janela perde o foco.
- Sons do Modo Controle são sintetizados (sem arquivos) e o contexto de áudio dorme após 20 s de silêncio.
- A notificação de conquista é uma janela que só existe enquanto mostra algo.
- Escondido na bandeja por 3 minutos, o renderer é destruído e recriado ao reabrir.

## Biblioteca completa

| Plataforma | Jogos da conta                                                                    | Instalados                              |
| ---------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Steam      | `appinfo.vdf` cruzado com `librarycache` e `userdata\*\config\localconfig.vdf`    | `appmanifest_*.acf` (com tamanho)       |
| Epic       | `Data\Catalog\catcache.bin` filtrado para jogos                                   | Manifestos `.item` (com tamanho)        |
| GOG        | Banco do GOG Galaxy 2.0, se instalado                                             | Registro `GOG.com\Games`                |
| Xbox PC    | Não exposto localmente pela Microsoft                                             | Pacotes MSIX com `MicrosoftGame.config` |
| Manual     | —                                                                                 | `.exe`/`.lnk`                           |

Descrição, gêneros, trailer, requisitos e Metacritic vêm da loja Steam (em português quando existe); tags, avaliação e lançamento vêm de `IStoreBrowseService/GetItems`. Para Epic e GOG o jogo é localizado na Steam pelo título. A franquia vem do `appinfo.vdf`. Conquistas da Steam são lidas do cache local do cliente (`appcache\stats`), com a data de cada desbloqueio.

## Estrutura

```
src/
  shared/types.ts          Tipos compartilhados (Game, Session, Profile, Friend, Settings, PrismaApi…)
  main/
    index.ts               Ciclo de vida, bandeja, hibernação da janela, orçamento de memória da GPU
    ipc.ts                 Handlers IPC, varredura, lançamento com Modo Performance
    profiles.ts            Perfis locais, seleção e recorte de foto/banner
    settings.ts            Ajustes por perfil
    enrich.ts              Tags, avaliações e detalhes da loja em segundo plano
    community.ts           Radar da Comunidade
    steamWeb.ts            Amigos (Web API ou cache local), bibliotecas e tags para o Game DNA
    resume.ts              Capturas do Smart Resume
    notifier.ts            Notificação de conquista por cima do jogo
    monitor.ts             Monitor de desempenho sob demanda (os, nvidia-smi, WMI, PresentMon)
    perfmode.ts            Fechar processos pesados, prioridade, memória do launcher
    achievements.ts        Conquistas da Steam do cache local
    meta.ts                Detalhes, requisitos e trailer via loja Steam, tamanho da pasta, cor da zona
    sessions.ts            Sessões por processo filho ou pela pasta de instalação
    db/                    SQLite: jogos, sessões, perfis, conquistas, tags, fontes, ajustes
    scanners/              steam, epic, gog, xbox
  preload/index.ts         window.nexus
  renderer/src/
    App.tsx                Layout, navegação (View Transitions, setas, controle), perfis, Mood e zona
    lib/                   store, search, dna, social, nav, sounds, input, trailers, zones, img
    components/            ProfileSelect, SearchBox, MoodPicker, DnaRadar, SmartResume, CommunityRadar,
                           ControllerMode, VirtualGrid, GameCard…
    views/                 Home, Library, Collection, GamePage, Profile, Friends, Credits, Timeline, Performance, Settings…
    styles/                tokens.css, app.css e premium.css
```

## Atalhos

| Tecla                      | Ação                                   |
| -------------------------- | -------------------------------------- |
| Ctrl K                     | Buscar                                 |
| Setas                      | Mover o foco pela tela                 |
| Ctrl ↑ / Ctrl ↓            | Tela anterior / seguinte               |
| Enter                      | Abrir                                  |
| Esc / Alt ← / botão voltar | Voltar                                 |
| F11                        | Tela cheia                             |
| F5                         | Sincronizar                            |
| Duplo clique na capa       | Jogar (ou instalar)                    |
| Start/Options no controle  | Modo Controle                          |
| L2 / R2 no controle        | Trocar de tela ou de aba               |
| Ctrl Alt P                 | Trazer o Prisma para a frente          |

## Dados

Tudo fica em `%AppData%\Prisma` (`prisma.db` e as capturas do Smart Resume). A chave da Steam Web API, se usada, fica só neste PC. Não há conta nem telemetria.
