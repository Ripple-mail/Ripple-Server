import dotenv from 'dotenv';
dotenv.config();

import { startSMTPServer } from './server/smtp/smtpServer.ts';

async function main() {
	await startSMTPServer();
}

main();
