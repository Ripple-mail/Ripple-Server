import * as net from 'net';
import { SMTPSession } from './session.ts';
import { handleCommand } from './commands.ts';
import { PORT } from '../../config/config.ts';

export async function startSMTPServer() {
	const server = net.createServer((socket) => {
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
			console.log(`Connected closed: ${socket}`);
		});

		socket.on('error', (error) => {
			console.error('Socket error:', error);
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
