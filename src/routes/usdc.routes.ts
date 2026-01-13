import express from 'express';
import { compileAndDeploy } from '../controllers/contract.controller';

const router = express.Router();

router.get('/health', (_req, res) => res.send({ status: 'ok' }));

router.post('/deploy-splitter', compileAndDeploy);

export default router;
