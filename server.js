const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Libera acesso para seu CPanel
        methods: ["GET", "POST"]
    }
});

// Armazena os jogadores: { id_socket: { x, y, z, nick, rotation } }
let players = {};

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    // 1. Jogador entrou no jogo
    socket.on('joinGame', (data) => {
        // Cria o jogador na memória do servidor
        players[socket.id] = {
            id: socket.id,
            nick: data.nick,
            x: 0, y: 0, z: 0,
            rotation: 0,
            action: 'Idle' // Animação atual
        };

        // Avisa o novo jogador sobre quem já está online
        socket.emit('currentPlayers', players);

        // Avisa os outros que alguém novo entrou
        socket.broadcast.emit('newPlayer', players[socket.id]);
        
        // Mensagem no Chat Global
        io.emit('chatMessage', { nick: 'Sistema', text: `${data.nick} entrou na cidade.` });
    });

    // 2. Jogador se moveu
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            players[socket.id].action = movementData.action;

            // Envia a nova posição para TODOS os outros (menos pra quem moveu)
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 3. Chat
    socket.on('sendChat', (msg) => {
        io.emit('chatMessage', { nick: msg.nick, text: msg.text });
    });

    // 4. Desconexão
    socket.on('disconnect', () => {
        console.log('Saiu:', socket.id);
        if (players[socket.id]) {
            io.emit('chatMessage', { nick: 'Sistema', text: `${players[socket.id].nick} saiu.` });
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
