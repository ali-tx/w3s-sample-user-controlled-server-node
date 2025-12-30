// backend/src/services/contract.service.ts
import * as fs from 'fs/promises';
import * as path from 'path';

interface CompilationResult {
  success: boolean;
  deployment?: any;
  error?: string;
}

interface ContractTemplate {
  [key: string]: string;
}

interface ContractInfo {
  contractId: string;
  contractName: string;
  network: string;
  abi: any;
  bytecode: string;
  timestamp: number;
  status: string;
  type?: string;
  contractAddress?: string;
}

class ContractService {
  private contractsDir: string;

  constructor() {
    this.contractsDir = path.join(__dirname, '../../contracts');
    this.initContractsDirectory();
  }

  async initContractsDirectory(): Promise<void> {
    try {
      await fs.access(this.contractsDir);
    } catch {
      await fs.mkdir(this.contractsDir, { recursive: true });
      console.log(`📁 Created contracts directory: ${this.contractsDir}`);
    }
  }

  async compileAndDeploy(contractData: {
    name: string;
    sourceCode: string;
    constructorArgs: any[];
    network: string;
  }): Promise<CompilationResult> {
    try {
      console.log(`🔄 Processing contract: ${contractData.name}`);

      // 1. Compile using local compiler
      const ContractCompiler = require('./contractCompiler');
      const compileResult = await ContractCompiler.compileContract(
        contractData.sourceCode,
        contractData.name,
      );

      console.log('✅ Contract compiled successfully');

      // Note: For general contracts, we only compile and save locally.
      // Specific deployment services handle actual blockchain deployment.

      // 2. Save compilation info
      const deployment: ContractInfo = {
        contractId: `${contractData.name}_${Date.now()}`,
        contractName: contractData.name,
        network: contractData.network || 'local',
        abi: compileResult.abi,
        bytecode: compileResult.bytecode,
        timestamp: Date.now(),
        status: 'compiled',
      };

      const deploymentPath = path.join(
        this.contractsDir,
        `deployment_${deployment.contractId}.json`,
      );

      await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
      console.log(`💾 Compilation saved to: ${deploymentPath}`);

      return {
        success: true,
        deployment,
      };
    } catch (error: any) {
      console.error('❌ Error in compileAndDeploy:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getContractTemplates(): ContractTemplate {
    return {
      ERC20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * 10 ** decimals;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Allowance exceeded");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}`,
      SimpleStorage: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;

    event ValueChanged(uint256 newValue);

    function set(uint256 newValue) public {
        value = newValue;
        emit ValueChanged(newValue);
    }

    function get() public view returns (uint256) {
        return value;
    }
}`,
      Counter: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 public count;

    event CountIncreased(uint256 newCount);
    event CountDecreased(uint256 newCount);

    function increment() public {
        count += 1;
        emit CountIncreased(count);
    }

    function decrement() public {
        require(count > 0, "Cannot decrement below zero");
        count -= 1;
        emit CountDecreased(count);
    }

    function reset() public {
        count = 0;
        emit CountIncreased(count);
    }
}`,
    };
  }

  async getAvailableNetworks(): Promise<string[]> {
    return ['vm', 'goerli', 'sepolia', 'mainnet', 'polygon'];
  }

  async getAllContracts(): Promise<ContractInfo[]> {
    try {
      const contracts: ContractInfo[] = [];

      // 1. Get local compiled contracts
      try {
        const files = await fs.readdir(this.contractsDir);

        for (const file of files) {
          if (file.endsWith('.json') && file.startsWith('deployment_')) {
            const filePath = path.join(this.contractsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const localContract: ContractInfo = JSON.parse(content);
            localContract.type = 'local';
            contracts.push(localContract);
          }
        }
      } catch (localError: any) {
        console.log('⚠️ Could not read local contracts:', localError.message);
      }

      // 2. Get Circle-deployed contracts
      try {
        const circleApiService = require('./circleApiService');
        const circleContracts: string[] =
          await circleApiService.listAllContracts();

        // Convert Circle contract addresses to contract objects
        for (const address of circleContracts) {
          contracts.push({
            contractId: `circle_${address}`,
            contractName: 'USDC-Splitter',
            contractAddress: address,
            type: 'circle',
            network: 'circle',
            status: 'deployed',
            timestamp: Date.now(), // We don't have exact timestamp from Circle
            abi: null, // Would need to get from compilation or contract
            bytecode: '',
          });
        }

        console.log(
          `📋 Total contracts found: ${contracts.length} (${
            contracts.filter((c) => c.type === 'local').length
          } local, ${
            contracts.filter((c) => c.type === 'circle').length
          } Circle)`,
        );
      } catch (circleError: any) {
        console.log(
          '⚠️ Could not fetch Circle contracts:',
          circleError.message,
        );
      }

      return contracts.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
      console.error('Error reading contracts:', error);
      return [];
    }
  }
}

const contractServiceInstance = new ContractService();
export { contractServiceInstance as default };
export const compileAndDeploy = contractServiceInstance.compileAndDeploy.bind(
  contractServiceInstance,
);
export const getContractTemplates =
  contractServiceInstance.getContractTemplates.bind(contractServiceInstance);
export const getAvailableNetworks =
  contractServiceInstance.getAvailableNetworks.bind(contractServiceInstance);
export const getAllContracts = contractServiceInstance.getAllContracts.bind(
  contractServiceInstance,
);
