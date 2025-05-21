import * as net from 'net';
import { SMTPSession } from './session.ts';
import { handleCommand } from './commands.ts';
import { PORT } from '../../config/config.ts';

const server = net.createServer((socket) => {
    const session = new SMTPSession(socket);
    let buffer = '';

    socket.setEncoding('utf-8');
    socket.write('220 Ripple mail');

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
        console.log('Connected closed');
    });
});

server.listen(PORT, () => {
    console.log(`SMTP server listening on port ${PORT}`);
});