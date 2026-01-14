"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const contract_controller_1 = require("../controllers/contract.controller");
const router = express_1.default.Router();
router.get('/health', (_req, res) => res.send({ status: 'ok' }));
router.post('/deploy-splitter', contract_controller_1.compileAndDeploy);
exports.default = router;
