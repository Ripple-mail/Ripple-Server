process.env.TZ = 'UTC';

import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { xssSanitizer } from './middleware/xss';
import os from 'node:os';
import { auditMiddleware } from './middleware/audit';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';
dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

const app: Express = express();

app.locals.appName = 'Ripple Mail';

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://api.ripplemail.de'
    ],
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
    credentials: true
}));
app.use(express.json({
    limit: '1mb'
}));
app.use(express.urlencoded({
    extended: true,
    limit: '1mb'
}));
app.use('/files', express.static('storage', { // For serving static files
    maxAge: '1y',
    immutable: true,
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
}));
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') {
    if (process.env.TRUST_PROXY === 'true') {
        app.set('trust proxy', true);
    }
}

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        },
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false
}));
app.use(cookieParser());
// app.use(csrf({ cookie: true })); // Enable when using session-based
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
}));
app.use(xssSanitizer);
app.use(auditMiddleware);

//* Load api routes dynamically
const apiDir = path.join(__dirname, 'routes');
function loadRoutes(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            loadRoutes(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.startsWith('_')) {
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
    console.log(`\x1b[1m\x1b[34m[Express]\x1b[0m Server is running at:`);
    console.log(`    Local:   \x1b[32m\x1b[4mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`    Network: \x1b[32m\x1b[4mhttp://${ip}:${PORT}\x1b[0m`);
    console.log('\x1b[33mBlimey there\'s two now? You catch the one running locally I\'ll catch the network one!\x1b[0m');
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