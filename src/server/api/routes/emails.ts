import express, { Router } from 'express';
import { SMTPClient } from '../../client/smtpClient';

const router: Router = express.Router();

router.get('/:userId', async (req, res) => {

});

router.post('/send', async (req, res) => {
    const { from, to, subject, body } = req.body;
    const client = new SMTPClient();
    try {
        await client.connect();
        await client.sendMail(
            `${from}`,
            `${to}`,
            `Subject: ${subject}\r\n
            ${body}`,
        );
        res.status(200).send({ status: 'success', response: 'Email sent successfully' });
        return;
    } catch (error) {
        res.status(500).send({ status: 'success', error });
        return;
    }
});

export default router;