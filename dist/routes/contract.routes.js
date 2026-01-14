"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const contract_controller_1 = __importDefault(require("../controllers/contract.controller"));
const router = express_1.default.Router();
router.post('/deploy', (req, res, next) => {
    contract_controller_1.default.compileAndDeploy(req, res, next);
});
exports.default = router;
