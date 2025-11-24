const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mysql = require('mysql2/promise'); // Importante usar a versão promise

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- CONFIGURAÇÃO DO BANCO DE DADOS (PREENCHA AQUI) ---
const dbConfig = {
    host: 'localhost', // Ex: 192.168.0.1 ou mysql.hostinger.com.br
    user: 'ayuvsyst_brasilverse',
    password: 'Camille123123123@',
    database: 'ayuvsyst_brasilverse' // Ex: brasilverse
};

let db;

// Conecta ao Banco
async function connectDB() {
    try {
        db = await mysql.createPool(dbConfig);
        console.log("✅ Conectado ao MySQL com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao conectar no MySQL:", err.message);
    }
}
connectDB();

let playersOnline = {}; // Memória rápida para movimento

io.on('connection', (socket) => {
    console.log('Conexão:', socket.id);

    // 1. JOGADOR ENTROU (CARREGAR DADOS DO BANCO)
    socket.on('joinGame', async (data) => {
        const nick = data.nick;
        
        try {
            // Verifica se já existe
            const [rows] = await db.execute('SELECT * FROM players WHERE nickname = ?', [nick]);
            
            let playerData;

            if (rows.length > 0) {
                // JOGADOR VETERANO: Carrega dados
                playerData = rows[0];
                console.log(`Jogador carregado: ${nick} (R$ ${playerData.money})`);
            } else {
                // NOVO JOGADOR: Cria no banco
                console.log(`Criando novo jogador: ${nick}`);
                await db.execute(
                    'INSERT INTO players (nickname, skin, money, x, y, z) VALUES (?, ?, ?, ?, ?, ?)',
                    [nick, data.skin, 500, 10.0, 0.5, 10.0]
                );
                playerData = { nickname: nick, skin: data.skin, money: 500, x: 10, y: 0.5, z: 10 };
            }

            // Salva na memória RAM do servidor para movimento rápido
            playersOnline[socket.id] = {
                id: socket.id,
                nick: playerData.nickname,
                skin: playerData.skin,
                x: playerData.x,
                y: playerData.y,
                z: playerData.z,
                yaw: 0
            };

            // Manda os dados salvos de volta para o jogador (para ele setar a posição e dinheiro)
            socket.emit('loadData', playerData);

            // Avisa todos
            io.emit('updatePlayers', playersOnline);
            io.emit('chatMsg', { nick: "Sistema", msg: `${nick} entrou na cidade.` });

        } catch (err) {
            console.error("Erro no banco:", err);
        }
    });

    // 2. MOVIMENTAÇÃO (Rápido, fica na memória)
    socket.on('playerMove', (data) => {
        if (playersOnline[socket.id]) {
            playersOnline[socket.id].x = data.x;
            playersOnline[socket.id].y = data.y;
            playersOnline[socket.id].z = data.z;
            playersOnline[socket.id].yaw = data.yaw;
            playersOnline[socket.id].moving = data.moving;
            // Envia para os outros
            socket.broadcast.emit('updatePlayers', playersOnline);
        }
    });

    // 3. SALVAR DADOS (A cada X segundos ou ao sair)
    socket.on('saveData', async (data) => {
        // O cliente envia { money, x, y, z }
        if(!playersOnline[socket.id]) return;
        const nick = playersOnline[socket.id].nick;

        try {
            await db.execute(
                'UPDATE players SET money = ?, x = ?, y = ?, z = ? WHERE nickname = ?',
                [data.money, data.x, data.y, data.z, nick]
            );
            console.log(`Dados salvos para ${nick}`);
        } catch (err) {
            console.error("Erro ao salvar:", err);
        }
    });

    // Chat
    socket.on('chatMsg', (data) => {
        io.emit('chatMsg', { id: socket.id, nick: data.nick, msg: data.msg });
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (playersOnline[socket.id]) {
            console.log('Saiu:', playersOnline[socket.id].nick);
            delete playersOnline[socket.id];
            io.emit('updatePlayers', playersOnline);
        }
    });
});

server.listen(3000, () => {
    console.log('🚀 Servidor BrasilVerse rodando na porta 3000');
});
