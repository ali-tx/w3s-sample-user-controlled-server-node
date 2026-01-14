import { Request, Response, NextFunction } from 'express';
import compiler from '../services/external/contractCompiler';
import fs from 'fs';
import path from 'path';
import circleService from '../services/external/circleService';
import { contractDAO, circleUserSdk } from '../services';

async function pollContractStatus(
  circleContractId: string,
  id: string,
  userId: string,
  name: string,
  artifactPath: string,
  walletAddress: string | null
) {
  const maxPolls = 300; // 2 hours if polling every 30s
  let polls = 0;
  const pollInterval = setInterval(async () => {
    try {
      const contractData = await circleService.getContract(circleContractId);
      if (contractData.status === 'COMPLETE') {
        clearInterval(pollInterval);
        // Update DB with contractAddress
        contractDAO.insertContract({
          id,
          userId,
          name,
          contractAddress: contractData.contractAddress || contractData.address,
          artifactPath,
          status: 'deployed',
          walletAddress,
          contractId: circleContractId
        });
      } else if (polls >= maxPolls) {
        clearInterval(pollInterval);
        // Update status to failed
        contractDAO.insertContract({
          id,
          userId,
          name,
          artifactPath,
          status: 'failed',
          walletAddress,
          contractId: circleContractId
        });
      }
      polls++;
    } catch (err) {
      console.error('Polling error', err);
      clearInterval(pollInterval);
    }
  }, 30000);
}

export async function compileAndDeploy(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { source, name } = req.body as { source: string; name: string };
    if (!source || !name)
      return res.status(400).json({ error: 'source and name required' });
    const out = compiler.compileSource(`${name}.sol`, source);
    const file = out.contracts?.[`${name}.sol`];
    const contractName = Object.keys(file || {})[0];
    const abi = file[contractName].abi;
    const bytecode = file[contractName].evm.bytecode.object;
    const artifactsDir = path.join(__dirname, '..', 'services', 'contracts');
    fs.mkdirSync(artifactsDir, { recursive: true });
    const artifactPath = path.join(artifactsDir, `${name}.json`);
    fs.writeFileSync(artifactPath, JSON.stringify({ abi, bytecode }, null, 2));
    const resp = await circleService.deployContract(bytecode, name, abi);

    console.log('Deploy contract initiate response:', resp);
    // Get userId from token
    const userToken = req.headers['token'] as string;
    let userId: string | null = null;
    let walletAddress: string | null = null;
    if (userToken) {
      try {
        const payload = JSON.parse(
          Buffer.from(userToken.split('.')[1], 'base64').toString()
        );
        userId = payload.sub || payload.user_id || payload.userId;
        if (userId) {
          const listResp = await circleUserSdk.listWallets({
            userToken
          });
          const latestWallet = listResp.data?.wallets?.[0];
          walletAddress = latestWallet?.address || null;
        }
      } catch (err) {
        console.warn('Failed to get user and wallet info', err);
      }
    }

    let id = '';
    let status = 'compiled';
    const contractAddress = resp.contractAddress || resp.address;
    const circleContractId = resp.id;
    let contractId: string | undefined = undefined;

    if (userId) {
      id = `${userId}-${Date.now()}`;
      contractId = circleContractId;
      if (contractAddress) {
        status = 'deployed';
      } else if (circleContractId) {
        status = 'pending';
        // Start polling
        pollContractStatus(
          circleContractId,
          id,
          userId,
          name,
          artifactPath,
          walletAddress
        );
      }
      contractDAO.insertContract({
        id,
        userId,
        name,
        contractAddress,
        artifactPath,
        status,
        walletAddress,
        contractId
      });
    }

    res.status(200).send({ artifactPath, resp, contractId });
  } catch (err) {
    next(err);
  }
}

export default { compileAndDeploy };
