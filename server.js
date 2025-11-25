const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Aceita conexão de qualquer lugar
        methods: ["GET", "POST"]
    }
});

// Memória do Servidor (Substitui o Banco de Dados por enquanto)
let players = {}; 

io.on('connection', (socket) => {
    console.log('Nova conexão:', socket.id);

    // 1. JOGADOR ENTROU
    socket.on('joinGame', (data) => {
        console.log(`${data.nick} entrou no jogo.`);

        // Cria dados do jogador na memória
        players[socket.id] = {
            id: socket.id,
            nick: data.nick || "Visitante",
            skin: data.skin || "personagem1.glb",
            x: 10, 
            y: 0.5, 
            z: 10,
            yaw: 0,
            money: 500 // Dinheiro inicial padrão
        };

        // Manda dados iniciais para o jogador (Load Fake)
        socket.emit('loadData', {
            money: players[socket.id].money,
            x: 10, y: 0.5, z: 10 // Spawn Padrão
        });

        // Avisa todo mundo que chegou gente nova
        io.emit('updatePlayers', players);
        io.emit('chatMsg', { nick: "Sistema", msg: `${players[socket.id].nick} entrou na cidade.` });
    });

    // 2. MOVIMENTAÇÃO (Sincronia)
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            const p = players[socket.id];
            p.x = data.x;
            p.y = data.y;
            p.z = data.z;
            p.yaw = data.yaw;
            p.moving = data.moving; // Se está andando
            p.skin = data.skin;     // Garante que a skin está atualizada
            
            // Reenvia para todos (exceto quem mandou, pra economizar dados)
            socket.broadcast.emit('updatePlayers', players);
        }
    });

    // 3. CHAT
    socket.on('chatMsg', (data) => {
        // Reenvia a mensagem para todos
        io.emit('chatMsg', { 
            id: socket.id, 
            nick: data.nick, 
            msg: data.msg 
        });
    });

    // 4. COMBATE (Dano PvP)
    socket.on('damage', (data) => {
        // data = { targetId, amount, shooter }
        io.emit('takeDamage', data);
    });

    // 5. SALVAR (Fake Save - Apenas loga no console)
    socket.on('saveData', (data) => {
        if(players[socket.id]) {
            players[socket.id].money = data.money;
            // Aqui você conectaria no banco no futuro
            // console.log("Dados recebidos de", players[socket.id].nick);
        }
    });

    // 6. DESCONEXÃO
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log('Saiu:', players[socket.id].nick);
            io.emit('chatMsg', { nick: "Sistema", msg: `${players[socket.id].nick} saiu da cidade.` });
            delete players[socket.id];
            io.emit('updatePlayers', players); // Atualiza lista pra remover o boneco
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor Multiplayer Rodando na porta ${PORT}`);
});
