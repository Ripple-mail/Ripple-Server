import express, { Express} from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { xssSanitizer } from './middleware/xss';
import os from 'node:os';
dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

const app: Express = express();
app.use(cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());
app.use(helmet());
app.use(cookieParser());

//! IF YOU'RE NOT BEHIND A PROXY (LIKE CLOUDFLARE OR NGINX) REMOVE THIS LINE
app.set('trust proxy', true);
//!

app.use(xssSanitizer);

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
                console.log(`[Express] Loaded route: /api/${routePath}`);
            } else {
                console.warn(`[Express] No default export in ${relativePath}`);
            }
        }
    }
}

loadRoutes(apiDir);

const server = app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIp();
    console.log(`[Express] Server is running at:`);
    console.log(`    Local:   http://localhost:${PORT}`);
    console.log(`    Network: http://${ip}:${PORT}`);
    console.log('Blimey there\'s two now? You catch the one running locally I\'ll catch the network one!');
});

function getLocalIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        const netInfos = nets[name];
        if (!netInfos) continue;
        for (const net of netInfos) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}