import fs from 'fs/promises';
import path from 'path';
// solc may not have types; import via require to keep compatibility
const solc = require('solc');

export default class ContractCompiler {
  static async getContractSource(contractName = 'Greeter'): Promise<string> {
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
      const contractPath = path.join(__dirname, '../../contracts/Usdc.sol');
      try {
        const sourceCode = await fs.readFile(contractPath, 'utf8');
        return sourceCode;
      } catch (error: any) {
        throw new Error(
          `Failed to read contract file ${contractPath}: ${error.message}`
        );
      }
    }

    throw new Error(`Contract template "${contractName}" not found.`);
  }

  static async compileContract(
    sourceCode: string,
    contractName: string | null = null
  ) {
    const input = {
      language: 'Solidity',
      sources: {
        'contract.sol': { content: sourceCode }
      },
      settings: {
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      const errors = output.errors.filter((e: any) => e.severity === 'error');
      if (errors.length > 0) {
        throw new Error(`Compilation failed: ${JSON.stringify(errors)}`);
      }
    }

    let foundContractName = contractName;
    if (!foundContractName) {
      const contractNames = Object.keys(output.contracts['contract.sol'] || {});
      if (contractNames.length === 0) {
        throw new Error('No contracts found in compilation output');
      }
      foundContractName = contractNames[0];
    }

    const contract = output.contracts['contract.sol'][foundContractName];
    if (!contract)
      throw new Error(
        `Contract ${foundContractName} not found in compilation output`
      );

    return {
      abi: contract.abi,
      bytecode: '0x' + contract.evm.bytecode.object,
      contractName: foundContractName
    };
  }
}
