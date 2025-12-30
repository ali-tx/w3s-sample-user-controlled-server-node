import { Request, Response } from 'express';
import contractService from '../services/contractService';
import circleApiService from '../services/circleApiService';

interface CompileDeployBody {
  name: string;
  sourceCode: string;
  constructorArgs?: any[];
  network?: string;
}

interface CompileDeployResult {
  success: boolean;
  deployment?: any;
  error?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  [key: string]: any;
}

export class ContractController {
  async compileAndDeploy(req: Request, res: Response): Promise<void> {
    try {
      const { name, sourceCode, constructorArgs, network }: CompileDeployBody = req.body;

      // Validate input
      if (!name || !sourceCode) {
        res.status(400).json({
          success: false,
          error: 'Contract name and source code are required'
        });
        return;
      }

      console.log(`🔄 Processing contract: ${name}`);

      const result: CompileDeployResult = await contractService.compileAndDeploy({
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
    } catch (error: any) {
      console.error('Controller error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await contractService.getContractTemplates();
      const response: ApiResponse = {
        success: true,
        templates
      };
      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getNetworks(req: Request, res: Response): Promise<void> {
    try {
      const networks = await contractService.getAvailableNetworks();
      const response: ApiResponse = {
        success: true,
        networks
      };
      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getContracts(req: Request, res: Response): Promise<void> {
    try {
      const contracts = await contractService.getAllContracts();
      const response: ApiResponse = {
        success: true,
        contracts
      };
      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async refreshContracts(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Manually refreshing contracts from Circle API...');
      const contractAddresses = await circleApiService.listAllContracts();
      const contracts = await contractService.getAllContracts();

      const response: ApiResponse = {
        success: true,
        message: `Found ${contractAddresses.length} contracts from Circle Dashboard`,
        contractCount: contractAddresses.length,
        contractAddresses: contractAddresses,
        allContracts: contracts
      };
      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const response: ApiResponse = {
        success: true,
        message: 'Contract API is running',
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
