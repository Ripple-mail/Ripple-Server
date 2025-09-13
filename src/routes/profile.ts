import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router: Router = express.Router();

router.get('/', authMiddleware, (req, res) => {
    res.json({ status: 'success', message: 'Welcome!', user: req.user });
});

export default router;