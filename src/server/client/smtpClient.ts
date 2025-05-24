import dotenv from 'dotenv';
dotenv.config();

import * as net from 'net';
import { PORT, HOST } from '../../config/config';

export class SMTPClient {
	socket: net.Socket;
	buffer = '';
	responses: string[] = [];
	responseResolver: ((val: string) => void) | null = null;
	host: string = '';
	port: number;

	constructor(options?: { port?: number; host?: string }) {
		this.socket = new net.Socket();
		this.socket.setEncoding('utf-8');

		this.port = options?.port ? options.port : PORT;
		this.host = options?.host ? options.host : HOST;

		this.socket.on('data', (data) => {
			this.buffer += data;
			this.processBuffer();
		});
	}

	processBuffer() {
		let index: number;
		while ((index = this.buffer.indexOf('\r\n')) !== -1) {
			const line = this.buffer.slice(0, index);
			this.buffer = this.buffer.slice(index + 2);
			this.responses.push(line);
		}

		if (this.responseResolver && this.responses.length > 0) {
			const line = this.responses.shift()!;
			const resolver = this.responseResolver;
			this.responseResolver = null;
			resolver(line);
		}
	}

	async waitForResponse(): Promise<string> {
		return new Promise((resolve) => {
			if (this.responses.length > 0) {
				const line = this.responses.shift()!;
				console.log(line);
				resolve(line);
			} else {
				this.responseResolver = (line) => {
					console.log('Response:', line);
					resolve(line);
				};
			}
		});
	}

	async connect() {
		return new Promise<void>((resolve, reject) => {
			this.socket.connect(PORT, HOST, async () => {
				try {
					const greeting = await this.waitForResponse();
					if (!greeting.startsWith('220')) {
						return reject(new Error('Connection refused: ' + greeting));
					}
					resolve();
				} catch (error) {
					reject(error);
				}
			});

			this.socket.on('error', (error) => {
				reject(error);
			});
		});
	}

	async sendCommand(cmd: string): Promise<string> {
		this.socket.write(cmd + '\r\n');
		console.log(cmd + '\r\n');
		const res = await this.waitForResponse();
		return res;
	}

	async sendMail(sender: string, recipient: string, message: string) {
		//* Send EHLO
		let res = await this.sendCommand('EHLO localhost');
		if (!res.startsWith('250')) throw new Error('EHLO failed: ' + res);

		//* MAIL FROM
		res = await this.sendCommand(`MAIL FROM:<${sender}>`);
		if (!res.startsWith('250')) throw new Error('MAIL FROM failed: ' + res);

		//* RCPT TO
		res = await this.sendCommand(`RCPT TO:<${recipient}>`);
		if (!res.startsWith('250')) throw new Error('RCPT TO failed: ' + res);

		//* DATA
		res = await this.sendCommand('DATA');
		if (!res.startsWith('354')) throw new Error('DATA command failed: ' + res);

		//* Send message
		this.socket.write(message.replace(/\n/g, '\r\n') + '\r\n.\r\n');

		res = await this.waitForResponse();
		if (!res.startsWith('250')) throw new Error('Message not accepted: ' + res);

		//* QUIT
		res = await this.sendCommand('QUIT');
		if (!res.startsWith('221')) throw new Error('QUIT failed: ' + res);

		this.socket.end();
	}
}

//* Sample usage
async function run() {
	const client = new SMTPClient();
	try {
		await client.connect();
		await client.sendMail(
            'sender~example.com',
            'recipient@example.com',
            `Subject: Test from SMTP client\r\n
             From: sender~example.com\r\n
             To: recipient~example.com\r\n\r\n
             Hello from my SMTP client!\r\n`
        );
		console.log('Email sent successfully');
	} catch (error) {
		console.error('Error sending mail:', error);
	}
}

run();
