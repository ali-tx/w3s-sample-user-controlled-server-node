import express from 'express';
import { ContractController } from '../controllers/contract.controller';

const contractController = new ContractController();
const contract = express.Router();

// Health check
contract.get('/health', (req, res) => contractController.healthCheck(req, res));

// Get available contract templates
contract.get('/templates', (req, res) =>
  contractController.getTemplates(req, res)
);

// Get available networks
contract.get('/networks', (req, res) =>
  contractController.getNetworks(req, res)
);

// Get all deployed contracts
contract.get('/contracts', (req, res) =>
  contractController.getContracts(req, res)
);

// Refresh contracts from Circle API
contract.post('/contracts/refresh', (req, res) =>
  contractController.refreshContracts(req, res)
);

// Compile and deploy contract
contract.post('/deploy', (req, res) =>
  contractController.compileAndDeploy(req, res)
);

export default contract;
