start localnet:
`docker run -it -p8545:8545 -p8546:8546 ghcr.io/oasisprotocol/sapphire-localnet`

run tests:
`npx hardhat test --network sapphireLocalnet ./test/Substrate.ts`

try onchain/offchain signing by changing parameter:
`const SIGN_ONCHAIN = true/false;`

in `./test/Substrate.ts`