const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const SAVES_DIR = path.join(__dirname, 'saves');

// Ensure saves directory exists
if (!fs.existsSync(SAVES_DIR)) {
  fs.mkdirSync(SAVES_DIR);
}

function saveScores(room, pin) {
  const scores = Object.entries(room.players)
    .map(([id, p]) => ({ name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);

  const data = {
    pin,
    updatedAt: new Date().toISOString(),
    currentQuestion: room.currentQuestion + 1,
    totalQuestions: QUIZ.length,
    scores
  };

  const filename = path.join(SAVES_DIR, `${pin}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// Quiz hardcoded
const QUIZ = [
  {
    question: "Qual é o maior planeta do Sistema Solar?",
    options: ["Terra", "Marte", "Júpiter", "Saturno"],
    correct: 2
  },
  {
    question: "Em que ano o Brasil foi descoberto?",
    options: ["1492", "1500", "1822", "1889"],
    correct: 1
  },
  {
    question: "Qual elemento químico tem o símbolo 'O'?",
    options: ["Ouro", "Oxigênio", "Ósmio", "Ônio"],
    correct: 1
  },
  {
    question: "Quantos lados tem um hexágono?",
    options: ["4", "5", "6", "8"],
    correct: 2
  },
  {
    question: "Qual a capital da França?",
    options: ["Londres", "Berlim", "Madrid", "Paris"],
    correct: 3
  }
];

const TIME_LIMIT = 30; // segundos por pergunta

// Estado em memória
const rooms = {};
const sessions = {}; // sessionId -> { pin, name, socketId }

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function calculateScore(timeRemaining) {
  // Começa com 1000 pontos e perde 1/30 por segundo (se TIME_LIMIT = 30)
  // Fórmula: 1000 * (tempoRestante / tempoTotal)
  return Math.floor(1000 * (timeRemaining / TIME_LIMIT));
}

function proceedToRanking(room, pin) {
  const ranking = Object.entries(room.players)
    .map(([id, p]) => ({ name: p.name, score: p.score, connected: p.connected }))
    .sort((a, b) => b.score - a.score);

  if (room.currentQuestion >= QUIZ.length - 1) {
    io.to(pin).emit('game:final', { ranking });
  } else {
    io.to(pin).emit('game:ranking', { ranking });
  }
}

function endQuestion(room, pin) {
  // Clear any existing timer
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  const q = QUIZ[room.currentQuestion];

  // 1. Reveal correct answer to Display (and Host)
  io.to(pin).emit('game:reveal', { correct: q.correct });

  // Salvar pontuação
  saveScores(room, pin);

  // Define transition function
  const proceed = () => proceedToRanking(room, pin);

  // Set safety timeout (e.g. 12 seconds - generous for end.mp3 + speech)
  // If display emits event, this is cleared.
  room.rankingTimer = setTimeout(() => {
    room.rankingTimer = null;
    proceed();
  }, 12000);
}

function startQuestion(room, pin) {
  const q = QUIZ[room.currentQuestion];
  room.questionStartTime = Date.now();
  room.answers = {};

  // Calculate current player count
  const playerCount = Object.keys(room.players).length;

  // Send initial count 0/Total
  io.to(pin).emit('game:answerCount', {
    count: 0,
    total: playerCount
  });

  io.to(pin).emit('game:question', {
    index: room.currentQuestion,
    total: QUIZ.length,
    question: q.question,
    options: q.options,
    timeLimit: TIME_LIMIT
  });

  // Auto-end question after time limit + small buffer
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    endQuestion(room, pin);
  }, (TIME_LIMIT + 0.5) * 1000);
}

// Helper to load a game state
function loadGameData(pin) {
  const file = path.join(SAVES_DIR, `${pin}.json`);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error('Error reading save file', e);
    }
  }
  return null;
}

io.on('connection', (socket) => {
  // Host requests list of saved games
  socket.on('host:listSaves', () => {
    try {
      const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
      const saves = files.map(f => {
        const filePath = path.join(SAVES_DIR, f);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            file: f,
            pin: data.pin,
            updatedAt: data.updatedAt,
            currentQuestion: data.currentQuestion,
            totalQuestions: data.totalQuestions,
            playerCount: data.scores ? data.scores.length : 0
          };
        } catch (e) { return null; }
      }).filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      socket.emit('host:savesList', saves);
    } catch (e) {
      socket.emit('host:error', 'Failed to list saves');
    }
  });

  // Host loads a specific save
  socket.on('host:loadSave', ({ pin }) => {
    const data = loadGameData(pin);
    if (data) {
      console.log(`Loading saved game for PIN ${data.pin}`);
      rooms[data.pin] = {
        hostId: socket.id,
        players: {},
        currentQuestion: data.currentQuestion - 1,
        questionStartTime: null,
        answers: {},
        timer: null,
        savedScores: {}
      };

      if (data.scores && Array.isArray(data.scores)) {
        data.scores.forEach(s => {
          rooms[data.pin].savedScores[s.name] = s.score;
          const dummyId = `restored:${s.name}`;
          rooms[data.pin].players[dummyId] = {
            name: s.name,
            score: s.score,
            connected: false
          };
        });
      }

      // Emulate host joining
      socket.join(data.pin);
      socket.pin = data.pin;
      socket.isHost = true;

      // Trigger reconnection flow for host UI
      const players = Object.values(rooms[data.pin].players).map(p => p.name);
      const ranking = Object.entries(rooms[data.pin].players)
        .map(([id, p]) => ({ name: p.name, score: p.score, connected: p.connected }))
        .sort((a, b) => b.score - a.score);

      let currentQ = null;
      // DO NOT automatically resume question if loading save. 
      // The host should manually start. 
      // We will emulate "Ranking" state so Host sees "Next Question" button.

      // If we are restored, we are essentially "between questions" or "at ranking".
      // rooms[data.pin].currentQuestion is index of LAST COMPLETED question (due to -1).
      // So effectively we are at the end of that question.

      // Send ranking so host can proceed
      socket.emit('host:reconnected', {
        pin: data.pin,
        players,
        currentQuestion: rooms[data.pin].currentQuestion,
        totalQuestions: QUIZ.length,
        answerCount: 0,
        ranking,
        questionData: null, // Don't send question data to force ranking/lobby view
        allQuestions: QUIZ,
        isRestored: true // Flag to tell frontend to show ranking or lobby
      });

    } else {
      socket.emit('host:error', 'Save file not found');
    }
  });

  // Host cria sala
  socket.on('host:create', () => {
    const pin = generatePin();
    rooms[pin] = {
      hostId: socket.id,
      players: {},
      currentQuestion: -1,
      questionStartTime: null,
      answers: {},
      timer: null
    };
    socket.join(pin);
    socket.pin = pin;
    socket.isHost = true;
    socket.emit('host:created', { pin, allQuestions: QUIZ });
  });

  // Host kick player
  socket.on('host:kick', ({ pin, name }) => {
    const room = rooms[pin];
    if (!room) return;

    // Find player(s) with name
    const sessionIds = Object.keys(room.players).filter(sid => room.players[sid].name === name);

    sessionIds.forEach(sid => {
      const session = sessions[sid];
      if (session && session.socketId) {
        io.to(session.socketId).emit('player:error', 'Você foi removido da sala pelo host.');
        const s = io.sockets.sockets.get(session.socketId);
        if (s) {
          s.leave(pin);
          s.disconnect(); // Force disconnect
        }
      }
      delete room.players[sid];
      delete room.answers[sid]; // Clear answers if any
      if (sessions[sid]) delete sessions[sid];
    });

    // Notify host of update
    io.to(room.hostId).emit('host:playersUpdate', {
      players: Object.values(room.players).map(p => ({
        name: p.name,
        score: p.score,
        connected: p.connected
      }))
    });
  });

  // Host reconecta
  socket.on('host:reconnect', ({ pin }) => {
    const room = rooms[pin];
    if (!room) {
      socket.emit('host:error', 'Sala não existe mais');
      return;
    }

    room.hostId = socket.id;
    socket.join(pin);
    socket.pin = pin;
    socket.isHost = true;

    const players = Object.values(room.players).map(p => p.name);
    const ranking = Object.entries(room.players)
      .map(([id, p]) => ({ name: p.name, score: p.score, connected: p.connected }))
      .sort((a, b) => b.score - a.score);

    let currentQ = null;
    if (room.currentQuestion >= 0 && room.currentQuestion < QUIZ.length) {
      const q = QUIZ[room.currentQuestion];
      currentQ = {
        question: q.question,
        options: q.options
      };
    }

    socket.emit('host:reconnected', {
      pin,
      players,
      currentQuestion: room.currentQuestion,
      totalQuestions: QUIZ.length,
      answerCount: Object.keys(room.answers).length,
      ranking,
      questionData: currentQ,
      allQuestions: QUIZ
    });
  });

  // Display se conecta à sala
  socket.on('display:join', ({ pin }) => {
    const room = rooms[pin];
    if (!room) {
      socket.emit('display:error', 'Sala não encontrada');
      return;
    }

    socket.join(pin);
    socket.pin = pin;
    socket.isDisplay = true;

    const players = Object.values(room.players).map(p => p.name);

    // Determine restart state
    // If we are restored/saved, usually currentQuestion points to last finished one (data.currentQuestion - 1)
    // And we want to show ranking.
    // We can infer this if timer is null but we have questions >= 0

    const isRestored = (room.currentQuestion >= -1 && !room.timer && !room.rankingTimer && room.questionStartTime === null);

    // Calculate ranking to send if needed
    let ranking = [];
    if (isRestored && room.currentQuestion >= 0) {
      ranking = Object.entries(room.players)
        .map(([id, p]) => ({ name: p.name, score: p.score, connected: p.connected }))
        .sort((a, b) => b.score - a.score);
    }

    socket.emit('display:joined', {
      pin,
      players,
      isRestored,
      ranking,
      currentQuestion: room.currentQuestion
    });

    // If quiz started and active question (timer running or just started)
    if (room.currentQuestion >= 0 && (room.timer || room.rankingTimer)) {
      // ... (existing logic to resend question)
      const q = QUIZ[room.currentQuestion];
      socket.emit('game:question', {
        index: room.currentQuestion,
        total: QUIZ.length,
        question: q.question,
        options: q.options,
        timeLimit: TIME_LIMIT
      });
    }
  });

  // Display notifies that audio finished
  socket.on('display:audioEnded', ({ pin }) => {
    const room = rooms[pin];
    if (!room) return;

    if (room.rankingTimer) {
      clearTimeout(room.rankingTimer);
      room.rankingTimer = null;
      proceedToRanking(room, pin);
    }
  });

  // Display notifies that reveal happened (sync player feedback)
  socket.on('display:triggerReveal', ({ pin }) => {
    const room = rooms[pin];
    if (!room) return;

    // Send feedback to all players
    Object.keys(room.players).forEach(sid => {
      const session = sessions[sid];
      if (session && session.socketId) {
        const ans = room.answers[sid];
        if (ans) {
          // Player answered
          io.to(session.socketId).emit('player:feedback', { correct: ans.correct, points: ans.points });
        } else {
          // Player did not answer (time up)
          io.to(session.socketId).emit('player:feedback', { correct: false, points: 0, timeUp: true });
        }
      }
    });
  });

  // Player entra na sala
  socket.on('player:join', ({ pin, name }) => {
    const room = rooms[pin];
    if (!room) {
      socket.emit('player:error', 'Sala não encontrada');
      return;
    }

    const sessionId = generateSessionId();
    let score = 0;

    // Check if there is an existing disconnected player with this name to reclaim
    const existingId = Object.keys(room.players).find(id =>
      room.players[id].name === name && !room.players[id].connected
    );

    if (existingId) {
      score = room.players[existingId].score;
      // Remove the old disconnected entry so we don't have duplicates
      delete room.players[existingId];
    } else if (room.savedScores && room.savedScores[name]) {
      // Fallback to savedScores if for some reason not in players list (e.g. legacy logic)
      score = room.savedScores[name];
    }

    room.players[sessionId] = { name, score, connected: true };
    sessions[sessionId] = { pin, name, socketId: socket.id };

    socket.join(pin);
    socket.pin = pin;
    socket.sessionId = sessionId;
    socket.emit('player:joined', { name, sessionId });
    io.to(room.hostId).emit('host:playersUpdate', {
      players: Object.values(room.players).map(p => ({
        name: p.name,
        score: p.score,
        connected: p.connected
      }))
    });

    // Notify all players of updated player count if a question is active
    if (room.currentQuestion >= 0 && !room.answers[sessionId]) { // If not answered (new join logic usually)
      const answerCount = Object.keys(room.answers).length;
      const playerCount = Object.keys(room.players).length;
      io.to(pin).emit('game:answerCount', {
        count: answerCount,
        total: playerCount
      });
    }

    // Determine restore state
    const isRestored = (room.currentQuestion >= -1 && !room.timer && !room.rankingTimer && room.questionStartTime === null);

    if (isRestored) {
      // Send restored state to new player
      socket.emit('player:reconnected', { // Reuse reconnect logic for simplicity or create new event
        name,
        score,
        gameStarted: true,
        currentQuestion: room.currentQuestion,
        hasAnswered: false,
        isRestored: true
      });
    } else if (room.currentQuestion >= 0 && room.currentQuestion < QUIZ.length) {
      if (room.timer) {
        // Quiz já iniciou e está ativo, enviar pergunta atual com tempo ajustado
      const q = QUIZ[room.currentQuestion];
        const elapsed = (Date.now() - room.questionStartTime) / 1000;
        const remaining = Math.max(0, TIME_LIMIT - elapsed);

      socket.emit('game:question', {
        index: room.currentQuestion,
        total: QUIZ.length,
        question: q.question,
        options: q.options,
          timeLimit: remaining
        });
      } else {
        // Pergunta acabou (fase de Ranking)
        const ranking = Object.entries(room.players)
          .map(([id, p]) => ({ name: p.name, score: p.score, connected: p.connected }))
          .sort((a, b) => b.score - a.score);

        if (room.currentQuestion >= QUIZ.length - 1) {
          socket.emit('game:final', { ranking });
        } else {
          socket.emit('game:ranking', { ranking });
        }
      }
    }
  });

  // Player solicita lista de perfis desconectados para reconexão
  socket.on('player:getDisconnectedProfiles', ({ pin }) => {
    const room = rooms[pin];
    if (!room) {
      socket.emit('player:error', 'Sala não encontrada');
      return;
    }

    const profiles = Object.values(room.players)
      .filter(p => !p.connected)
      .map(p => ({ name: p.name, score: p.score }));

    socket.emit('player:disconnectedProfiles', profiles);
  });

  // Player reconecta
  socket.on('player:reconnect', ({ sessionId }) => {
    const session = sessions[sessionId];
    if (!session) {
      socket.emit('player:error', 'Sessão expirada');
      return;
    }

    const room = rooms[session.pin];
    if (!room || !room.players[sessionId]) {
      socket.emit('player:error', 'Sala não existe mais');
      return;
    }

    session.socketId = socket.id;
    room.players[sessionId].connected = true;
    socket.join(session.pin);
    socket.pin = session.pin;
    socket.sessionId = sessionId;

    // Notify host of reconnection
    io.to(room.hostId).emit('host:playersUpdate', {
      players: Object.values(room.players).map(p => ({
        name: p.name,
        score: p.score,
        connected: p.connected
      }))
    });

    const player = room.players[sessionId];

    // Determine restore state
    const isRestored = (room.currentQuestion >= -1 && !room.timer && !room.rankingTimer && room.questionStartTime === null);

    socket.emit('player:reconnected', {
      name: player.name,
      score: player.score,
      gameStarted: room.currentQuestion >= 0,
      currentQuestion: room.currentQuestion,
      hasAnswered: !!room.answers[sessionId],
      isRestored // Notify player if we are in restored/paused state
    });

    // If active question (timer running) and not answered, send question
    if (room.currentQuestion >= 0 && !room.answers[sessionId]) {
      if (room.timer) {
      const q = QUIZ[room.currentQuestion];
        const elapsed = (Date.now() - room.questionStartTime) / 1000;
        const remaining = Math.max(0, TIME_LIMIT - elapsed);

      socket.emit('game:question', {
        index: room.currentQuestion,
        total: QUIZ.length,
        question: q.question,
        options: q.options,
          timeLimit: remaining
        });
      } else if (!isRestored) {
        // If not restored (meaning we are in live ranking phase), show ranking/feedback
        // Check if player has answered to show feedback? 
        // Logic for reconnecting player who hasn't answered but question ended:
        // They missed the question. Show ranking.
        const ranking = Object.entries(room.players)
          .map(([id, p]) => ({ name: p.name, score: p.score, connected: p.connected }))
          .sort((a, b) => b.score - a.score);

        if (room.currentQuestion >= QUIZ.length - 1) {
          socket.emit('game:final', { ranking });
        } else {
          socket.emit('game:ranking', { ranking });
        }
      }
    }
  });

  // Host inicia quiz
  socket.on('host:start', ({ pin }) => {
    const room = rooms[pin];
    if (!room) return;

    // If we are restoring (currentQuestion >= -1), verify logic
    // loadScores sets it to data.currentQuestion - 1.
    // If saved was 1 (Q1 done, waiting for Q2). restored = 0.
    // We want to start next question.
    // host:start is usually button "Iniciar Quiz".
    // If room.currentQuestion is -1 (fresh), set to 0.
    // If room.currentQuestion >= 0 (restored), increment to start next.

    if (room.currentQuestion < 0) {
      room.currentQuestion = 0;
    } else {
      room.currentQuestion++;
    }

    startQuestion(room, pin);
  });

  // Player responde
  socket.on('player:answer', ({ pin, answer }) => {
    const room = rooms[pin];
    const sessionId = socket.sessionId;
    if (!room || !sessionId || room.answers[sessionId]) return;

    const q = QUIZ[room.currentQuestion];
    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    const timeRemaining = Math.max(0, TIME_LIMIT - elapsed);

    // Allow a small grace period (e.g. 2s) for network latency
    if (elapsed > TIME_LIMIT + 2) {
      return;
    }

    const correct = answer === q.correct;

    let points = 0;
    if (correct) {
      points = calculateScore(timeRemaining);
      room.players[sessionId].score += points;
    }

    room.answers[sessionId] = { answer, correct, points };
    socket.emit('player:answered', {});

    const answerCount = Object.keys(room.answers).length;
    const playerCount = Object.keys(room.players).length;

    io.to(room.hostId).emit('host:answerCount', {
      count: answerCount,
      total: playerCount
    });

    // Also notify all players of the count for their corner display
    io.to(pin).emit('game:answerCount', {
      count: answerCount,
      total: playerCount
    });

    // Notify host who answered
    io.to(room.hostId).emit('host:playerAnswered', {
      playerName: room.players[sessionId].name
    });

    // Auto-avançar quando todos responderem
    if (answerCount >= playerCount) {
      setTimeout(() => {
        endQuestion(room, pin);
      }, 1000); // 1 second delay before reveal
    }
  });

  // Host avança para próxima pergunta ou ranking (manual end)
  socket.on('host:next', ({ pin }) => {
    const room = rooms[pin];
    if (!room) return;
    endQuestion(room, pin);
  });

  // Host envia próxima pergunta
  socket.on('host:nextQuestion', ({ pin }) => {
    const room = rooms[pin];
    if (!room) return;
    room.currentQuestion++;
    startQuestion(room, pin);
  });

  socket.on('disconnect', () => {
    if (socket.sessionId && socket.pin) {
      const room = rooms[socket.pin];
      if (room && room.players[socket.sessionId]) {
        room.players[socket.sessionId].connected = false;

        // Notify host of disconnection
        if (room.hostId) {
          io.to(room.hostId).emit('host:playersUpdate', {
            players: Object.values(room.players).map(p => ({
              name: p.name,
              score: p.score,
              connected: p.connected
            }))
          });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Host: http://localhost:${PORT}/host.html`);
  console.log(`Player: http://localhost:${PORT}/player.html`);
});
