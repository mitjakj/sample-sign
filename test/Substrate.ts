const { expect } = require("chai");
const { ethers } = require("hardhat");
const { sr25519PairFromSeed, sr25519PairFromU8a } = require('@polkadot/util-crypto');
const { u8aToHex, hexToU8a } = require('@polkadot/util');

const {
  construct,
  decode,
  getRegistry,
  methods
} = require('@substrate/txwrapper-polkadot');
const { Keyring } = require('@polkadot/keyring');

describe("Substrate", function() {
  let CONTRACT, keyring, SENDER_PAIR: any;

  const SENDER_SEED = "0x4cea7f38eef57a59916a68b5cdbd20077a3c4a161a6c47cef8a2996c9067c7a9";

  beforeEach(async () => {
    
    const testSignFactory = await hre.ethers.getContractFactory("TestSign");
    CONTRACT = await testSignFactory.deploy();
    await CONTRACT.waitForDeployment();

    // Construct the keyring after the API (crypto has an async init)
    keyring = new Keyring({ type: 'sr25519' });
    SENDER_PAIR = keyring.addFromUri(SENDER_SEED);
  });

  it("Send 12345 to BOB", async function() {

    const SIGN_ONCHAIN = false;
  
    const {
      metadataRpc,
      registry,
      signingPayload,
      unsigned
    } = await prepareUnsignedPayload();

    let signature;

    if (SIGN_ONCHAIN) {
      // onchain sign
      let resp = await CONTRACT.createSubstrate(SENDER_SEED, signingPayload);
      signature = resp.signature;

    } else {
      // offchain sign
      signature = u8aToHex(SENDER_PAIR.sign(signingPayload));
    }

    console.log(`Signature:\n${signature}`);
    
    const sigWithType = `0x01${signature.substring(2, signature.length)}`;
    console.log(`sigWithType:\n${sigWithType}`);

    signature = hexToU8a(sigWithType);

    // Serialize a signed transaction.
    const tx = construct.signedTx(unsigned, signature, {
      metadataRpc,
      registry,
    });

    // Derive the tx hash of a signed transaction offline.
    const expectedTxHash = construct.txHash(tx);
    const actualTxHash = await rpcToLocalNode('author_submitExtrinsic', [tx]);

    expect(expectedTxHash).to.equal(actualTxHash);
  });

  function rpcToLocalNode(
    method: string,
    params: any[] = [],
  ): Promise<any> {
    return fetch('https://asset-hub-westend-rpc.dwellir.com', {
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method,
        params,
      }),
      headers: {
        'Content-Type': 'application/json',
        connection: 'keep-alive',
      },
      method: 'POST',
    })
      .then((response) => response.json())
      .then(({ error, result }) => {
        if (error) {
          throw new Error(
            `${error.code} ${error.message}: ${JSON.stringify(error.data)}`,
          );
        }
  
        return result;
      });
  }

  async function prepareUnsignedPayload(): Promise<any> {

    // prepare raw transaciton
    // send 12345 WND to BOB

    // sender
    // publickey: 5GxmLBv2spqsU5Lm1LifRzix9aHYnuSrFJdMn3PZR8tHnwBg

    // recipient
    const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

    const { block } = await rpcToLocalNode('chain_getBlock');
    const blockHash = await rpcToLocalNode('chain_getBlockHash');
    const genesisHash = await rpcToLocalNode('chain_getBlockHash', [0]);
    const metadataRpc = await rpcToLocalNode('state_getMetadata');
    const { specVersion, transactionVersion, specName } = await rpcToLocalNode(
      'state_getRuntimeVersion',
    );

    const registry = getRegistry({
      chainName: 'Westend',
      specName,
      specVersion,
      metadataRpc,
    });

    const index = await rpcToLocalNode('system_accountNextIndex', [SENDER_PAIR.address]);

    const unsigned = methods.balances.transferAllowDeath(
      {
        value: '12345',
        dest: { id: BOB }, // Bob
      },
      {
        address: SENDER_PAIR.address,
        blockHash,
        blockNumber: registry
          .createType('BlockNumber', block.header.number)
          .toNumber(),
        eraPeriod: 4, // 64,
        genesisHash,
        metadataRpc,
        nonce: index, // Assuming this is Alice's first tx on the chain
        specVersion,
        tip: 0,
        transactionVersion,
      },
      {
        metadataRpc,
        registry,
      },
    );

    // Decode an unsigned transaction.
    const decodedUnsigned = decode(unsigned, {
      metadataRpc,
      registry,
    });
    console.log(
      `\nDecoded Transaction\n  To: ${
        (decodedUnsigned.method.args.dest as { id: string })?.id
      }\n` + `  Amount: ${JSON.stringify(decodedUnsigned.method.args.value)}`,
    );

    // Construct the signing payload from an unsigned transaction.
    let signingPayload = construct.signingPayload(unsigned, { registry });
    // console.log(`\nPayload to Sign: ${signingPayload}`);

    // fix payload trim first 2 characters -- otherwise it doesn't work
    signingPayload = `0x${signingPayload.substring(4,signingPayload.length)}`;
    console.log(`\nPayload to Sign: ${signingPayload}`);

    return {
      metadataRpc,
      registry,
      signingPayload,
      unsigned
    };
  }
  
});