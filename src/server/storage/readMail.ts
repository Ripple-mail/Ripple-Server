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
                content: (getAttachments(await fs.readFile(path.join(dirPath, file), 'utf-8')))[0],
                unread,
                attachments: (getAttachments(await fs.readFile(path.join(dirPath, file), 'utf-8')))[1]
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

export async function readEmail(user: string, timestamp: string, onlyMark: boolean = false) {
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

    if (!onlyMark) {
        const [content, attachments] = getAttachments(await fs.readFile(filePath, 'utf-8'));

        return {
            filename: path.basename(filePath),
            filePath,
            content,
            unread,
            attachments
        }
    } else {
        return {
            filename: path.basename(filePath),
            filePath
        }
    }
}

function getAttachments(content: string) {
    const lines = content.split('\n');
    let attachments: string[] = [];
    const attachIndex = lines.findIndex(line => line.startsWith('Attachments:'));
    if (attachIndex !== -1) {
        const line = lines[attachIndex];
        const match = line.match(/\[([^\]]+)\]/);
        if (match) {
            attachments = match[1].split(',').map(path => path.trim());
        }

        lines.splice(attachIndex, 1);
    }

    content = lines.join('\n');

    return [content, attachments];
}