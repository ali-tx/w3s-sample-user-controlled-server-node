export interface ContractRecord {
  id: string;
  userId: string;
  name: string;
  contractAddress?: string | null;
  artifactPath?: string | null;
  status?: string | null;
  walletAddress?: string | null;
  contractId?: string | null; // Circle contract ID
  createdAt?: string | null;
}

export interface ContractDAO {
  insertContract: (rec: ContractRecord) => void;
  getContractsByUser: (userId: string) => Promise<ContractRecord[]>;
}

export let contractDAO: ContractDAO;

export const registerContractDAO = (newDAO: ContractDAO) => {
  contractDAO = newDAO;
};
