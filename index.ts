import { EventLog, JsonRpcApiProvider, ethers } from "ethers";
import * as Grid from "./abi/Grid.json";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
require("dotenv").config();

const prisma = new PrismaClient();

const GRID_ADDRESS = "0xCF3D9B1793F6714C2c5ec68c7641d13F514eEd55";
const GRID2_ADDRESS = "0x5984FE9Fb63be89B11D701E64016C77108a3a2C8";
const MAKER_ORDER_MANAGER = "0x36E56CC52d7A0Af506D1656765510cd930fF1595";

export async function getUniqueAddressOrderType(orderType: OrderType) {
  const addresses = await prisma.order.findMany({
    select: {
      address: true,
    },
    where: {
      type: orderType,
    },
  });
  return new Set(addresses.map((address) => address.address));
}

export async function getUniqueAddressOrderTypeWithBlockCumulative(
  orderType: OrderType,
  endBlock: number
) {
  const addresses = await prisma.order.findMany({
    select: {
      address: true,
    },
    where: {
      type: orderType,
      block: {
        lte: endBlock,
      },
    },
  });
  return new Set(addresses.map((address) => address.address));
}

export async function getUniqueAddressOrderTypeWithBlockInterval(
  orderType: OrderType,
  startBlock: number,
  endBlock: number
) {
  const addresses = await prisma.order.findMany({
    select: {
      address: true,
    },
    where: {
      type: orderType,
      block: {
        gte: startBlock,
        lte: endBlock,
      },
    },
  });
  return new Set(addresses.map((address) => address.address));
}

export function getMostRecentBlockSwap() {
  return prisma.order
    .findFirst({
      orderBy: {
        block: "desc",
      },
      where: {
        type: OrderType.Swap,
      },
    })
    .then((order) => order.block);
}

export function getMostRecentBlockMaker() {
  return prisma.order
    .findFirst({
      orderBy: {
        block: "desc",
      },
      where: {
        type: {
          in: [OrderType.Batch, OrderType.Maker, OrderType.Relative],
        },
      },
    })
    .then((order) => order.block);
}

export async function getClosestBlock(
  date: string,
  provider: ethers.JsonRpcProvider
) {
  const timestamp = new Date(date).getTime() / 1000;
  let minBlockNumber = 0;
  let maxBlockNumber = await provider.getBlockNumber();
  let closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
  let closestBlock = await provider.getBlock(closestBlockNumber);
  let foundExactBlock = false;

  while (minBlockNumber <= maxBlockNumber) {
    if (closestBlock.timestamp === timestamp) {
      foundExactBlock = true;
      break;
    } else if (closestBlock.timestamp > timestamp) {
      maxBlockNumber = closestBlockNumber - 1;
    } else {
      minBlockNumber = closestBlockNumber + 1;
    }

    closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
    closestBlock = await provider.getBlock(closestBlockNumber);
  }

  const previousBlockNumber = closestBlockNumber - 1;
  const previousBlock = await provider.getBlock(previousBlockNumber);
  const nextBlockNumber = closestBlockNumber + 1;
  const nextBlock = await provider.getBlock(nextBlockNumber);

  return closestBlockNumber;
}

export function getUniqueEventAddresses(events: EventLog[]) {
  return new Set(events.map((event) => event.args[1]));
}

export function getUniqueOrderAddresses(events: Order[]) {
  return new Set(events.map((event) => event.address));
}

export async function getSwapEvents(
  provider: JsonRpcApiProvider,
  blockStart?: number,
  blockEnd?: number
) {
  const gridContract = new ethers.Contract(GRID_ADDRESS, Grid.abi, provider);
  const gridContract2 = new ethers.Contract(GRID2_ADDRESS, Grid.abi, provider);

  const events = await adjustableQueryFilter(
    gridContract,
    gridContract.filters.Swap(),
    blockStart,
    blockEnd
  );
  const events2 = await adjustableQueryFilter(
    gridContract2,
    gridContract2.filters.Swap(),
    blockStart,
    blockEnd
  );
  return [...events, ...events2];
}

