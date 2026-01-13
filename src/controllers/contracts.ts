import { Request, Response, NextFunction } from 'express';
import { contractDAO } from '../services';

export const getContractsByUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rows = await contractDAO.getContractsByUser(req.params.userId);
    res.status(200).send(rows);
  } catch (error: unknown) {
    next(error);
  }
};

export default getContractsByUser;
