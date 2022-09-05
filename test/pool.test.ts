import { expect } from 'chai'
import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'

import { ETHPool__factory, ETHPool } from '../build/types'

const { getContractFactory, getSigners } = ethers

describe('ETHPool', () => {
  let pool: ETHPool
  let deployer
  let staker
  let staker2
  const provider = ethers.getDefaultProvider()

  beforeEach(async () => {
    // 1
    const signers = await getSigners()
    deployer = signers[0]
    staker = signers[1]
    staker2 = signers[2]

    const ethPoolFactory = (await getContractFactory('ETHPool', signers[0])) as ETHPool__factory
    pool = await ethPoolFactory.deploy()
    await pool.deployed()
    const initialReward = await pool.rewardBalance()

    expect(initialReward).to.eq(0)
    expect(pool.address).to.be.a.properAddress
  })

  describe('Stake ETH', async () => {
    it('Should fail to stake due to amount less than 1 wei', async () => {
      await expect(pool.stakeEth({ value: 0 })).to.be.reverted
    })

    it('Should stake successfully', async () => {
      await expect(pool.connect(staker).stakeEth({ value: 2, from: staker.address })).not.to.be.reverted

      const [result] = await pool.isStakeholder(staker.address)
      expect(result).to.be.true

      const stakesInPool = await pool._totalStakesInPool()
      expect(stakesInPool).to.eq(2)

      const totalStakes = await pool.stakeCount()
      expect(totalStakes).to.eq(1)

      const balanceOfStakerInPool = await pool._balances(staker.address)
      expect(balanceOfStakerInPool).to.eq(2)

      const stake = await pool.stakeEth({ value: 4 })

      expect(stake).to.emit(pool, 'Staked').withArgs(4, deployer.address)
    })
  })

  describe('Rewards Deposit', async () => {
    it('should fail to deposit reward because of no access', async () => {
      await expect(pool.connect(staker).depositReward({ value: 0 })).to.be.reverted
    })

    it('Should fail due to insufficient stake amount', async () => {
      await expect(pool.connect(deployer).depositReward({ value: 0, from: deployer.address })).to.be.revertedWith(
        'Insufficient stake amount',
      )
    })

    it('Should fail due to timestamp', async () => {
      await pool.connect(deployer).depositReward({ value: 1500, from: deployer.address })

      await expect(pool.depositReward({ value: 1500, from: deployer.address })).to.be.revertedWith(
        'Wrong time to desposit reward',
      )
    })

    it('Should deposit reward', async () => {
      await pool.connect(staker).stakeEth({ value: 1500, from: staker.address })
      await pool.connect(staker2).stakeEth({ value: 500, from: staker2.address })

      const totalStakes = await pool._totalStakesInPool()
      expect(totalStakes).to.be.eq(2000)

      const [initialReward] = await pool.getStake(staker.address)

      await expect(pool.connect(deployer).depositReward({ value: 800, from: deployer.address }))
        .to.emit(pool, 'RewardDeposited')
        .withArgs(800, deployer.address)

      const [postReward] = await pool.getStake(staker.address)
      expect(postReward).to.be.eq(600)

      const [postRewardStaker2] = await pool.getStake(staker2.address)
      expect(postRewardStaker2).to.be.eq(200)
    })
  })

  describe('Stake Withdrawal', async () => {
    it('Should fail to withdraw because of invalid amount', async () => {
      await expect(pool.withdrawStake(0)).to.be.revertedWith('Send a valid amount to deposit')
    })

    it('Should fail because of invalid stake', async () => {
      await expect(pool.withdrawStake(30)).to.be.revertedWith('No valid stake')
    })

    it('Should fail while trying to withdraw more than the maxFundsWithdrawable', async () => {
      await pool.connect(staker2).stakeEth({ value: ethers.utils.parseEther('50'), from: staker2.address })
      await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('10'), from: deployer.address })

      await expect(pool.connect(staker2).withdrawStake(ethers.utils.parseEther('550'))).to.be.revertedWith(
        'Trying to drain the pool?',
      )
    })

    it('Should withdraw successfully', async () => {
      await pool.connect(staker2).stakeEth({ value: ethers.utils.parseEther('50'), from: staker2.address })
      await pool.connect(staker).stakeEth({ value: ethers.utils.parseEther('50'), from: staker.address })

      await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('10'), from: deployer.address })

      const totalStakes = await pool._totalStakesInPool()
      const stakeCount = await pool.stakeCount()

      const [stakerReward] = await pool.getStake(staker.address)
      await expect(Number(stakerReward)).to.eq(Number(ethers.utils.parseEther('5')))

      const successfulStake = await pool.connect(staker).withdrawStake(ethers.utils.parseEther('40'))

      await expect(successfulStake).to.emit(pool, 'Withdrawal')

      await expect(totalStakes).to.be.eq(ethers.utils.parseEther('100'))
      await expect(stakeCount).to.be.eq(2)

      const provider = ethers.provider
      const contractBalance = await provider.getBalance(pool.address)

      expect(contractBalance).to.be.eq('65000000000000000000')
    })
  })

  describe('Team Operation', async () => {
    it('Should add team member', async () => {
      await pool.connect(deployer).addTeamMember(staker.address)

      const isTeamMember = await pool.isTeamMember(staker.address)

      expect(isTeamMember).to.be.true
    })

    it('Should fail to add team member because no access', async () => {
      await expect(pool.connect(staker2).addTeamMember(staker.address)).to.be.revertedWith('You must be a team member')
    })

    it('Should remove team member', async () => {
      await pool.connect(deployer).removeTeamMember(staker.address)
      const isTeamMember = await pool.isTeamMember(staker.address)
      expect(isTeamMember).to.be.false
    })

    it('Should fail to remove team member because no access', async () => {
      await expect(pool.connect(staker2).removeTeamMember(staker.address)).to.be.revertedWith(
        'You must be a team member',
      )
    })
  })

  describe('Pull Funds', async () => {

    it('Should fail to pull funds due to invalid amount', async () => {
       expect(pool.connect(deployer).pullFunds(0, 1)).to.be.revertedWith('Send a valid amount to deposit')
    });

    it('Should faill to pull funds due to no access', async () => {
      expect(pool.connect(staker).pullFunds(0, 1)).to.be.revertedWith('You must be a team member')
    })

    it('Should faill to pull funds due to insufficient funds', async () => {

      pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('60')})
      expect(pool.pullFunds(ethers.utils.parseEther('65'), 1)).to.be.revertedWith('Insufficient funds')
    })

     it('Should fail to pull funds due to insufficient _totalStakesInPool funds', async () => {
       await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('65') })
       pool.stakeEth({ value: ethers.utils.parseEther('65') })

       await expect(pool.pullFunds(ethers.utils.parseEther('66'), 1)).to.be.revertedWith('_totalStakesInPool Underflow')
     })

     it('Should fail to pull funds due to insufficient rewardBalance funds', async () => {
       await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('65') })
       await pool.stakeEth({ value: ethers.utils.parseEther('65') })

       await expect(pool.pullFunds(ethers.utils.parseEther('66'), 0)).to.be.revertedWith('rewardBalance Underflow')
     });

     it('Should pull funds from rewardBalance funds', async () => {
      await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('65') })
       
      await pool.stakeEth({ value: ethers.utils.parseEther('65') })

       await pool.pullFunds(ethers.utils.parseEther('60'), 1)
     })

      it('Should pull funds from _totalStakesInPool funds', async () => {
        await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('65') })

        await pool.stakeEth({ value: ethers.utils.parseEther('65') })

        await pool.pullFunds(ethers.utils.parseEther('60'), 0)
      })

       it('Should fail to pull funds from _totalStakesInPool funds due to invalid fund type', async () => {
         await pool.connect(deployer).depositReward({ value: ethers.utils.parseEther('65') })

         await pool.stakeEth({ value: ethers.utils.parseEther('65') })

         await expect(pool.pullFunds(ethers.utils.parseEther('60'), 5)).to.be.revertedWith('Invalid fund type')
       })

  })
})
