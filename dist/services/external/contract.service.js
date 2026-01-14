"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployToCircle = deployToCircle;
const circleApiService_1 = require("./circleApiService");
async function deployToCircle(bytecode, name) {
    // Placeholder - adjust endpoint and payload per Circle API
    const resp = await (0, circleApiService_1.post)('/v1/contracts', { name, bytecode });
    return resp.data;
}
exports.default = { deployToCircle };
