import express from 'express';
import { getContractsByUser } from '../controllers/contracts';

const router = express.Router();

// GET /contracts/:userId
router.get('/:userId', getContractsByUser);

export { router as contractsRouter };
