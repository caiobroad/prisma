# Prisma

Uma única biblioteca para tudo que você joga. Steam, Epic Games, GOG, Xbox PC e executáveis avulsos reunidos num launcher desktop de vidro fosco para Windows 11. Cada jogo muda a atmosfera da interface (Modo Zona), a biblioteca toca trailers ao repousar o cursor, e o launcher sai do caminho quando o jogo abre.

Electron 44 · React 19 · TypeScript · SQLite (`node:sqlite` embutido) · hls.js (carregado só quando um trailer toca).

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
| Biblioteca           | Todos os jogos da conta, instalados ou não, em grade virtualizada. Hover: inclinação 3D, zoom, brilho e sombra que segue o cursor; após ~1 s parado, trailer sem som no lugar da capa |
| Página do jogo       | Banner a 35% da altura, ícone sobreposto, Jogar/Instalar, plataforma, tamanho, última vez aberto, tempo jogado, conquistas, descrição expansível, trailer no banner |
| Timeline Gamer       | Primeira sessão, último acesso, horas totais, recorde de sessão, sequências de dias, conquistas com data, por mês ou por jogo |
| Performance          | GPU, CPU, RAM, temperaturas, FPS e VRAM ao vivo; configuração do Modo Performance; histórico das sessões     |
| Performance Center   | Painel opcional ao clicar em Jogar, com os mesmos dados e o botão Modo Performance                           |
| Modo Controle        | Interface de console em prateleira 3D com reflexo, navegada por controle (ou setas/Enter/Esc). Abre pelo botão da barra ou Start/Options |
| Vitrine ociosa       | Sem interação e com o launcher em foco, passeia pela biblioteca com banners, trailers e faixa de capas. Qualquer movimento cancela |
| Lançamento cinematográfico | A interface recua e desfoca, o banner surge de um desfoque forte até nítido, e o jogo abre no fim. Na volta, o caminho inverso |
| Temas                | Escuro, claro ou do sistema; vidro, sombras, transparências e acentos mudam juntos                           |

## Modo Performance

Quando ligado, ao clicar em Jogar:

1. Pede o fechamento dos processos listados em Performance (sem forçar, como clicar no X).
2. Baixa a prioridade dos processos do launcher.
3. Destrói a janela do launcher depois da animação, liberando a memória da interface. Bandeja, contagem de tempo e monitor continuam.
4. Quando o jogo fecha, recria a janela com a transição de retorno e restaura a prioridade.

Sem o Modo Performance, a janela só minimiza durante o jogo e volta sozinha quando ele fecha.

## Leituras de desempenho

| Métrica                   | Fonte                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| CPU e RAM                 | Node (`os`)                                                           |
| GPU, VRAM, temperatura GPU | `nvidia-smi` em modo contínuo; sem NVIDIA, contadores WMI (sem temperatura) |
| Temperatura do processador | Zona térmica ACPI via WMI (aproximada; sem administrador)            |
| FPS                       | PresentMon, se o caminho for configurado em Performance (costuma exigir administrador) |

O monitor fica desligado quando nada o usa, lê a cada 1 s com uma tela de desempenho aberta e a cada 5 s durante o jogo. Médias de CPU, GPU, FPS e o pico de temperatura da GPU ficam gravados em cada sessão.

## Desempenho e memória

Medido nesta máquina (Intel UHD + RTX 4050, monitor de 165 Hz, janela visível):

| Situação                                  | Custo                                       |
| ----------------------------------------- | ------------------------------------------- |
| Início com partículas, usuário ativo      | GPU ~6% e renderer ~6% de um núcleo         |
| Usuário parado > 15 s ou janela coberta   | perto de 0%                                 |
| Vitrine ociosa                            | GPU ~24% e renderer ~19% de um núcleo       |
| Biblioteca com 1.362 jogos                | ~550 nós no DOM, 24 capas montadas, heap JS ~13 MB, busca em 60 ms |
| Durante o jogo no Modo Performance        | renderer destruído; ~440 MB no total        |

O que mantém isso baixo:

