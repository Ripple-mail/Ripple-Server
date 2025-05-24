import { SMTPSession } from './session.ts';
import { saveEmail } from '../storage/store.ts';
import { MAILDOMAINPREFIX } from '../../config/config.ts';

export async function handleCommand(session: SMTPSession, line: string) {
	const [command, ...args] = line.split(' ');
	const upperCommand = command.toUpperCase();

	const sendResponse = (msg: string) => session.socket.write(msg);

	function exactAddress(argLine: string): string | null {
		const match = argLine.match(/<([^>]*)>/);
		if (!match) return null;

		const email = match[1].trim();

		const escapedSeparator = MAILDOMAINPREFIX.replace(/[-\/\\^$*+?>()|[\]{}]/g, '\\$&');
		const regexString = `^[^\\s${escapedSeparator}]+${escapedSeparator}[^\\s${escapedSeparator}]+\\.[^\\s${escapedSeparator}]+$`;
		const emailRegex = new RegExp(regexString);

		if (emailRegex.test(email)) {
			return email;
		} else {
			return null;
		}
	}

    function toInitialState() {
        session.collectingData = false;
		session.dataLines = [];
		session.mailFrom = '';
		session.rcptTo = '';
		session.hello = '';
    }

	try {
		switch (upperCommand) {
			case 'HELO':
			case 'EHLO':
				if (args.length === 0) {
					sendResponse('501 Syntax: HELO/EHLO hostname\r\n');
					break;
				}
				session.hello = args[0];
				sendResponse(`250 Hello ${session.hello}\r\n`);
				break;
			case 'MAIL':
				if (!line.match(/^MAIL FROM:/i)) {
					sendResponse('501 Syntax error in parameters or arguments\r\n');
					break;
				}
				if (!session.hello) {
					sendResponse('503 Send HELO/EHLO first\r\n');
					break;
				}
				const mailFromAddress = exactAddress(line);
				if (!mailFromAddress) {
					sendResponse('510 Syntax error: Invalid email address\r\n');
					break;
				}
				session.mailFrom = mailFromAddress;
				sendResponse('250 OK\r\n');
				break;
			case 'RCPT':
				if (!line.match(/^RCPT TO:/i)) {
					sendResponse('501 Syntax error in parameters or arguments\r\n');
					break;
				}
				if (!session.mailFrom) {
					sendResponse('503 Need MAIL command first\r\n');
					break;
				}
				const rcptToAddress = exactAddress(line);
				if (!rcptToAddress) {
					sendResponse('510 Syntax error: Invalid email address\r\n');
					break;
				}
				session.rcptTo = rcptToAddress;
				sendResponse('250 OK\r\n');
				break;
			case 'DATA':
				if (!session.mailFrom || !session.rcptTo) {
					sendResponse('503 Need MAIL FROM and RCPT TO first\r\n');
					break;
				}
				sendResponse('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
				session.collectingData = true;
				session.dataLines = [];
				break;
			case 'NOOP':
				sendResponse('250 OK\r\n');
				break;
			case 'HELP':
				sendResponse('214 Commands supported: HELO EHLO MAIL RCPT DATA RSET NOOP QUIT\r\n');
				break;
			case 'VRFY':
			case 'EXPN':
            case 'AUTH':
				sendResponse('502 Command not implemented\r\n');
				break;
			case 'RSET':
				toInitialState();
				sendResponse('250 OK\r\n');
				break;
            case 'STARTTLS':
                toInitialState();
                sendResponse('220 Ripple mail\r\n');
                break;
			case 'QUIT':
				sendResponse('221 Bye\r\n');
				session.socket.end();
				break;
			default:
				if (session.collectingData) {
					if (line === '.') {
						session.collectingData = false;
						const message = `From: ${session.mailFrom}\nTo: ${session.rcptTo}\n${session.dataLines.join('\r\n')}`;

						try {
							await saveEmail(session.rcptTo, message);
							sendResponse('250 OK message accepted\r\n');

							session.mailFrom = '';
							session.rcptTo = '';
							session.dataLines = [];
						} catch (error) {
							console.error('Error saving email:', error);
							sendResponse('451 Request action aborted: local error in processing\r\n');
						}
					} else {
						session.dataLines.push(line);
					}
				} else {
					sendResponse('502 Command not implemented\r\n');
				}
				break;
		}
	} catch (error) {
		console.error('Unexpected error:', error);
		sendResponse('451 Requested action aborted: local error in processing\r\n');
	}
}
