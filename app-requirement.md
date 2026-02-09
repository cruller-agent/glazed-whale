Create a script that will be used to continuously monitor the Franchiser token 0x9310aF2707c458F52e1c4D48749433454D731060 ([https://github.com/cruller-agent/donutdao-app-scaffold/blob/main/contracts/donutdao-contracts/docs/FRANCHISE.md](https://github.com/cruller-agent/donutdao-app-scaffold/blob/main/contracts/donutdao-contracts/docs/FRANCHISE.md)) and start mining (through an intermediary smart contract) once the mining price reaches a set value or it is profitable. This is a value that can be upgraded by the owner of the contract. 

There will be 2 modules to this application. 

1. The script that will monitor and perform actions on the smart contract (controller) which will call the franchiser token contract.  
2. The controller will hold the ETH and will be controlled by the script in order to perform actions.   
   1. All of the config values for the script should be in the smart contract.  
   2. The controller will have two main access roles. (manager and owner)  
   3. The owner is the only one who can withdraw tokens and ETH from the contract  
   4. Manager (which will be controlled by the script) can trigger the functions that will mint new tokens. 