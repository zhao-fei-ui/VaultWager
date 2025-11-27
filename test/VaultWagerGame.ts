import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { VaultWagerGame, VaultWagerGame__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("VaultWagerGame")) as VaultWagerGame__factory;
  const contract = (await factory.deploy()) as VaultWagerGame;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("VaultWagerGame (local FHE mock)", function () {
  let signers: Signers;
  let contract: VaultWagerGame;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This hardhat test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("returns uninitialized handles before deposits", async function () {
    const encryptedBalance = await contract.getEncryptedBalance(signers.alice.address);
    expect(encryptedBalance).to.eq(ethers.ZeroHash);
  });

  it("mints 1000 points for each whole ETH deposited", async function () {
    const tx = await contract.connect(signers.alice).purchasePoints({ value: ethers.parseEther("1") });
    await tx.wait();

    const encryptedBalance = await contract.getEncryptedBalance(signers.alice.address);
    expect(encryptedBalance).to.not.eq(ethers.ZeroHash);

    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      contractAddress,
      signers.alice,
    );
    expect(clearBalance).to.eq(1000n);
  });

  it("plays a full round and updates encrypted round metadata", async function () {
    await contract.connect(signers.alice).purchasePoints({ value: ethers.parseEther("1") });
    const encryptedBalanceBefore = await contract.getEncryptedBalance(signers.alice.address);
    const balanceBefore = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalanceBefore,
      contractAddress,
      signers.alice,
    );

    await contract.connect(signers.alice).playRound(true);

    const encryptedBalanceAfter = await contract.getEncryptedBalance(signers.alice.address);
    const balanceAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalanceAfter,
      contractAddress,
      signers.alice,
    );

    const round = await contract.getLastRound(signers.alice.address);
    expect(round.diceOne).to.not.eq(ethers.ZeroHash);

    const [diceOne, diceTwo, total] = await Promise.all([
      fhevm.userDecryptEuint(FhevmType.euint8, round.diceOne, contractAddress, signers.alice),
      fhevm.userDecryptEuint(FhevmType.euint8, round.diceTwo, contractAddress, signers.alice),
      fhevm.userDecryptEuint(FhevmType.euint8, round.total, contractAddress, signers.alice),
    ]);
    const guessedBig = await fhevm.userDecryptEbool(round.guessedBig, contractAddress, signers.alice);
    const wasCorrect = await fhevm.userDecryptEbool(round.wasCorrect, contractAddress, signers.alice);

    expect(diceOne).to.be.gte(1n).and.to.be.lte(6n);
    expect(diceTwo).to.be.gte(1n).and.to.be.lte(6n);
    expect(total).to.eq(diceOne + diceTwo);
    expect(guessedBig).to.eq(true);

    if (wasCorrect) {
      expect(balanceAfter).to.eq(balanceBefore + 10n);
    } else {
      expect(balanceAfter).to.eq(balanceBefore - 10n);
    }

    const lastError = await contract.getLastError(signers.alice.address);
    if (lastError.code !== ethers.ZeroHash) {
      const decryptedError = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        lastError.code,
        contractAddress,
        signers.alice,
      );
      expect(decryptedError === 0n || decryptedError === 1n).to.eq(true);
    }
  });
});
