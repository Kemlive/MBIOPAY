import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Sample route handler for authenticating Google users
router.post('/auth/google', async (req, res) => {
    const { id } = req.body; // Expecting only 'id' in request body
    if (!id) {
        return res.status(400).send('ID is required');
    }

    // Create payload only using 'id'
    const payload = { id }; 
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.json({ token });
});

export default router;