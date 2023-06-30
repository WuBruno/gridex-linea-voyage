import { JsonRpcProvider, ethers } from "ethers";
import {
  OrderType,
  PUBLIC_PROVIDER,
  getMakerOrders,
  getMostRecentBlockMaker,
  getMostRecentBlockSwap,
  getSwapEvents,
  getUniqueAddressOrderType,
  getUniqueEventAddresses,
} from ".";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function syncSwapEvents(provider: JsonRpcProvider) {
  const currentBlock = await provider.getBlockNumber();
  const mostRecentBlock = (await getMostRecentBlockSwap()) + 1;
  const swapEvents = await getSwapEvents(
    provider,
    mostRecentBlock,
    currentBlock
  );
  const swapAddresses = await getUniqueAddressOrderType(OrderType.Swap);
  const newAddresses = Array.from(getUniqueEventAddresses(swapEvents)).filter(
    (address) => !swapAddresses.has(address)
  );

  console.log("Swap event count", swapEvents.length);
  console.log("New swap addresses", newAddresses.length);

  await prisma.$transaction(
    swapEvents.map((swap) =>
      prisma.order.upsert({
        create: {
          hash: swap.transactionHash,
          address: swap.args[1],
          block: swap.blockNumber,
          type: OrderType.Swap,
        },
        update: {},
        where: {
          hash: swap.transactionHash,
        },
      })
    )
  );
  console.log(
    "Swap Addresses Complete",
    getUniqueEventAddresses(swapEvents).size
  );
}

async function syncMakerEvents(provider: JsonRpcProvider) {
  const currentBlock = await provider.getBlockNumber();
  const mostRecentBlock = (await getMostRecentBlockMaker()) + 1;

  const { makerOrders, batchOrders, relativeOrders } = await getMakerOrders(
    provider,
    mostRecentBlock,
    currentBlock
  );

  console.log("Maker event count", makerOrders.length);
  console.log("Batch event count", batchOrders.length);
  console.log("Relative event count", relativeOrders.length);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(PUBLIC_PROVIDER, 59140);

  console.log("SWAP ---------");
  await syncSwapEvents(provider);
  console.log("MAKERS ---------");
  await syncMakerEvents(provider);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
