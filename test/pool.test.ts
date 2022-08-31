import { expect } from 'chai'
import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'

import { ETHPool__factory, ETHPool } from '../build/types'

const { getContractFactory, getSigners } = ethers

describe('ETHPool', () => {
  let pool: ETHPool
  let deployer;
  let staker;
  let staker2;

  beforeEach(async () => {
    // 1
    const signers = await getSigners()
    deployer = signers[0];
    staker = signers[1];
    staker2 = signers[2];

    const ethPoolFactory = (await getContractFactory('ETHPool', signers[0])) as ETHPool__factory
    pool = await ethPoolFactory.deploy()
    await pool.deployed()
    const initialReward = await pool.rewardBalance()

    expect(initialReward).to.eq(0)
    expect(pool.address).to.be.a.properAddress;
  })

  describe('Stake ETH', async () => {
    it('Should fail to stake due to amount less than 1 ether', async () => {
       await expect(pool.stakeEth({ value: 0 })).to.be.reverted
    });

    it('Should stake successfully', async () => {
       await expect(pool.connect(staker).stakeEth({ value: 2, from: staker.address })).not.to.be.reverted;

       const [result] = await (pool.isStakeholder(staker.address));
       expect(result).to.be.true;

       const stakesInPool = await pool._totalStakesInPool();
       expect(stakesInPool).to.eq(2);

       const totalStakes = await pool.stakeCount();
       expect(totalStakes).to.eq(1);

       const balanceOfStakerInPool = await pool._balances(staker.address);
       expect(balanceOfStakerInPool).to.eq(2);
    })

  })


  describe('Rewards Deposit', async () => {

    

    it('should fail to deposit reward because of no access', async () => {
      await expect(pool.connect(staker).depositReward({ value: 0 })).to.be.reverted;
    })

    it('Should fail due to insufficient stake amount', async () => {
      await expect(pool.connect(deployer).depositReward({ value: 0, from: deployer.address })).to.be.revertedWith(
        'Insufficient stake amount',
      )
    })



   

    it('Should deposit reward', async () => {

      await pool.connect(staker).stakeEth({ value: 1500, from: staker.address })
      await pool.connect(staker2).stakeEth({ value: 500, from: staker2.address })

      const totalStakes = await pool._totalStakesInPool()
      expect(totalStakes).to.be.eq(2000)

      const [initialReward] = await pool.getStake(staker.address);

      await expect(pool.connect(deployer).depositReward({ value: 800, from: deployer.address })).to.emit(pool, 'RewardDeposited').withArgs( 800, deployer.address)


      const [postReward] = await pool.getStake(staker.address)
      expect(postReward).to.be.eq(600)

      const [postRewardStaker2] = await pool.getStake(staker2.address)
      expect(postRewardStaker2).to.be.eq(200)
      
    })
  });

  
})
