const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permite conexões de qualquer site
        methods: ["GET", "POST"]
    }
});

let players = {}; // Guarda a posição de todo mundo

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    // 1. Jogador entrou
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            nick: data.nick || "Desconhecido",
            x: 10, y: 0.5, z: 10, // Spawn padrão
            yaw: 0
        };
        // Envia a lista atualizada para TODO MUNDO
        io.emit('updatePlayers', players);
    });

    // 2. Jogador andou
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].yaw = data.yaw;
        }
        // Envia atualização para todos (menos para quem enviou, pra economizar rede)
        socket.broadcast.emit('updatePlayers', players);
    });

    // 3. Chat
    socket.on('chatMsg', (data) => {
        console.log("Chat recebido:", data.msg);
        // Reenvia para TODO MUNDO (inclusive quem mandou)
        io.emit('chatMsg', { 
            id: socket.id,
            nick: data.nick, 
            msg: data.msg 
        });
    });

    // 4. Desconectou
    socket.on('disconnect', () => {
        console.log('Jogador saiu:', socket.id);
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

server.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
