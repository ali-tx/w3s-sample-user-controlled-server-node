import { Request, Response } from 'express';
// @ts-expect-ignore
import * as contractService from '../services/contract.service';

class ContractController {
  async compileAndDeploy(req: Request, res: Response): Promise<void> {
    try {
      const { name, sourceCode, constructorArgs, network } = req.body;

      // Validate input
      if (!name || !sourceCode) {
        res.status(400).json({
          success: false,
          error: 'Contract name and source code are required'
        });
        return;
      }

      console.log(`🔄 Processing contract: ${name}`);

      const result = await contractService.compileAndDeploy({
        name,
        sourceCode,
        constructorArgs: constructorArgs || [],
        network: network || 'vm'
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Contract deployed successfully',
          data: result.deployment
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error('Controller error:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await contractService.getContractTemplates();
      res.status(200).json({
        success: true,
        templates
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getNetworks(req: Request, res: Response): Promise<void> {
    try {
      const networks = await contractService.getAvailableNetworks();
      res.status(200).json({
        success: true,
        networks
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getContracts(req: Request, res: Response): Promise<void> {
    try {
      const contracts = await contractService.getAllContracts();
      res.status(200).json({
        success: true,
        contracts
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async refreshContracts(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Manually refreshing contracts from Circle API...');
      const circleApiService = require('../services/circleApiService');
      const contractAddresses = await (
        circleApiService as any
      ).listAllContracts();
      const contracts = await contractService.getAllContracts();

      res.status(200).json({
        success: true,
        message: `Found ${contractAddresses.length} contracts from Circle Dashboard`,
        contractCount: contractAddresses.length,
        contractAddresses: contractAddresses,
        allContracts: contracts
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'Contract API is running',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
}

export default new ContractController();
