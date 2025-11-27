import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedGame = await deploy("VaultWagerGame", {
    from: deployer,
    log: true,
  });

  console.log(`VaultWagerGame contract deployed at ${deployedGame.address}`);
};
export default func;
func.id = "deploy_vaultWager"; // id required to prevent reexecution
func.tags = ["VaultWagerGame"];
