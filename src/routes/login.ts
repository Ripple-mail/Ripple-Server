import express, { Router } from 'express';
import bcrypt from 'bcrypt';
import { signJwt } from '../utils/jwt';

const router: Router = express.Router();

const users = [{ id: 1, username: 'Ripple', passwordHash: bcrypt.hashSync('password', 10) }];

router.post('/', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(400).json({ status: 'error', error: 'User not found' });

    const valid = bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ status: 'error', error: 'Invalid credentials' });

    const token = signJwt({ id: user.id, name: user.username, email: 'test~ripple.com' });
    res.json({ token });
});

export default router;