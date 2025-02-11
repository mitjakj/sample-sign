const hre = require("hardhat");

const {
  construct,
  decode,
  getRegistry,
  methods,
  createMetadata
} = require('@substrate/txwrapper-polkadot');
const { EXTRINSIC_VERSION } = require('@polkadot/types/extrinsic/v4/Extrinsic');
const { Keyring } = require('@polkadot/keyring');
const { GenericSignerPayload } = require('@polkadot/types');

const { u8aToHex, hexToU8a } = require('@polkadot/util');

async function main() {

  const accountManagerAddress = "0x2D15A0B4d3d50B227eFa08Ed6a93c23222C995fb";

  const signer = (await hre.ethers.getSigners())[0];
  const WA = await hre.ethers.getContractAt('AccountManager', accountManagerAddress, signer);

  // const tx = await contract.createSubstrate();
  // await tx.wait();

  const seed = "0x4cea7f38eef57a59916a68b5cdbd20077a3c4a161a6c47cef8a2996c9067c7a9";

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

    const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

    // Construct the keyring after the API (crypto has an async init)
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri(seed);

    // const index = await api.rpc.system.accountNextIndex(alice.address);
    const index = await rpcToLocalNode('system_accountNextIndex', [alice.address]);

    const unsigned = methods.balances.transferAllowDeath(
      {
        value: '12345',
        dest: { id: BOB }, // Bob
      },
      {
        address: alice.address,
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

    // fix payload trim first 2 characters
    signingPayload = `0x${signingPayload.substring(4,signingPayload.length)}`;
    console.log(`\nPayload to Sign: ${signingPayload}`);

    // offchain sing
    // const signatureOffchain = alice.sign(signingPayload, { withType: true });
    const signatureOffchain = alice.sign(signingPayload);
    // console.log(`signatureOffchain:\n${u8aToHex(signatureOffchain)}`);

    // oasis wallet sign
    let resp = await WA.createSubstrate(seed, signingPayload);

    // console.log(resp);
    // process.exit();

    let signature = resp.signature;

    console.log(`Signature:\n${signature}`);
    
    // const sigWithType = `0x01${signature.substring(2, signature.length)}`;
    const sigWithType = `0x01${u8aToHex(signatureOffchain).substring(2, u8aToHex(signatureOffchain).length)}`;
    // const sigWithType = u8aToHex(signatureOffchain);
    console.log('sigWithType:');
    console.log(sigWithType);

    // signature = hexToU8a(signature);
    signature = hexToU8a(sigWithType);
    // signature = signatureOffchain;

    // console.log(`Signature: ${u8aToHex(signature)}`);
    console.log('-----------------------');

    // Serialize a signed transaction.
    const tx = construct.signedTx(unsigned, signature, {
      metadataRpc,
      registry,
    });

    // Derive the tx hash of a signed transaction offline.
    const expectedTxHash = construct.txHash(tx);
    const actualTxHash = await rpcToLocalNode('author_submitExtrinsic', [tx]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
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