export async function getMakerOrderEvents(
  provider: JsonRpcApiProvider,
  blockStart: number,
  blockEnd: number
) {
  const gridContract = new ethers.Contract(GRID_ADDRESS, Grid.abi, provider);
  const gridContract2 = new ethers.Contract(GRID2_ADDRESS, Grid.abi, provider);

  return [
    ...(await adjustableQueryFilter(
      gridContract,
      gridContract.filters.PlaceMakerOrder(),
      blockStart,
      blockEnd
    )),
    ...(await adjustableQueryFilter(
      gridContract2,
      gridContract2.filters.PlaceMakerOrder(),
      blockStart,
      blockEnd
    )),
  ];
}

export async function adjustableQueryFilter(
  contract: ethers.Contract,
  filter: ethers.DeferredTopicFilter,
  blockStart: number,
  blockEnd: number
): Promise<EventLog[]> {
  try {
    console.log("querying", blockStart, blockEnd);
    const results = (await contract.queryFilter(
      filter,
      blockStart,
      blockEnd
    )) as unknown as EventLog[];
    return results;
  } catch (error) {
    if (error?.error?.code === -32005) {
      const blockAmount = blockEnd - blockStart;
      const mid = blockStart + Math.floor(blockAmount / 2);
      return [
        ...(await adjustableQueryFilter(contract, filter, blockStart, mid)),
        ...(await adjustableQueryFilter(contract, filter, mid + 1, blockEnd)),
      ];
    }
    console.log(error);
  }
}

export const RELATIVE_ORDER_HASH = "0xc23e3b38";
export const BATCH_ORDER_HASH = "0xa6fcb341";
export const MAKER_ORDER_HASH = "0x42d95cc7";

export enum OrderType {
  Maker = "Maker",
  Batch = "Batch",
  Relative = "Relative",
  Unknown = "Unknown",
  Swap = "Swap",
}

export type Order = {
  address: string;
  orderType: OrderType;
  hash: string;
  block: number;
};

export async function classifyMakerOrder(event: EventLog): Promise<Order> {
  const txn = await event.getTransaction();
  event.blockNumber;

  let orderType = OrderType.Unknown;
  if (txn.data.startsWith(MAKER_ORDER_HASH)) {
    orderType = OrderType.Maker;
  } else if (txn.data.startsWith(BATCH_ORDER_HASH)) {
    orderType = OrderType.Batch;
  } else if (txn.data.startsWith(RELATIVE_ORDER_HASH)) {
    orderType = OrderType.Relative;
  }

  return {
    hash: txn.hash,
    address: event.args[1],
    block: txn.blockNumber,
    orderType,
  };
}

export async function getMakerOrders(
  provider: JsonRpcApiProvider,
  blockStart: number,
  blockEnd: number
) {
  const makerOrderEvents = await getMakerOrderEvents(
    provider,
    blockStart,
    blockEnd
  );
  console.log(makerOrderEvents.length);
  const orders = await Promise.all(makerOrderEvents.map(classifyMakerOrder));
  await prisma.$transaction(
    orders.map((order) =>
      prisma.order.upsert({
        create: {
          hash: order.hash,
          address: order.address,
          block: order.block,
          type: order.orderType,
        },
        update: {},
        where: {
          hash: order.hash,
        },
      })
    )
  );
  const makerOrders = orders.filter(
    (order) => order.orderType === OrderType.Maker
  );
  const batchOrders = orders.filter(
    (order) => order.orderType === OrderType.Batch
  );
  const relativeOrders = orders.filter(
    (order) => order.orderType === OrderType.Relative
  );
  const unknownOrder = orders.filter(
    (order) => order.orderType === OrderType.Unknown
  );

  console.log(
    "Maker Order Addresses",
    getUniqueOrderAddresses(makerOrders).size
  );
  console.log(
    "Batch Order Addresses",
    getUniqueOrderAddresses(batchOrders).size
  );
  console.log(
    "Relative Order Addresses",
    getUniqueOrderAddresses(relativeOrders).size
  );
  console.log(
    "Unkown Order Addresses",
    getUniqueOrderAddresses(unknownOrder).size
  );

  return {
    makerOrders,
    batchOrders,
    relativeOrders,
  };
}

export enum TASK_IDS {
  SWAP = "294483983094947840",
  MAKER = "294486182093037568",
  ADVANCED = "294488445817626624",
}

