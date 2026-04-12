const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Almacén temporal de sesiones (ID de conexión -> Socket ID)
const sessions = new Map();

io.on('connection', (socket) => {
    console.log('Nuevo dispositivo conectado:', socket.id);

    // Registro de un Host (el que comparte pantalla)
    socket.on('register-host', (hostId) => {
        sessions.set(hostId, socket.id);
        socket.join(hostId);
        console.log(`Host registrado con ID: ${hostId}`);
    });

    // Intento de conexión de un Viewer (el que controla)
    socket.on('join-session', (hostId) => {
        if (sessions.has(hostId)) {
            socket.join(hostId);
            socket.to(hostId).emit('viewer-connected', socket.id);
            console.log(`Viewer ${socket.id} se unió a la sesión ${hostId}`);
        } else {
            socket.emit('error-msg', 'ID de sesión no encontrado');
        }
    });

    // Reenvío de señalización WebRTC (Offer, Answer, ICE Candidates)
    socket.on('signal', (data) => {
        // data contiene: { to: socketId, signalData: ... }
        if (data.to) {
            io.to(data.to).emit('signal', {
                from: socket.id,
                signalData: data.signalData
            });
        }
    });

    // Intercambio de llaves criptográficas (E2EE)
    socket.on('key-exchange-offer', (data) => {
        socket.broadcast.emit('key-exchange-offer', data);
    });

    socket.on('key-exchange-answer', (data) => {
        socket.broadcast.emit('key-exchange-answer', data);
    });

    // Reenvío de datos de pantalla (Video Stream)
    socket.on('screen-data', (data) => {
        socket.broadcast.emit('screen-update', data.image);
    });

    // Reenvío de comandos de control (Mouse/Keyboard)
    socket.on('remote-command', (cmd) => {
        socket.broadcast.emit('remote-command', cmd);
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado:', socket.id);
        // Limpieza de sesiones (opcional: notificar al otro extremo)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de señalización corriendo en puerto ${PORT}`);
});
