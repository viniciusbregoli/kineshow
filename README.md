# Quiz Show (Kinelhão)

Este é um sistema de Quiz em tempo real estilo "Kahoot" ou "Show do Milhão". O sistema permite um apresentador (Host), uma tela de projeção (Display) e múltiplos jogadores conectados via celular (Players).

## Funcionalidades

- **Multiplayer em Tempo Real**: Suporte para múltiplos jogadores simultâneos.
- **Três Interfaces**:
  - **Host**: Painel de controle para iniciar o jogo, gerenciar perguntas, ver ranking em tempo real e kickar jogadores.
  - **Display**: Tela visual para projetor/TV com animações, perguntas e sons.
  - **Player**: Interface mobile para os participantes responderem.
- **Resiliência e Reconexão**:
  - Jogadores podem reconectar e recuperar sua pontuação caso a internet caia ou a página recarregue.
  - Novos jogadores podem entrar no meio da partida.
  - O Host pode recarregar a página sem perder o controle da sessão.
- **Sistema de Saves**: O progresso do jogo é salvo automaticamente a cada pergunta. Em caso de falha no servidor, é possível carregar o jogo exatamente de onde parou.
- **Áudio Imersivo**: Integração com efeitos sonoros e falas (requer arquivos de áudio na pasta `public`).

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) instalado.

## 🛠️ Instalação

1. Clone o repositório ou baixe os arquivos.
2. Navegue até a pasta do projeto:
   ```bash
   cd kahoot-clone
   ```
3. Instale as dependências:
   ```bash
   npm install
   ```

##  Como Rodar

1. Inicie o servidor:
   ```bash
   npm start
   ```
   Ou:
   ```bash
   node server.js
   ```

2. O servidor iniciará na porta 3000 (padrão).

## 🎮 Como Jogar

### 1. Host (Controlador)
- Acesse: `http://localhost:3000/host.html` no seu computador/tablet.
- Clique em **"Criar Novo Jogo"**.
- Um **PIN** será gerado.
- Compartilhe o QR Code ou o PIN com os jogadores.
- Quando todos estiverem conectados, clique em **"Iniciar Quiz"**.

### 2. Display (Telão)
- No painel do Host, clique em **"Abrir Tela de Projeção"**.
- Mova essa janela para o projetor ou segunda tela.
- **Importante**: Clique na tela uma vez para habilitar o áudio (política de autoplay dos navegadores).

### 3. Players (Jogadores)
- Acessem: `http://localhost:3000/player.html` (ou escaneiem o QR Code).
- Digitem o **PIN** e um **Nome**.
- Aguardem o início da rodada.

## Recuperação de Jogo (Crash Recovery)

### Se o Servidor Reiniciar:
1. No **Host**, clique em **"Carregar Jogo Salvo"**.
2. Selecione o arquivo com o PIN correspondente à sessão anterior.
3. Os jogadores devem acessar a página de Player, clicar em **"Reconectar Jogador Antigo"**, digitar o PIN e selecionar seu nome na lista.

### Se um Jogador Cair:
1. Basta recarregar a página. O sistema tentará reconectar automaticamente.
2. Se não funcionar, use a opção **"Reconectar Jogador Antigo"** na tela inicial do Player.

## Estrutura de Arquivos

- `server.js`: Lógica principal do servidor e Socket.IO.
- `public/`: Arquivos de frontend.
  - `host.html`: Painel do apresentador.
  - `display.html`: Tela de projeção.
  - `player.html`: Tela do jogador.
  - `falas/`: Áudios de narração (não incluídos no repo padrão).
- `saves/`: Arquivos JSON com o estado dos jogos salvos.
