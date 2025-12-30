import solc from 'solc';
import fs from 'fs/promises';
import path from 'path';

interface SolcInput {
  language: string;
  sources: {
    [key: string]: {
      content: string;
    };
  };
  settings: {
    outputSelection: {
      '*': {
        '*': string[];
      };
    };
  };
}

interface SolcError {
  severity: string;
  message: string;
  [key: string]: any;
}

interface SolcOutput {
  errors?: SolcError[];
  contracts: {
    [key: string]: {
      [key: string]: {
        abi: any[];
        evm: {
          bytecode: {
            object: string;
          };
        };
      };
    };
  };
}

interface CompilationResult {
  abi: any[];
  bytecode: string;
  contractName: string;
}

class ContractCompiler {
  static async getContractSource(
    contractName: string = 'Greeter'
  ): Promise<string> {
    if (contractName === 'Greeter') {
      return `
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.20;

        contract Greeter {
            string private greeting;

            constructor(string memory _greeting) {
                greeting = _greeting;
            }

            function greet() public view returns (string memory) {
                return greeting;
            }

            function setGreeting(string memory _greeting) public {
                greeting = _greeting;
            }
        }
      `;
    }

    if (contractName === 'SepoliaUSDCSplitter') {
      // Read from the Usdc.sol file in the project root contracts directory
      const contractPath = path.join(__dirname, '../../../contracts/Usdc.sol');
      try {
        const sourceCode = await fs.readFile(contractPath, 'utf8');
        return sourceCode;
      } catch (error: any) {
        throw new Error(
          `Failed to read contract file ${contractPath}: ${error.message}`
        );
      }
    }

    // Add more contract templates as needed
    throw new Error(`Contract template "${contractName}" not found.`);
  }

  static async compileContract(
    sourceCode: string,
    contractName: string | null = null
  ): Promise<CompilationResult> {
    const input: SolcInput = {
      language: 'Solidity',
      sources: {
        'contract.sol': {
          content: sourceCode
        }
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode']
          }
        }
      }
    };

    const output: SolcOutput = JSON.parse(solc.compile(JSON.stringify(input)));

    // Check for compilation errors
    if (output.errors) {
      const errors = output.errors.filter(
        (e: SolcError) => e.severity === 'error'
      );
      if (errors.length > 0) {
        throw new Error(`Compilation failed: ${JSON.stringify(errors)}`);
      }
    }

    // Find the contract name (either passed or from source)
    let foundContractName: string = contractName || '';
    if (!foundContractName) {
      const contractNames = Object.keys(output.contracts['contract.sol']);
      if (contractNames.length === 0) {
        throw new Error('No contracts found in compilation output');
      }
      foundContractName = contractNames[0];
    }

    const contract = output.contracts['contract.sol'][foundContractName];
    if (!contract) {
      throw new Error(
        `Contract ${foundContractName} not found in compilation output`
      );
    }

    return {
      abi: contract.abi,
      bytecode: '0x' + contract.evm.bytecode.object,
      contractName: foundContractName
    };
  }
}

export default ContractCompiler;
