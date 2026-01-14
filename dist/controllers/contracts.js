"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractsByUser = void 0;
const services_1 = require("../services");
const getContractsByUser = async (req, res, next) => {
    try {
        const rows = await services_1.contractDAO.getContractsByUser(req.params.userId);
        res.status(200).send(rows);
    }
    catch (error) {
        next(error);
    }
};
exports.getContractsByUser = getContractsByUser;
exports.default = exports.getContractsByUser;
