import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '$db/db';
import { attachments, emails, mailboxes, recipients, userEmails, users } from '$db/schema';
import { and, eq } from 'drizzle-orm';

function generateMessageId(domain = 'example.com') {
    return `<${crypto.randomUUID()}@${domain}>`;
}

function createBoundary() {
    return `----=_Part_${crypto.randomBytes(16).toString('hex')}`;
}

async function constructRcptHeader(recipients: { userId?: string; email?: string; type: 'to' | 'cc' | 'bcc' }[], rtype: 'to' | 'cc') {
    const headerArray = await Promise.all(recipients.filter(r => r.type === rtype).map(async r => {
        if (r.email) return r.email;
        if (!r.userId) return null;

        const [user] = await db.select().from(users).where(eq(users.id, r.userId));
        return user?.email ?? null;
    }));

    return headerArray.filter(Boolean).join(', ');
}

export async function saveEmail(emailData: {
    sender: { id: string; email: string; }
    subject?: string;
    bodyText?: string;
    recipients: { userId?: string; email?: string; type: 'to' | 'cc' | 'bcc' }[];
    attachments?: { fileName: string; filePath: string; mimeType: string, sizeBytes?: number }[];
}) {
    const now = new Date()
    const messageId = generateMessageId();
    let headers = '';
    let body = '';

    if (process.env.USE_EMLS === 'true') {
        const boundary = createBoundary();
        const toHeader = await constructRcptHeader(emailData.recipients, 'to');
        const ccHeader = await constructRcptHeader(emailData.recipients, 'cc');

        headers += `From: ${emailData.sender.email}\r\n`;
        headers += `To: ${toHeader}\r\n`;
        if (ccHeader) headers += `Cc: ${ccHeader}\r\n`;
        headers += `Subject: ${emailData.subject || ''}\r\n`;
        headers += `Message-ID: ${messageId}\r\n`;
        headers += `Date: ${new Date().toUTCString()}\r\n`;
        headers += `MIME-Version: 1.0\r\n`;

        const hasAttachments = emailData.attachments && emailData.attachments.length > 0;
        if (hasAttachments) {
            headers += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
        } else {
            headers += `Content-Type: text/plain; charset="utf-8"\r\n\r\n`;
        }

        if (hasAttachments) {
            body += `--${boundary}\r\n`;
            body += `Content-Type: text/plain; charset="utf-8"\r\n\r\n`;
            body += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
            body += `${emailData.bodyText || ''}\r\n\r\n`;

            for (const att of emailData.attachments!) {
                body += `--${boundary}`;
                body += `Content-Type: ${att.mimeType}; name="${att.fileName}"\r\n`;
                body += `Content-Disposition: attachment; filename="${att.fileName}"\r\n\r\n`;
                body += `X-Local-File-Path: ${att.filePath}\r\n\r\n`;
            }

            body += `--${boundary}--\r\n`;
        } else {
            body += emailData.bodyText || '';
        }
    }

    const emlContent = headers + body;

    const result = await db.transaction(async (tx) => {
        const [insertedEmail] = await tx.insert(emails).values({
            senderId: emailData.sender.id,
            fromAddress: String(emailData.sender.email),
            messageId,
            subject: emailData.subject || '',
            date: now,
            emlPath: '',
            sizeBytes: Buffer.byteLength(emlContent, 'utf-8'),
            bodyText: emailData.bodyText || ''
        }).returning();

        let emlPath = '';

        try {
            if (process.env.USE_EMLS === 'true') {
                const messagesFolder = path.join(__dirname, '..', '..', 'storage', 'messages', emailData.sender.id);
                if (!fs.existsSync(messagesFolder)) fs.mkdirSync(messagesFolder, { recursive: true });
                emlPath = path.join(messagesFolder, `${insertedEmail.id}.eml`);
                fs.writeFileSync(emlPath, emlContent);

                await tx.update(emails).set({ emlPath }).where(eq(emails.id, insertedEmail.id));
            }

            const [sent] = await tx
                .select()
                .from(mailboxes)
                .where(
                    and(
                        eq(mailboxes.userId, emailData.sender.id),
                        eq(mailboxes.mailboxType, 'sent'),
                        eq(mailboxes.systemMailbox, true)
                    )
                );
            if (!sent) throw new Error('Users \'sent\' system mailbox cannot be found.');

            await tx.insert(userEmails).values({
                userId: emailData.sender.id,
                emailId: insertedEmail.id,
                mailboxId: sent.id,
                isSender: true,
                createdAt: now
            });

            for (const recipient of emailData.recipients) {
                let recipientUser = null;
                if (recipient.email) {
                    [recipientUser] = await tx.select().from(users).where(eq(users.email, recipient.email));
                }

                await tx.insert(recipients).values({
                    emailId: insertedEmail.id,
                    userId: recipientUser ? recipientUser.id : null,
                    address: recipient.email,
                    type: recipient.type
                });

                if (!recipientUser) continue;

                const [inbox] = await tx
                    .select()
                    .from(mailboxes)
                    .where(
                        and(
                            eq(mailboxes.userId, recipientUser.id),
                            eq(mailboxes.mailboxType, 'inbox'),
                            eq(mailboxes.systemMailbox, true)
                        )
                    )
                if (!inbox) continue;

                await tx.insert(userEmails).values({
                    userId: recipientUser.id,
                    emailId: insertedEmail.id,
                    mailboxId: inbox.id,
                    createdAt: now
                });
            }

            if (emailData.attachments) {
                for (const att of emailData.attachments) {
                    await tx.insert(attachments).values({
                        emailId: insertedEmail.id,
                        fileName: att.fileName,
                        mimeType: att.mimeType,
                        sizeBytes: att.sizeBytes || fs.statSync(att.filePath).size,
                        filePath: att.filePath,
                        createdAt: now
                    });
                }
            }

            return { ...insertedEmail, emlPath }
        } catch (err) {
            if (fs.existsSync(emlPath)) fs.unlinkSync(emlPath);
            throw err;
        }
    });

    return result;
}