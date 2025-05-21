import { SMTPSession } from './session.ts';
import { saveEmail } from '../storage/store.ts';

export async function handleCommand(session: SMTPSession, line: string) {
    const [command, ...args] = line.split(' ');
    const upperCommand = command.toUpperCase();

    switch (upperCommand) {
        case 'HELO':
        case 'EHLO':
            session.hello = args[0] || '';
            session.socket.write('250 Hello\r\n');
            break;
        case 'MAIL':
            if (!line.includes('FROM:')) return session.socket.write('501 Syntax error\r\n');
            session.mailFrom = exactAddress(line);
            session.socket.write('250 OK\r\n');
            break;
        case 'RCPT':
            if (!line.includes('TO:')) return session.socket.write('501 Syntax error\r\n');
            session.rcptTo = exactAddress(line);
            session.socket.write('250 OK\r\n');
            break;
        case 'DATA':
            session.socket.write('354 End data with <CR><LR>.<CR><LF>\r\n');
            session.collectingData = true;
            session.dataLines = [];
            break;
        case 'QUIT':
            session.socket.write('221 Bye\r\n');
            session.socket.end();
            break;
        default:
            if (session.collectingData) {
                if (line === '.') {
                    session.collectingData = false;
                    const message = session.dataLines.join('\r\n');
                    await saveEmail(session.rcptTo, message);
                    session.socket.write('250 OK message accepted\r\n');
                } else {
                    session.dataLines.push(line);
                }
            } else {
                session.socket.write('502 Command not implemented\r\n');
            }
            break;
    }
}

function exactAddress(line: string): string {
    const match = line.match(/<(.*)>/);
    return match ? match[1] : '';
}