import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

const CONTRACT_NAME = "VaultWagerGame";

task("game:address", "Prints the deployed VaultWagerGame address").setAction(async (_args, hre) => {
  const deployment = await hre.deployments.get(CONTRACT_NAME);
  console.log(`${CONTRACT_NAME} address: ${deployment.address}`);
});

task("game:deposit", "Converts ETH into VaultWager points")
  .addParam("eth", "ETH amount to deposit, e.g. 0.25")
  .addOptionalParam("address", "Override the contract address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers } = hre;
    const target = taskArguments.address ? { address: taskArguments.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, target.address);
    const value = ethers.parseEther(taskArguments.eth as string);

    console.log(`Depositing ${taskArguments.eth} ETH from ${signer.address}...`);
    const tx = await contract.connect(signer).purchasePoints({ value });
    const receipt = await tx.wait();
    console.log(`purchasePoints tx hash: ${tx.hash} status=${receipt?.status}`);
  });

task("game:play", "Plays a VaultWager round with the selected guess")
  .addParam("guess", "Either 'big' or 'small'")
  .addOptionalParam("address", "Override the contract address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers } = hre;
    const target = taskArguments.address ? { address: taskArguments.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, target.address);

    const guessNormalized = (taskArguments.guess as string).toLowerCase();
    const guessBig = guessNormalized !== "small";

    console.log(`Calling playRound(${guessBig ? "Big" : "Small"}) as ${signer.address}...`);
    const tx = await contract.connect(signer).playRound(guessBig);
    const receipt = await tx.wait();
    console.log(`playRound tx hash: ${tx.hash} status=${receipt?.status}`);
  });

task("game:balance", "Decrypts and prints the VaultWager balance for a player")
  .addOptionalParam("player", "Player address (defaults to signer 0)")
  .addOptionalParam("address", "Override the contract address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const target = taskArguments.address ? { address: taskArguments.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const player = (taskArguments.player as string | undefined) ?? signer.address;
    const contract = await ethers.getContractAt(CONTRACT_NAME, target.address);

    const encryptedBalance = await contract.getEncryptedBalance(player);

    if (encryptedBalance === ethers.ZeroHash) {
      console.log(`Player ${player} has not purchased points yet (encrypted balance is 0x0)`);
      return;
    }

    const balance = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalance, target.address, signer);
    console.log(`Decrypted balance for ${player}: ${balance.toString()} points`);
  });

task("game:round", "Decrypts the latest round metadata for a player")
  .addOptionalParam("player", "Player address (defaults to signer 0)")
  .addOptionalParam("address", "Override the contract address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const target = taskArguments.address ? { address: taskArguments.address as string } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const player = (taskArguments.player as string | undefined) ?? signer.address;
    const contract = await ethers.getContractAt(CONTRACT_NAME, target.address);

    const round = await contract.getLastRound(player);
    if (round.diceOne === ethers.ZeroHash) {
      console.log(`Player ${player} has not played a round yet`);
      return;
    }

    const [diceOne, diceTwo, total] = await Promise.all([
      fhevm.userDecryptEuint(FhevmType.euint8, round.diceOne, target.address, signer),
      fhevm.userDecryptEuint(FhevmType.euint8, round.diceTwo, target.address, signer),
      fhevm.userDecryptEuint(FhevmType.euint8, round.total, target.address, signer),
    ]);
    const guessedBig = await fhevm.userDecryptEbool(round.guessedBig, target.address, signer);
    const wasCorrect = await fhevm.userDecryptEbool(round.wasCorrect, target.address, signer);

    const lastError = await contract.getLastError(player);
    let errorCode = "0";
    if (lastError.code !== ethers.ZeroHash) {
      const decryptedError = await fhevm.userDecryptEuint(FhevmType.euint8, lastError.code, target.address, signer);
      errorCode = decryptedError.toString();
    }

    console.log(`Latest round for ${player}`);
    console.log(`- Dice: ${diceOne.toString()} & ${diceTwo.toString()} (total ${total.toString()})`);
    console.log(`- Guess: ${guessedBig ? "Big" : "Small"} | Correct: ${wasCorrect}`);
    console.log(`- Error code: ${errorCode} at timestamp ${lastError.timestamp.toString()}`);
  });
