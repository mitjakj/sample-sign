async function main() {

    const jsonAbi = require("../../artifacts/contracts/Account.sol/Account.json").abi;
  
    const iface = new ethers.Interface(jsonAbi);
    console.log(iface.format(""));
  
  }
  
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
    