- Estado global com seletores: um aviso ou uma leitura do monitor não re-renderizam a biblioteca.
- Grade virtualizada; imagens com `loading="lazy"` e `decoding="async"`; URLs quebradas não são pedidas de novo.
- Partículas a 30 FPS por temporizador (não por `requestAnimationFrame` contínuo, que em 165 Hz acordaria o compositor 165 vezes por segundo), 15 FPS com o usuário parado, 20 FPS no Modo Performance, sprites em cache e nenhuma alocação por quadro.
- Nenhuma animação CSS infinita fora das que a zona pede; vidro sem `backdrop-filter` sobre o fundo animado (o desfoque real fica em modais e sobre imagens estáticas).
- Banner de fundo desfocado desenhado numa miniatura de 64×36 esticada pela GPU, em vez de um `blur()` em tela cheia.
- Tudo pausa com a janela minimizada ou coberta, e com a vitrine ou o Modo Controle cobrindo a tela.
- Trailers: um por vez, hls.js "light" carregado sob demanda, buffer curto, destruídos (não pausados) ao sair; depois o cache de imagens do renderer é liberado.
- Escondido na bandeja por 3 minutos, o renderer é destruído e recriado ao reabrir.

O processo de GPU do Chromium segura texturas e superfícies de vídeo até ter pressão de memória, então depois de trailers e da vitrine o total pode passar de 800 MB antes de recuar.

## Biblioteca completa

| Plataforma | Jogos da conta                                                                    | Instalados                              |
| ---------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| Steam      | `appinfo.vdf` cruzado com `librarycache` e `userdata\*\config\localconfig.vdf`    | `appmanifest_*.acf` (com tamanho)       |
| Epic       | `Data\Catalog\catcache.bin` filtrado para jogos                                   | Manifestos `.item` (com tamanho)        |
| GOG        | Banco do GOG Galaxy 2.0, se instalado                                             | Registro `GOG.com\Games`                |
| Xbox PC    | Não exposto localmente pela Microsoft                                             | Pacotes MSIX com `MicrosoftGame.config` |
| Manual     | —                                                                                 | `.exe`/`.lnk`                           |

Descrição, gêneros e trailer vêm da loja Steam (em português quando existe), buscados uma vez por jogo; para Epic e GOG o jogo é localizado na Steam pelo título. Conquistas da Steam são lidas do cache local do cliente (`appcache\stats`), com a data de cada desbloqueio. O tamanho em disco vem do manifesto da loja ou é somado da pasta sob demanda.

## Estrutura

```
src/
  shared/types.ts          Tipos compartilhados (Game, Session, Achievement, PerfSample, Settings, PrismaApi)
  main/
    index.ts               Ciclo de vida, bandeja, hibernação da janela, orçamento de memória da GPU
    ipc.ts                 Handlers IPC, varredura, lançamento com Modo Performance
    monitor.ts             Monitor de desempenho sob demanda (os, nvidia-smi, WMI, PresentMon)
    perfmode.ts            Fechar processos pesados, prioridade, memória do launcher
    achievements.ts        Conquistas da Steam do cache local
    meta.ts                Detalhes e trailer via loja Steam, tamanho da pasta, cor da zona
    sessions.ts            Sessões por processo filho ou pela pasta de instalação
    launcher.ts / window.ts / tray.ts / settings.ts
    db/                    SQLite: jogos, sessões (com métricas), conquistas, fontes, ajustes
    scanners/              steam, epic, gog, xbox
    util/                  appinfo.vdf, KeyValues binário e texto, PowerShell/reg
  preload/index.ts         window.nexus (inclui liberar cache de imagens)
  renderer/src/
    App.tsx                Layout, navegação com View Transitions, zona, vitrine, Modo Controle
    lib/store.ts           Estado global com seletores e o fluxo de "Jogar"
    lib/trailers.ts        Trailers HLS sob demanda, um por vez
    lib/input.ts           Ociosidade e Gamepad API
    lib/zones.ts           Temas do Modo Zona
    components/            VirtualGrid, GameCard, TrailerVideo, ZoneBackdrop, ZoneParticles, PerformanceCenter,
                           PerfMetrics, LaunchCinematic, IdleShowcase, ControllerMode, TitleBar, Sidebar…
    views/                 Home, Library, GamePage, Recent, Favorites, Timeline, Performance, Settings
    styles/                tokens.css (temas e @property da zona) e app.css
```

## Atalhos

| Tecla                      | Ação                                   |
| -------------------------- | -------------------------------------- |
| Ctrl K                     | Buscar                                 |
| F11                        | Tela cheia                             |
| F5                         | Sincronizar                            |
| Esc / Alt ← / botão voltar | Voltar da página do jogo               |
| Enter na capa              | Abrir a página do jogo                 |
| Duplo clique na capa       | Jogar (ou instalar)                    |
| Start/Options no controle  | Modo Controle                          |
| Ctrl Alt P                 | Trazer o Prisma para a frente          |

## Dados

Tudo fica em `%AppData%\Prisma\prisma.db`. Não há conta nem telemetria.
