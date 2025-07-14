import dotenv from 'dotenv';
dotenv.config();

import { startSMTPServer } from './server/smtp/smtpServer.ts';
import { startApiServer } from './server/api/apiServer.ts';

async function main() {
	await startSMTPServer();
	await startApiServer();
}

main();
