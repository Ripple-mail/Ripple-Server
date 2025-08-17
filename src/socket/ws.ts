import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer;

export function setupWS(server: HTTPServer): SocketIOServer {
    io = new SocketIOServer(server, {
        path: '/ws',
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Websocket] New client connected: ${socket.id}`);

        socket.on('joinRoom', ({ room }) => {
            socket.join(room);
            console.log(`[Websocket] Socket ${socket.id} joined room ${room}`);
        });

        socket.on('disconnect', () => {
            console.log(`[Websocket] Client disconnected: ${socket.id}`);
        });
    });

    console.log('[Websocket] Socket.IO initialised');
    return io;
}

export function getIO(): SocketIOServer {
    if (!io) throw new Error('Socket.IO not initialised');
    return io;
}