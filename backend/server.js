const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // in sviluppo va bene così, poi si può restringere
  },
});

const PORT = 3000;

// ========== Game Data ==========
let rooms = {}; // { roomCode: { players: {}, round: 0, inProgress: false } }

function createRoom(roomCode) {
  rooms[roomCode] = {
    players: {}, // socket.id => { name, lives, currentChoice }
    round: 0,
    inProgress: false,
  };
}

// ========== Socket.io ==========
io.on("connection", (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  socket.on("create-room", ({ roomCode, name }) => {
    if (rooms[roomCode]) {
      socket.emit("error", "Room already exists.");
      return;
    }
    createRoom(roomCode);
    rooms[roomCode].players[socket.id] = {
      name,
      lives: 0,
      currentChoice: null,
    };
    socket.join(roomCode);
    socket.emit("room-created", roomCode);
    io.to(roomCode).emit("players-update", Object.values(rooms[roomCode].players));
  });

  socket.on("join-room", ({ roomCode, name }) => {
    if (!rooms[roomCode]) {
      socket.emit("error", "Room not found.");
      return;
    }
    if (Object.keys(rooms[roomCode].players).length >= 5) {
      socket.emit("error", "Room full.");
      return;
    }
    rooms[roomCode].players[socket.id] = {
      name,
      lives: 0,
      currentChoice: null,
    };
    socket.join(roomCode);
    io.to(roomCode).emit("players-update", Object.values(rooms[roomCode].players));
  });

  socket.on("start-game", (roomCode) => {
    if (!rooms[roomCode]) return;
    rooms[roomCode].inProgress = true;
    rooms[roomCode].round = 1;
    io.to(roomCode).emit("game-started", { round: 1 });
  });

  socket.on("submit-number", ({ roomCode, number }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.players[socket.id]) {
      room.players[socket.id].currentChoice = number;
    }

    const allSubmitted = Object.values(room.players).every(p => p.currentChoice !== null);
    if (allSubmitted) {
      const choices = Object.values(room.players).map(p => p.currentChoice);
      const avg = choices.reduce((a, b) => a + b, 0) / choices.length;
      const target = avg * 0.8;

      // Trova chi è più vicino
      let closestPlayerId = null;
      let closestDiff = Infinity;
      for (const [id, player] of Object.entries(room.players)) {
        const diff = Math.abs(player.currentChoice - target);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestPlayerId = id;
        }
      }

      // Gestione risultati
      for (const [id, player] of Object.entries(room.players)) {
        if (id !== closestPlayerId) {
          player.lives -= 1;
        }
        player.currentChoice = null; // Reset per prossimo round
      }

      const winner = room.players[closestPlayerId];

      // Rimuovi giocatori con vite < -10
      for (const id of Object.keys(room.players)) {
        if (room.players[id].lives < -10) {
          io.to(id).emit("eliminated");
          delete room.players[id];
        }
      }

      room.round += 1;
      io.to(roomCode).emit("round-result", {
        target,
        winner: winner.name,
        players: Object.values(room.players),
        round: room.round,
      });
    }
  });

  socket.on("disconnect", () => {
    for (const [roomCode, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(roomCode).emit("players-update", Object.values(room.players));
      }
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// ========== Server Listen ==========
server.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
