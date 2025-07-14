import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fp from 'fs/promises';
import client from 'prom-client';

client.collectDefaultMetrics();

// Backend
export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status']
});

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10]
});

export const folderSizeGauge = new client.Gauge({
    name: 'folder_size_bytes',
    help: 'Size of a folder',
    labelNames: ['folder']
});

export const backendUpSince = new client.Gauge({
    name: 'api_up_since',
    help: 'Timestamp of when the Backend-Api server last became online'
});

// Email stuff that can't go in SMTP
export const emailsRead = new client.Counter({
    name: 'emails_read',
    help: 'Number of emails read'
});

// Frontend
export const pageViews = new client.Counter({
    name: 'website_page_views_total',
    help: 'Total number of page views',
    labelNames: ['page', 'navigate', 'host']
});

export async function updateFolderMetric() {
    const size = await calculateFolderSize('src/server/storage/maildir');
    folderSizeGauge.set({ folder: 'maildir' }, size);
}

async function calculateFolderSize(folderPath: string): Promise<number> {
    let totalSize = 0;

    async function walk(dir: string) {
        const files = await fp.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                await walk(fullPath);
            } else if (file.isFile()) {
                const { size } = await fp.stat(fullPath);
                totalSize += size;
            }
        }
    }

    await walk(folderPath);
    return totalSize;
}

export function metricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
        res.on('finish', () => {
            const status = `${Math.floor(res.statusCode / 100)}xx`;
            httpRequestsTotal.inc({
                method: req.method,
                route: req.route ? req.route.path : req.path,
                status: status
            });
            end();
        });
        next();
    }
}

export function metricsEndpoint() {
    return async (req: Request, res: Response) => {
        res.set('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    }
}