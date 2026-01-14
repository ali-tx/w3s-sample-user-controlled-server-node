"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSource = compileSource;
function compileSource(name, source) {
    let solc;
    try {
        // dynamic require so compilation is optional
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        solc = require('solc');
    }
    catch (err) {
        throw new Error('solc not installed; run `yarn add solc` to enable compilation');
    }
    const input = {
        language: 'Solidity',
        sources: {
            [name]: { content: source }
        },
        settings: {
            outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
        }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    return output;
}
exports.default = { compileSource };
