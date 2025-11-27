export const CONTRACT_ADDRESS = '0x4326aA3a5a0D6Ea77a8a5463BBCF337510d66C8D' as `0x${string}`;
export const POINTS_PER_ETH = 1000;
export const ROUND_REWARD = 10;

export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "DepositTooSmall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PointsOverflow",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZamaProtocolUnsupported",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "depositedWei",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "pointsMinted",
        "type": "uint64"
      }
    ],
    "name": "PointsPurchased",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "diceOne",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "diceTwo",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "total",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "guessedBig",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "wasCorrect",
        "type": "bytes32"
      }
    ],
    "name": "RoundPlayed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "POINTS_PER_ETH",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "ROUND_REWARD",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "confidentialProtocolId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "contractBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getEncryptedBalance",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getLastError",
    "outputs": [
      {
        "components": [
          {
            "internalType": "euint8",
            "name": "code",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultWagerGame.LastError",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getLastRound",
    "outputs": [
      {
        "components": [
          {
            "internalType": "euint8",
            "name": "diceOne",
            "type": "bytes32"
          },
          {
            "internalType": "euint8",
            "name": "diceTwo",
            "type": "bytes32"
          },
          {
            "internalType": "euint8",
            "name": "total",
            "type": "bytes32"
          },
          {
            "internalType": "ebool",
            "name": "guessedBig",
            "type": "bytes32"
          },
          {
            "internalType": "ebool",
            "name": "wasCorrect",
            "type": "bytes32"
          }
        ],
        "internalType": "struct VaultWagerGame.RoundResult",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bool",
        "name": "guessBig",
        "type": "bool"
      }
    ],
    "name": "playRound",
    "outputs": [
      {
        "components": [
          {
            "internalType": "euint8",
            "name": "diceOne",
            "type": "bytes32"
          },
          {
            "internalType": "euint8",
            "name": "diceTwo",
            "type": "bytes32"
          },
          {
            "internalType": "euint8",
            "name": "total",
            "type": "bytes32"
          },
          {
            "internalType": "ebool",
            "name": "guessedBig",
            "type": "bytes32"
          },
          {
            "internalType": "ebool",
            "name": "wasCorrect",
            "type": "bytes32"
          }
        ],
        "internalType": "struct VaultWagerGame.RoundResult",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "purchasePoints",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;
