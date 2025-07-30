import express, { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { db } from '../../../../db/db';
import { attachments } from '../../../../db/schema';

const FILES_DIR = path.join(__dirname, '../files');
const TEMP_DIR = path.join(FILES_DIR, './temp');
fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

const router: Router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { uploadId, chunkIndex, totalChunks, fileType, fileName } = req.body;

        if (!uploadId || !req.file || chunkIndex === undefined || !totalChunks) {
            return res.status(400).json({ status: 'error', error: 'Missing required fields.' });
        }

        const chunkDir = path.join(TEMP_DIR, uploadId);
        const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
        fs.mkdirSync(chunkDir, { recursive: true });
        fs.writeFileSync(chunkPath, req.file.buffer);

        const receivedChunks = fs.readdirSync(chunkDir).length;

        if (receivedChunks === parseInt(totalChunks)) {
            const finalPath = path.join(FILES_DIR, `${uploadId}.${fileType}`);
            const writeStream = fs.createWriteStream(finalPath);

            for (let i = 0; i < totalChunks; i++) {
                const chunk = fs.readFileSync(path.join(chunkDir, `chunk-${i}`));
                writeStream.write(chunk);
                console.log(`Chunk ${chunkIndex} saved, size: ${req.file.buffer.length} bytes`);
            }

            writeStream.end();
            fs.rmSync(chunkDir, { recursive: true, force: true });

            try {
                const response = await db.insert(attachments).values({
                    fileHash: uploadId,
                    fileName,
                    fileType,
                    size: req.file.buffer.length
                });

                return res.json({
                    status: 'success',
                    message: 'Upload complete',
                    path: `/cdn/${uploadId}.${fileType}`
                });
            } catch (error) {
                res.status(500).send({ status: 'error', error });
            }
        }

        return res.json({ status: 'success', message: `Chunk ${chunkIndex} received.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', error: 'Server error during file upload.' });
    }
});

export default router;