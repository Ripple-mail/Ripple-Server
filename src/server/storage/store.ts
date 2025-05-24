import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { MAILDOMAINPREFIX } from '../../config/config';

const MAILBOX_DIR = path.join(__dirname, 'maildir');
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

async function ensureMaildirStructure(userDir: string) {
	for (const sub of ['tmp', 'new', 'cur']) {
		const dir = path.join(userDir, sub);
		if (!fs.existsSync(dir)) {
			await mkdir(dir, { recursive: true });
		}
	}
}

function generateMailFilename(): string {
	const timestamp = Date.now();
	const random = crypto.randomBytes(6).toString('hex');
	const pid = process.pid;
	const hostname = require('os').hostname();
	return `${timestamp}.${pid}.${hostname}.${random}`;
}

export async function saveEmail(recipient: string, data: string) {
	const localPart = recipient.split(MAILDOMAINPREFIX)[0];
	const userDir = path.join(MAILBOX_DIR, localPart);

	await ensureMaildirStructure(userDir);

	const fileName = generateMailFilename();
	const tmpPath = path.join(userDir, 'tmp', fileName);
	const newPath = path.join(userDir, 'new', fileName);

	await writeFile(tmpPath, data, 'utf-8');

	fs.renameSync(tmpPath, newPath);

	console.log(`Saved email to ${newPath}`);
}
