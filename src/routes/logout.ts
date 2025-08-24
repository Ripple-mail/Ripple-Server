import express, { Router } from 'express';

const router: Router = express.Router();

router.post('/', (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.json({ status: 'success', message: 'Logged out' });
});

export default router;