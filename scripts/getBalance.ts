import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'

async function main() {

  const provider = ethers.provider
  const contractBalance = await provider.getBalance('0x014E70E7609324cA838c34f77e29C199cb017274')

  console.log('contract balance', Number(contractBalance)," wei")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
