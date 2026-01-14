"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractsRouter = void 0;
const express_1 = __importDefault(require("express"));
const contracts_1 = require("../controllers/contracts");
const router = express_1.default.Router();
exports.contractsRouter = router;
// GET /contracts/:userId
router.get('/:userId', contracts_1.getContractsByUser);
