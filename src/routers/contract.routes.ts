import express, { Router } from 'express';
import contractController from '../controllers/contract.controller';

const router: Router = express.Router();

// Health check
router.get('/health', contractController.healthCheck);

// Get available contract templates
router.get('/templates', contractController.getTemplates);

// Get available networks
router.get('/networks', contractController.getNetworks);

// Get all deployed contracts
router.get('/contracts', contractController.getContracts);

// Refresh contracts from Circle API
router.post('/contracts/refresh', contractController.refreshContracts);

// Compile and deploy contract
router.post('/deploy', contractController.compileAndDeploy);

export default router;
