import { JsonRpcProvider, ethers } from "ethers";
import {
  OrderType,
  PUBLIC_PROVIDER,
  getMakerOrders,
  getMostRecentBlockMaker,
  getMostRecentBlockSwap,
  getSwapEvents,
  getUniqueAddressOrderType,
  getUniqueOrderAddresses,
} from ".";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DATE_BLOCKS = {
  26: 997063,
  27: 1003898,
  28: 1011066,
  29: 1018263,
};

const EVENT_START_BLOCK = DATE_BLOCKS[26];

async function syncSwapEvents(provider: JsonRpcProvider) {
  const currentBlock = await provider.getBlockNumber();
  const mostRecentBlock = (await getMostRecentBlockSwap()) + 1;
  const swapEvents = await getSwapEvents(
    provider,
    mostRecentBlock,
    currentBlock
  );
  const swapAddresses = await getUniqueAddressOrderType(OrderType.Swap);
  const newAddresses = Array.from(getUniqueOrderAddresses(swapEvents)).filter(
    (address) => !swapAddresses.has(address)
  );

  console.log("Swap event count", swapEvents.length);
  console.log("New swap addresses", newAddresses.length);

  await prisma.$transaction(
    swapEvents.map((swap) =>
      prisma.order.upsert({
        create: {
          hash: swap.hash,
          address: swap.address,
          block: swap.block,
          type: OrderType.Swap,
        },
        update: {
          address: swap.address,
        },
        where: {
          hash: swap.hash,
        },
      })
    )
  );
}

async function syncMakerEvents(provider: JsonRpcProvider) {
  const currentBlock = await provider.getBlockNumber();
  const mostRecentBlock = (await getMostRecentBlockMaker()) + 1;

  const { makerOrders, batchOrders, relativeOrders } = await getMakerOrders(
    provider,
    EVENT_START_BLOCK,
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
