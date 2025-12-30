import { Request, Response } from 'express';
import circleApiService from './circleApiService';

interface WebhookData {
  notificationType?: string;
  event?: {
    name: string;
    to: string[];
    value: string | number;
    transaction_hash: string;
  };
  test?: boolean;
  contract_address?: string;
  amount?: number;
  [key: string]: any;
}

interface ParsedWebhookData {
  isSystemEvent?: boolean;
  eventType?: string;
  contractAddress?: string;
  amount?: number;
  txHash?: string;
  source?: string;
  isUSDCTransfer?: boolean;
  isTest?: boolean;
  isUnknown?: boolean;
}

interface WebhookResponse {
  status: string;
  type?: string;
  reason?: string;
  amount?: number;
  contract?: string;
  transactionId?: string;
  error?: string;
  [key: string]: any;
}

function parseWebhookData(webhookData: WebhookData): ParsedWebhookData {
  console.log(
    '📨 Webhook received - Type:',
    webhookData.notificationType || 'custom'
  );

  // Handle Circle system webhooks
  if (webhookData.notificationType) {
    console.log(`✅ Circle webhook: ${webhookData.notificationType}`);
    return { isSystemEvent: true, eventType: webhookData.notificationType };
  }

  // Handle USDC transfers (from Tenderly/Alchemy)
  if (webhookData.event?.name === 'Transfer') {
    return {
      contractAddress: webhookData.event.to[0],
      amount: parseInt(webhookData.event.value as string),
      txHash: webhookData.event.transaction_hash,
      source: 'tenderly',
      isUSDCTransfer: true
    };
  }

  // Handle test format
  if (webhookData.test) {
    return {
      contractAddress: webhookData.contract_address,
      amount: webhookData.amount || 1000000,
      source: 'test',
      isTest: true
    };
  }

  return { isUnknown: true };
}

async function handleUSDCWebhook(req: Request, res: Response): Promise<void> {
  try {
    console.log(`🕒 Webhook received`);

    const data = parseWebhookData(req.body);

    // Handle system events
    if (data.isSystemEvent) {
      const response: WebhookResponse = {
        status: 'acknowledged',
        type: 'system'
      };
      res.json(response);
      return;
    }

    // Handle tests
    if (data.isTest) {
      console.log(`🧪 Test: ${data.amount} USDC to ${data.contractAddress}`);
      const response: WebhookResponse = {
        status: 'test_ok',
        amount: data.amount
      };
      res.json(response);
      return;
    }

    // Handle real USDC transfers
    if (data.isUSDCTransfer && data.amount && data.amount > 300000) {
      console.log(`💰 REAL: ${data.amount} USDC to ${data.contractAddress}`);

      // Ensure we have the latest contract list
      await circleApiService.fetchContractAddresses();

      if (!circleApiService.contractAddresses.includes(data.contractAddress!)) {
        console.log(`⚠️ Contract ${data.contractAddress} not in deployed list`);
        const response: WebhookResponse = {
          status: 'ignored',
          reason: 'Contract not found in deployed contracts',
          contract: data.contractAddress
        };
        res.json(response);
        return;
      }

      const result = await circleApiService.triggerSplit(
        data.contractAddress!,
        data.amount
      );

      const response: WebhookResponse = {
        status: 'success',
        transactionId: result.data?.id,
        amount: data.amount,
        contract: data.contractAddress
      };
      res.json(response);
      return;
    }

    const response: WebhookResponse = { status: 'processed' };
    res.json(response);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    const response: WebhookResponse = { error: error.message };
    res.status(500).json(response);
  }
}

async function testWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { amount = 1000000 } = req.body;
    console.log(`🧪 Test received: ${amount} USDC`);
    const response: WebhookResponse = { status: 'test_ok', amount };
    res.json(response);
  } catch (error: any) {
    const response: WebhookResponse = { error: error.message };
    res.status(500).json(response);
  }
}

export { handleUSDCWebhook, testWebhook };