export async function updateTaskReplace(credId: TASK_IDS, addresses: String[]) {
  const operation = "REPLACE";

  const res = await axios.post(
    "https://graphigo.prd.galaxy.eco/query",
    {
      operationName: "credentialItems",
      query: `
      mutation credentialItems($credId: ID!, $operation: Operation!, $items: [String!]!) 
        { 
          credentialItems(input: { 
            credId: $credId 
            operation: $operation 
            items: $items 
          }) 
          { 
            name 
          } 
        }
      `,
      variables: {
        // Make sure this is string type as int might cause overflow
        credId: credId.toString(),
        operation: operation,
        items: addresses,
      },
    },
    {
      headers: {
        "access-token": process.env.GALXE_ACCESS_TOKEN,
      },
    }
  );
  console.log(res.status);
  return res;
}

export async function updateTasks(credId: TASK_IDS, addresses: String[]) {
  const operation = "APPEND";

  const res = await axios.post(
    "https://graphigo.prd.galaxy.eco/query",
    {
      operationName: "credentialItems",
      query: `
      mutation credentialItems($credId: ID!, $operation: Operation!, $items: [String!]!) 
        { 
          credentialItems(input: { 
            credId: $credId 
            operation: $operation 
            items: $items 
          }) 
          { 
            name 
          } 
        }
      `,
      variables: {
        // Make sure this is string type as int might cause overflow
        credId: credId.toString(),
        operation: operation,
        items: addresses,
      },
    },
    {
      headers: {
        "access-token": process.env.GALXE_ACCESS_TOKEN,
      },
    }
  );
  console.log(res.status);
  return res;
}

export async function processSwapEvents(
  provider: JsonRpcApiProvider,
  blockStart: number,
  blockEnd: number
) {
  const swapEvents = await getSwapEvents(provider, blockStart, blockEnd);
  const swapAddresses = await getUniqueAddressOrderType(OrderType.Swap);
  const newAddresses = Array.from(getUniqueEventAddresses(swapEvents)).filter(
    (address) => !swapAddresses.has(address)
  );

  await updateTasks(TASK_IDS.SWAP, newAddresses);
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

export async function getHistoricalOrderStats(
  blockStart: number,
  blockEnd: number
) {
  const currentSwapAddresses = await getUniqueAddressOrderTypeWithBlockInterval(
    OrderType.Swap,
    blockStart,
    blockEnd
  );
  const pastSwapAddresses = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Swap,
    blockStart - 1
  );
  const newSwapAddresses = Array.from(currentSwapAddresses).filter(
    (address) => !pastSwapAddresses.has(address)
  );
  console.log("New Swap Addresses", newSwapAddresses.length);

  const currentMakerAddresses =
    await getUniqueAddressOrderTypeWithBlockInterval(
      OrderType.Maker,
      blockStart,
      blockEnd
    );
  const pastMakerAddresses = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Maker,
    blockStart - 1
  );
  const newMakerAddresses = Array.from(currentMakerAddresses).filter(
    (address) => !pastMakerAddresses.has(address)
  );
  console.log("New Maker Addresses", newMakerAddresses.length);

  const currentBatchAddresses =
    await getUniqueAddressOrderTypeWithBlockInterval(
      OrderType.Batch,
      blockStart,
      blockEnd
    );
  const pastBatchAddresses = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Batch,
    blockStart - 1
  );
  const newBatchAddresses = Array.from(currentBatchAddresses).filter(
    (address) => !pastBatchAddresses.has(address)
  );
  console.log("New Batch Addresses", newBatchAddresses.length);

  const currentRelativeAddresses =
    await getUniqueAddressOrderTypeWithBlockInterval(
      OrderType.Relative,
      blockStart,
      blockEnd
    );
  const pastRelativeAddresses =
    await getUniqueAddressOrderTypeWithBlockCumulative(
      OrderType.Relative,
      blockStart - 1
    );
  const newRelativeAddresses = Array.from(currentRelativeAddresses).filter(
    (address) => !pastRelativeAddresses.has(address)
  );
  console.log("New Relative Addresses", newRelativeAddresses.length);
}

