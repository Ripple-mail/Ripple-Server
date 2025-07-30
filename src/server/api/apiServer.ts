import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { metricsMiddleware, metricsEndpoint, updateFolderMetric, backendUpSince } from './metrics';
import { setupWebSocket } from './socket/websocket';
import { API_PORT } from '../../config/config';

dotenv.config();
const allowedOrigins = ['http://localhost:5173'];

export async function startApiServer() {
    backendUpSince.setToCurrentTime();

    const app = express();
    app.use(cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }));
    app.use(express.json());

    app.use(metricsMiddleware());

    //* Load api routes dynamically
    const apiDir = path.join(__dirname, 'routes');
    function loadRoutes(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                loadRoutes(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                const relativePath = path.relative(apiDir, fullPath);
                const routePath = relativePath.replace(/\.ts/, '').replace(/\\/g, '/');

                const routeModule = require(fullPath);
                const router = routeModule.default;

                if (router) {
                    app.use(`/api/${routePath}`, router);
                    console.log(`[Express] Loading route: /api/${routePath}`);
                } else {
                    console.warn(`[Express] No default export in ${relativePath}`);
                }
            }
        }
    }

    loadRoutes(apiDir);

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

    server.listen(API_PORT, () => {
        console.log(`Server running at http://localhost:${API_PORT}`);
        console.log(`Metrics running on http://localhost:${API_PORT}/metrics`);
    });

    setInterval(updateFolderMetric, 10_000);
    await updateFolderMetric();
}