// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;
import "hardhat/console.sol";

import "./lib/SafeMath.sol";

contract ETHPool {

  using SafeMath for uint256;

  mapping (address => bool) isTeamMember;
  
  mapping(address => Stake) internal stakes;

  uint256 public stakeCount;


  struct Stake {
     address user;
     uint256 amount;
     uint256 createdAt;
     bool isValid;
     uint256 withdrawalAt;
     uint256 updatedAt;
     uint256 reward;
     uint256 id;
  }

  address[] internal stakeholders;

  Stake[] public pool;

  uint256 public rewardBalance; // total reward left unclaimed

  mapping(address => uint256) public _balances; // track stake of an addrrss

  uint256 public _totalStakesInPool; // total stakes in the pool


  modifier _onlyTeam(){
    require(isTeamMember[msg.sender],"You must be a team member");
    _;
  }


  event Staked(uint amount,address address_);
  event RewardDeposited(uint amount,address teamMember);


  constructor(){
    isTeamMember[msg.sender] = true;
  }

  receive() payable external {
        uint256 amount = msg.value;
        rewardBalance += amount;
  }


  function depositReward() external _onlyTeam payable{

    require(msg.value > 0 wei, "Insufficient stake amount");
    rewardBalance = rewardBalance.add(msg.value);
    // loop through all valid stakers and add bonus;

    for (uint index = 0; index < stakeholders.length; index++) {
      address userAddress = stakeholders[index];
      Stake storage currentStake = stakes[userAddress];

      if(currentStake.isValid){
        // calculate percentage of stake in pool;

        uint reward;

        if(currentStake.amount % _totalStakesInPool > 0){

         uint percentage = currentStake.amount * 100 / _totalStakesInPool;

          if(percentage % 100 == 0){
            
            reward = percentage / 100 * rewardBalance;
          } else {

            reward = (percentage  * rewardBalance) / 100;
          }
        } else {
            uint percentage = (currentStake.amount / _totalStakesInPool).mul(100);
            if(percentage % 100 > 0){
              reward = (percentage  * rewardBalance) / 100;
            } else {
              reward = percentage.div(100).mul(rewardBalance);
            }

        }

        currentStake.reward = reward;
        currentStake.updatedAt = block.timestamp;
      }
    }

    emit RewardDeposited(msg.value, msg.sender);
    
  }

  function withdrawStake(uint amount) external payable returns(bool){ 

      require(amount > 0 wei, "Send a valid amount to deposit");
      
      Stake storage currentStake = stakes[msg.sender];

      if(currentStake.isValid){
        uint rewardPercent = amount * 100 / currentStake.amount;
        uint reward = rewardPercent * currentStake.reward / 100;
        uint totalFunds = reward + amount;
        
        (bool sent, ) = payable(msg.sender).call{value: totalFunds}("");
        require(sent, "Failed to send Ether");
        currentStake.reward = currentStake.reward - reward;
        currentStake.amount = currentStake.amount - amount;
        currentStake.isValid = currentStake.amount > 0;

        _balances[msg.sender] = currentStake.amount;
        rewardBalance = rewardBalance - reward;
        _totalStakesInPool = _totalStakesInPool - amount;
        return true;
      } return false;
  }

  function stakeEth() external  payable {
      uint256 amount = msg.value;

      require(amount > 0 wei, "Send a valid amount to deposit");
      
      uint256 currentTimestamp = block.timestamp;

      Stake storage currentStake = stakes[msg.sender];

      if(currentStake.isValid){

        // add more to the existing stake;
          _balances[msg.sender] = _balances[msg.sender].add(amount);
          _totalStakesInPool = _totalStakesInPool.add(amount);

            currentStake.amount = currentStake.amount.add(amount);
            currentStake.updatedAt = currentTimestamp;
            stakeCount++;
            emit Staked(amount, msg.sender);

      } else {
            

            _balances[msg.sender] = _balances[msg.sender].add(amount);
            _totalStakesInPool = _totalStakesInPool.add(amount);
            
            addStakeholder(msg.sender);

            uint id = stakeCount.add(1);
            currentStake.amount = amount;
            currentStake.createdAt = currentTimestamp;
            currentStake.isValid = true;
            currentStake.reward = 0;
            currentStake.user = msg.sender;
            currentStake.id = id;

            stakeCount = id;

            emit Staked(amount, msg.sender);
      }
  }

  function getReward(address _address) public view returns(uint256) {
  
      require(_address == address(_address), "Invalid address");

      Stake storage currentStake = stakes[_address];

      require(currentStake.isValid, "No valid stake for address");
      for (uint256 s = 0; s < stakeholders.length; s += 1) {
            if (_address == stakeholders[s]) return (stakes[stakeholders[s]].reward);
      }
  }

  function getStake(address _address) public view returns(uint,uint,bool,uint){
     require(_address == address(_address), "Invalid address");

      Stake storage currentStake = stakes[_address];

      require(currentStake.isValid, "No valid stake for address");
      return (currentStake.reward, currentStake.amount,currentStake.isValid,
      currentStake.updatedAt);
  }

   function addStakeholder(address _stakeholder) internal {
        (bool _isStakeholder,) = isStakeholder(_stakeholder);
        if (!_isStakeholder) stakeholders.push(_stakeholder);
    }


    function removeStakeholder(address _stakeholder) internal {
        (bool _isStakeholder, uint256 s) = isStakeholder(_stakeholder);
        if (_isStakeholder) {
            stakeholders[s] = stakeholders[stakeholders.length - 1];
            stakeholders.pop();
            Stake storage stake = stakes[_stakeholder];
            stake.isValid = false;
        }
    }

    function isStakeholder(address _address) public view returns (bool, uint256) {
        for (uint256 s = 0; s < stakeholders.length; s += 1) {
            if (_address == stakeholders[s]) return (true, s);
        }
        return (false, 0);
    }

//   function isContract(address _a) internal view returns (bool) {
//   uint size;
//   assembly {
//     size := extcodesize(_a)
//   }
//   return size > 0;
//  }


}



// Questions: Can a team member also participate in the pool?
// Are contracts allowed to participate in the pool?