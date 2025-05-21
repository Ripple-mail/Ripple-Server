import * as fs from 'fs';
import * as path from 'path';

const MAILBOX_DIR = path.join(__dirname, 'messages');

export async function saveEmail(recipient: string, data: string) {
  const localPart = recipient.split('@')[0];
  const userDir = path.join(MAILBOX_DIR, localPart);

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const fileName = `email-${Date.now()}.eml`;
  const filePath = path.join(userDir, fileName);

  fs.writeFileSync(filePath, data, 'utf-8');
  console.log(`Saved email to ${filePath}`);
}