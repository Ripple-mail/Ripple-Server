import fs from 'fs/promises';
import path from 'path';

const mailDir = 'src/server/storage/maildir';

export async function readMailDir(user: string) {
    const userDir = path.join(mailDir, user);
    const newDir = path.join(userDir, 'new');
    const curDir = path.join(userDir, 'cur');

    async function readEmailsFromDir(dirPath: string, unread: boolean) {
        try {
            const files = await fs.readdir(dirPath);
            return await Promise.all(files.map(async (file) => ({
                filename: file,
                path: path.join(dirPath, file),
                content: await fs.readFile(path.join(dirPath, file), 'utf-8'),
                unread
            })));
        } catch (error) {
            if ((error as any).code === 'ENOENT') return [];
            throw error;
        }
    }

    const newEmails = await readEmailsFromDir(newDir, true);
    const readEmails = await readEmailsFromDir(curDir, false);

    return [...newEmails, ...readEmails];
}

export async function readEmail(user: string, timestamp: string) {
    const userDir = path.join(mailDir, user);
    const newDir = path.join(userDir, 'new');
    const curDir = path.join(userDir, 'cur');

    async function findFileInDir(dirPath: string) {
        try {
            const files = await fs.readdir(dirPath);
            const file = files.find((f) => f.startsWith(`${timestamp}`));
            return file ? path.join(dirPath, file) : null;
        } catch (error) {
            if ((error as any).code === 'ENOENT') return null;
            throw error;
        }
    }

    let filePath = await findFileInDir(newDir);
    let unread = false;

    if (filePath) {
        unread = true;

        const filename = path.basename(filePath);
        const destPath = path.join(curDir, filename);

        await fs.mkdir(curDir, { recursive: true });
        await fs.rename(filePath, destPath);
        filePath = destPath;
    } else {
        filePath = await findFileInDir(curDir);
    }

    if (!filePath) return null;

    const content = await fs.readFile(filePath, 'utf-8');
    return {
        filename: path.basename(filePath),
        filePath,
        content,
        unread
    }
}