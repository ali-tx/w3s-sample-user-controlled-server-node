import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from '../logging/logger';
import config from '../../config';
import circleService from '../external/circleService';
import { Web3 } from 'web3';
const web3 = new Web3();

type ContractCreateResult = {
  deployed?: boolean;
  contractAddress?: string | null;
  artifactPath?: string | null;
  circleContractId?: string | null;
  raw?: unknown;
};

function sanitizeName(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(cleaned)) return `C${cleaned}`;
  return cleaned;
}

export const createContractForUser = async (
  userId: string,
  name: string,
  receiverWalletAddress: string,
  userToken?: string
): Promise<ContractCreateResult> => {
  try {
    const repoRoot = path.resolve(__dirname, '../../..');
    const srcSolPath = path.join(
      repoRoot,
      'src',
      'routers',
      'contracts',
      'Usdc.sol'
    );
    if (!fs.existsSync(srcSolPath)) {
      logger.warn(`Contract template not found at ${srcSolPath}`);
      return { deployed: false };
    }

    const raw = fs.readFileSync(srcSolPath, 'utf8');

    // Replace the receive/fee addresses and contract name
    const sanitized = sanitizeName(name);
    let modified = raw.replace(
      /contract\s+[A-Za-z0-9_]+\s*{/m,
      `contract ${sanitized} {`
    );

    // Replace hardcoded RECEIVE_WALLET and FEE_WALLET lines (simple replace)
    modified = modified.replace(
      /address\s+private\s+constant\s+RECEIVE_WALLET\s*=\s*[^;]+;/m,
      `address private constant RECEIVE_WALLET = ${web3.utils.toChecksumAddress(receiverWalletAddress)};`
    );
    modified = modified.replace(
      /address\s+private\s+constant\s+FEE_WALLET\s*=\s*[^;]+;/m,
      `address private constant FEE_WALLET = 0xdDB2FD31fE60977a58600D757737ae4BFaCD3d04;`
    );

    // write to tmp folder
    const outDir = path.join(repoRoot, 'src', 'services', 'contracts', 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${userId}_${sanitized}.sol`);
    fs.writeFileSync(outFile, modified, 'utf8');

    // If external contract builder service is configured, call it
    const builderUrl = config.CONTRACT_BUILDER_URL;
    if (builderUrl) {
      try {
        const feeWalletAddress = '0xdDB2FD31fE60977a58600D757737ae4BFaCD3d04';
        const url = `${builderUrl.replace(/\/$/, '')}/deploy`;
        const resp = await axios.post(url, {
          userId,
          name: sanitized,
          receiverWalletAddress,
          feeWalletAddress,
          userToken,
          source: modified
        });
        logger.info(`Contract builder response status ${resp.status}`);
        return {
          deployed: true,
          contractAddress: resp.data?.contractAddress ?? null,
          circleContractId: resp.data?.contractId ?? null,
          raw: resp.data
        };
      } catch (err: unknown) {
        logger.error('Failed to call external contract builder', err as Error);
      }
    }

    // Attempt local compilation if solc is available
    try {
      // dynamic require to avoid hard dependency if not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const solc = require('solc');
      const input = {
        language: 'Solidity',
        sources: {
          'contract.sol': {
            content: modified
          }
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode.object']
            }
          }
        }
      };
      logger.info('Solc input sources keys:', Object.keys(input.sources));
      const output = JSON.parse(solc.compile(JSON.stringify(input)));
      logger.info('Solc compile result keys:', Object.keys(output));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fatalErrors = output.errors?.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => e.severity === 'error'
      );
      if (fatalErrors && fatalErrors.length > 0) {
        logger.error('Solc compilation errors:', fatalErrors);
        return { deployed: false, raw: output };
      }
      if (output.errors) {
        logger.warn('Solc compilation warnings:', output.errors);
      }
      const contracts = output.contracts?.['contract.sol'];
      const contractName = Object.keys(contracts || {})[0];
      if (!contractName) {
        logger.error('No contract compiled');
        return { deployed: false, raw: output };
      }
      const artifact = contracts[contractName];
      const artifactsDir = path.join(
        repoRoot,
        'src',
        'services',
        'contracts',
        'artifacts'
      );
      fs.mkdirSync(artifactsDir, { recursive: true });
      const artifactPath = path.join(
        artifactsDir,
        `${userId}_${sanitized}.json`
      );
      fs.writeFileSync(
        artifactPath,
        JSON.stringify(
          { abi: artifact.abi, bytecode: artifact.evm.bytecode.object },
          null,
          2
        )
      );
      logger.info(`Saved compiled artifact to ${artifactPath}`);

      // Attempt deployment via Circle
      try {
        const deployResp = await circleService.deployContract(
          artifact.evm.bytecode.object,
          sanitized,
          artifact.abi,
          userToken
        );
        logger.info(
          `Contract deployed via Circle: ${deployResp.data?.contractAddress}`
        );
        return {
          deployed: true,
          contractAddress: deployResp.contractAddress,
          artifactPath,
          circleContractId:
            deployResp.data?.contractId || deployResp.contractId,
          raw: { ...output, deployResp }
        };
      } catch (deployErr: unknown) {
        logger.warn(
          'Circle deployment failed, contract compiled but not deployed',
          deployErr as Error
        );
        return { deployed: false, artifactPath, raw: output };
      }
    } catch (err: unknown) {
      logger.warn(
        'Local compilation skipped or failed; solc may be missing',
        err as Error
      );
      return { deployed: false };
    }
  } catch (err: unknown) {
    logger.error('createContractForUser failed', err as Error);
    return { deployed: false };
  }
};

export default createContractForUser;
