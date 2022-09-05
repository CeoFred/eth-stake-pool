import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'

async function main() {
  const factory = await ethers.getContractFactory('ETHPool')

  // If we had constructor arguments, they would be passed into deploy()
  const contract = await factory.deploy()

  // The address the Contract WILL have once mined
  console.log(contract.address)

  // The transaction that was sent to the network to deploy the Contract
  console.log(contract.deployTransaction.hash)

  // The contract is NOT deployed yet; we must wait until it is mined
  await contract.deployed()

  const provider = ethers.provider;
  const contractBalance = await provider.getBalance(contract.address);

  console.log('contract balance', contractBalance)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
