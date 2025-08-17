import express, { Express} from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
dotenv.config();

const PORT = process.env.PORT || 3001;

const app: Express = express();
app.use(cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());
app.use(helmet());
app.use(cookieParser());

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

const server = app.listen(PORT, () => {
    console.log(`[EXPRESS] Server is running at http://localhost:${PORT}. Better go catch it`);
});