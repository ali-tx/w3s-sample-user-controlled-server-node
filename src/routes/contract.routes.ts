import express from 'express';
import contractController from '../controllers/contract.controller';

const router = express.Router();

router.post('/deploy', (req, res, next) => {
  contractController.compileAndDeploy(req, res, next);
});

export default router;
