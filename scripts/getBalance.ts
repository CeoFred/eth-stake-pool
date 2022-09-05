import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'

async function main() {

  const provider = ethers.provider
  const contractBalance = await provider.getBalance('0x970ed205BBBe8d57159F0B8155E1a9eC295B72fa')

  console.log('contract balance', Number(contractBalance)," wei")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
