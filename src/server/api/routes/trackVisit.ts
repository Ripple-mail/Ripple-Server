import express, { Router } from 'express';
import { pageViews } from '../metrics';

const router: Router = express.Router();

router.post('/', async (req, res) => {
    const { page, navigate, host } = req.body;
    pageViews.inc({ page, navigate, host });
    res.sendStatus(200);
});

export default router;