export async function processMakerOrders(
  provider: JsonRpcApiProvider,
  blockStart: number,
  blockEnd: number
) {
  const { makerOrders, batchOrders, relativeOrders } = await getMakerOrders(
    provider,
    blockStart,
    blockEnd
  );
  const maker = getUniqueOrderAddresses(makerOrders);
  const pastMakerAddresses = await getUniqueAddressOrderType(OrderType.Maker);
  const newMakerAddresses = Array.from(maker).filter(
    (address) => !pastMakerAddresses.has(address)
  );

  await updateTasks(TASK_IDS.MAKER, newMakerAddresses);
  console.log("All Maker Addresses Complete:", maker.size);
  console.log("New Maker Addresses Complete: ", newMakerAddresses.length);

  const pastBatch = await getUniqueAddressOrderType(OrderType.Batch);
  const pastRelative = await getUniqueAddressOrderType(OrderType.Relative);
  const pastBoth = new Set([
    ...Array.from(pastBatch),
    ...Array.from(pastRelative),
  ]);

  const newBatch = new Set(
    [...getUniqueOrderAddresses(batchOrders)].filter(
      (address) => !pastBoth.has(address)
    )
  );
  const newRelative = new Set(
    [...getUniqueOrderAddresses(relativeOrders)].filter(
      (address) => !pastBoth.has(address)
    )
  );
  const newComplete = new Set([
    ...[...newBatch].filter((x) => pastRelative.has(x) || newRelative.has(x)),
    ...[...newRelative].filter((x) => pastBatch.has(x) || newBatch.has(x)),
  ]);

  await updateTasks(TASK_IDS.ADVANCED, Array.from(newComplete));
  console.log("New Relative Addresses Complete", newRelative.size);
  console.log("New Batch Addresses Complete", newBatch.size);
  console.log("Advanced Order Addresses Complete", newComplete.size);
}

export async function updateMakerOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const mostRecentBlock = (await getMostRecentBlockMaker()) + 1;
  await processMakerOrders(provider, mostRecentBlock, currentBlock);
}

export async function updateSwapOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const mostRecentBlock = (await getMostRecentBlockSwap()) + 1;
  await processSwapEvents(provider, mostRecentBlock, currentBlock);
}

export async function updateAllAdvancedOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const batch = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Batch,
    currentBlock
  );
  const relative = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Relative,
    currentBlock
  );
  const both = [...batch].filter((x) => relative.has(x));
  await updateTasks(TASK_IDS.ADVANCED, both);
  console.log("Advanced Order Addresses Complete", both.length);
}

export async function updateAllMakerOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const addresses = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Maker,
    currentBlock
  );
  await updateTasks(TASK_IDS.MAKER, [...addresses]);
  console.log("Maker Addresses Complete", addresses.size);
}

export async function updateAllSwapOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const addresses = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Maker,
    currentBlock
  );
  await updateTasks(TASK_IDS.SWAP, [...addresses]);
  console.log("Swap Addresses Complete", addresses.size);
}

export const PUBLIC_PROVIDER = "https://rpc.goerli.linea.build";

async function main() {
  const provider = new ethers.JsonRpcProvider(PUBLIC_PROVIDER, 59140);

  const currentBlock = await provider.getBlockNumber();

  const DATE_BLOCKS = {
    26: 997063,
    27: 1003898,
    28: 1011066,
    29: 1018263,
  };
  const EVENT_START_BLOCK = DATE_BLOCKS[26];

  // console.log("SWAP ---------");
  // await updateSwapOrders(provider);
  // console.log("MAKERS ---------");
  // await updateMakerOrders(provider);

  console.log("ALL ADVANCED ---------");
  await updateAllAdvancedOrders(provider);
  console.log("ALL MAKER ---------");
  await updateAllMakerOrders(provider);
  console.log("ALL SWAP ---------");
  await updateAllSwapOrders(provider);
}

async function correctAdvancedOrders(provider: JsonRpcApiProvider) {
  const currentBlock = await provider.getBlockNumber();
  const batch = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Batch,
    currentBlock
  );
  const relative = await getUniqueAddressOrderTypeWithBlockCumulative(
    OrderType.Relative,
    currentBlock
  );
  const both = [...batch].filter((x) => relative.has(x));

  await updateTaskReplace(TASK_IDS.ADVANCED, Array.from(both));
}

// main()
//   .then(async () => {
//     await prisma.$disconnect();
//   })
//   .catch(async (e) => {
//     console.error(e);
//     await prisma.$disconnect();
//     process.exit(1);
//   });
