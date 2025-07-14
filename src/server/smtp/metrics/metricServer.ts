//! This file is only for prometheus instance pinging for SMTP server uptime, and for separation
import http from 'http';
import client from 'prom-client';

export async function startSMTPMetricServer() {
    const server = http.createServer(async (req, res) => {
        if (req.url === '/metrics') {
            res.writeHead(200, { 'Content-Type': client.register.contentType });
            res.end(await client.register.metrics());
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(3002, () => {
        console.log('SMTP Metrics server (for uptime only) running at http://localhost:3002/metrics');
    });
}
