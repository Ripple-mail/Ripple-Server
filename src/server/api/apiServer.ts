import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { metricsMiddleware, metricsEndpoint, updateFolderMetric, backendUpSince } from './metrics';
import { setupWebSocket } from './socket/websocket';

dotenv.config();

export async function startApiServer() {
    backendUpSince.setToCurrentTime();

    const app = express();
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
    }));
    app.use(express.json());

    app.use(metricsMiddleware());

    //* Load api routes dynamically
    const apiDir = path.join(__dirname, 'routes');
    fs.readdirSync(apiDir).forEach(file => {
        if (file.endsWith('.ts')) {
            const routeName = '/' + file.replace(/\.ts$/, '');
            const routeModule = require(path.join(apiDir, file));
            const router = routeModule.default;

            if (router) {
                app.use(`/api${routeName}`, router);
                console.log(`[Express] Loaded route: /api${routeName}`);
            } else {
                console.warn(`[Express] No default export in ${file}`);
            }
        }
    });

    // Test
    app.get('/api/test', (req, res) => {
        res.send('Hello from /api/test');
    });

    // Metrics endpoint
    app.get('/metrics', metricsEndpoint());

    // cdn
    app.use('/cdn', express.static(path.join(__dirname, './files')));

    const server = http.createServer(app);
    setupWebSocket(server);

    const PORT = 3001;
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Metrics running on http://localhost:${PORT}/metrics`);
    });

    setInterval(updateFolderMetric, 10_000);
    await updateFolderMetric();
}