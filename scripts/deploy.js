const hre = require("hardhat");

const { encryptDataField } = require("@swisstronik/utils");

// Function to send a shielded transaction using the provided signer, destination, data, and value
const sendShieldedTransaction = async (signer, destination, data, value) => {
    // Get the RPC link from the network configuration
    const rpcLink = hre.network.config.url;

    // Encrypt transaction data
    const [encryptedData] = await encryptDataField(rpcLink, data);

    // Construct and sign transaction with encrypted data
    return await signer.sendTransaction({
        from: signer.address,
        to: destination,
        data: encryptedData,
        value,
    });
};

async function main() {
    const [owner] = await hre.ethers.getSigners();
    console.log("Deployer:", owner.address);

    // deploy Swisstronik
    const swisstronikContract = await hre.ethers.deployContract("Swisstronik", [
        owner.address,
    ]);
    await swisstronikContract.waitForDeployment();
    console.log(
        "Contract Swisstronik deployed to:",
        swisstronikContract.target
    );

    // deploy proxy admin
    const ProxyAdminFactory = await hre.ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdminFactory.deploy(owner.address);
    await proxyAdmin.waitForDeployment();
    console.log("ProxyAdmin address deployed to:", proxyAdmin.target);

    // deploy proxy
    const TransparentUpgradeableProxy = await hre.ethers.getContractFactory(
        "TransparentUpgradeableProxy"
    );
    const proxy = await TransparentUpgradeableProxy.deploy(
        swisstronikContract.target,
        proxyAdmin.target,
        Uint8Array.from([])
    );

    console.log(`Proxy contract address: ${proxy.target}`);

    // contract 2
    const Swisstronik2Factory = await hre.ethers.getContractFactory(
        "Swisstronik2"
    );
    const swisstronik2Contract = await Swisstronik2Factory.deploy();
    await swisstronik2Contract.waitForDeployment();
    console.log(
        `Contract Swisstronik 2 deployed to: ${swisstronik2Contract.target}`
    );

    // upgrade
    const upgrade = await sendShieldedTransaction(
        owner,
        proxyAdmin.target,
        proxyAdmin.interface.encodeFunctionData("upgradeAndCall", [
            proxy.target,
            swisstronik2Contract.target,
            Uint8Array.from([]),
        ]),
        0
    );
    await upgrade.wait();

    console.log(
        `Response: https://explorer-evm.testnet.swisstronik.com/tx/${upgrade.hash}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
