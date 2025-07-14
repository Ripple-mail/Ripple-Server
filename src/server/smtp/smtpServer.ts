import * as net from 'net';
import { SMTPSession } from './session.ts';
import { handleCommand } from './commands.ts';
import { PORT } from '../../config/config.ts';
import { smtpConnectionsTotal, smtpActiveConnections, smtpErrorsTotal, smtpUpSince, smtpCommandsTotal } from './metrics/metrics.ts';

export async function startSMTPServer() {
    // startSMTPMetricServer();
    smtpUpSince.setToCurrentTime();

	const server = net.createServer((socket) => {
        smtpConnectionsTotal.inc();
        smtpActiveConnections.inc();

		const session = new SMTPSession(socket);
		let buffer = '';

		socket.setEncoding('utf-8');
		socket.write('220 Ripple mail\r\n');

		socket.on('data', async (data) => {
			buffer += data;

			let lineEndIndex;
			while ((lineEndIndex = buffer.indexOf('\r\n')) !== -1) {
				const line = buffer.slice(0, lineEndIndex);
				buffer = buffer.slice(lineEndIndex + 2);

				if (line) {
					await handleCommand(session, line.trim());
				}
			}
		});

		socket.on('end', () => {
            smtpActiveConnections.dec();
			console.log(`Connected closed.\nADDR (Remote | Local): ${socket.remoteAddress} | ${socket.localAddress}\nPORT (Remote | Local): ${socket.remotePort} | ${socket.localPort}\nBytes (WRITE | READ): ${socket.bytesWritten} | ${socket.bytesRead}\nErrored? ${socket.errored}`);
		});

		socket.on('error', (error) => {
            smtpActiveConnections.dec();
            smtpConnectionsTotal.dec();
            if (error.stack === "ECONNRESET") {
                smtpErrorsTotal.inc();
			    console.error('Socket error:', error);
            }
		});
	});

	return new Promise<void>((resolve, reject) => {
		server.listen(PORT, () => {
			console.log(`SMTP server listening on port ${PORT}`);
			resolve();
		});

		server.on('error', (error) => {
			reject(error);
		});
	});
}
