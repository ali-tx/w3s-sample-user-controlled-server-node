import fs from 'fs';
import path from 'path';

export function compileSource(name: string, source: string) {
  let solc: any;
  try {
    // dynamic require so compilation is optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    solc = require('solc');
  } catch (err) {
    throw new Error(
      'solc not installed; run `yarn add solc` to enable compilation'
    );
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

export default { compileSource };
