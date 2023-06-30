"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const Grid = __importStar(require("./abi/Grid.json"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
require("dotenv").config();
const prisma = new client_1.PrismaClient();
const GRID_ADDRESS = "0xCF3D9B1793F6714C2c5ec68c7641d13F514eEd55";
const GRID2_ADDRESS = "0x5984FE9Fb63be89B11D701E64016C77108a3a2C8";
const MAKER_ORDER_MANAGER = "0x36E56CC52d7A0Af506D1656765510cd930fF1595";
function getUniqueAddressOrderType(orderType) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield prisma.order.findMany({
            select: {
                address: true,
            },
            where: {
                type: orderType,
            },
        });
        return new Set(addresses.map((address) => address.address));
    });
}
function getUniqueAddressOrderTypeWithBlockCumulative(orderType, endBlock) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield prisma.order.findMany({
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
    });
}
function getUniqueAddressOrderTypeWithBlockInterval(orderType, startBlock, endBlock) {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = yield prisma.order.findMany({
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
    });
}
function getMostRecentBlockSwap() {
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
function getMostRecentBlockMaker() {
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
function getClosestBlock(date, provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const timestamp = new Date(date).getTime() / 1000;
        let minBlockNumber = 0;
        let maxBlockNumber = yield provider.getBlockNumber();
        let closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
        let closestBlock = yield provider.getBlock(closestBlockNumber);
        let foundExactBlock = false;
        while (minBlockNumber <= maxBlockNumber) {
            if (closestBlock.timestamp === timestamp) {
                foundExactBlock = true;
                break;
            }
            else if (closestBlock.timestamp > timestamp) {
                maxBlockNumber = closestBlockNumber - 1;
            }
            else {
                minBlockNumber = closestBlockNumber + 1;
            }
            closestBlockNumber = Math.floor((maxBlockNumber + minBlockNumber) / 2);
            closestBlock = yield provider.getBlock(closestBlockNumber);
        }
        const previousBlockNumber = closestBlockNumber - 1;
        const previousBlock = yield provider.getBlock(previousBlockNumber);
        const nextBlockNumber = closestBlockNumber + 1;
        const nextBlock = yield provider.getBlock(nextBlockNumber);
        return closestBlockNumber;
    });
}
function getUniqueEventAddresses(events) {
    return new Set(events.map((event) => event.args[1]));
}
function getUniqueOrderAddresses(events) {
    return new Set(events.map((event) => event.address));
}
function getSwapEvents(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const gridContract = new ethers_1.ethers.Contract(GRID_ADDRESS, Grid.abi, provider);
        const gridContract2 = new ethers_1.ethers.Contract(GRID2_ADDRESS, Grid.abi, provider);
        const events = yield adjustableQueryFilter(gridContract, gridContract.filters.Swap(), blockStart, blockEnd);
        const events2 = yield adjustableQueryFilter(gridContract2, gridContract2.filters.Swap(), blockStart, blockEnd);
        return [...events, ...events2];
    });
}
function getMakerOrderEvents(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const gridContract = new ethers_1.ethers.Contract(GRID_ADDRESS, Grid.abi, provider);
        const gridContract2 = new ethers_1.ethers.Contract(GRID2_ADDRESS, Grid.abi, provider);
        return [
            ...(yield adjustableQueryFilter(gridContract, gridContract.filters.PlaceMakerOrder(), blockStart, blockEnd)),
            ...(yield adjustableQueryFilter(gridContract2, gridContract2.filters.PlaceMakerOrder(), blockStart, blockEnd)),
        ];
    });
}
function adjustableQueryFilter(contract, filter, blockStart, blockEnd) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("querying", blockStart, blockEnd);
            const results = (yield contract.queryFilter(filter, blockStart, blockEnd));
            return results;
        }
        catch (error) {
            if (((_a = error === null || error === void 0 ? void 0 : error.error) === null || _a === void 0 ? void 0 : _a.code) === -32005) {
                const blockAmount = blockEnd - blockStart;
                const mid = blockStart + Math.floor(blockAmount / 2);
                return [
                    ...(yield adjustableQueryFilter(contract, filter, blockStart, mid)),
                    ...(yield adjustableQueryFilter(contract, filter, mid + 1, blockEnd)),
                ];
            }
            console.log(error);
        }
    });
}
const RELATIVE_ORDER_HASH = "0xc23e3b38";
const BATCH_ORDER_HASH = "0xa6fcb341";
const MAKER_ORDER_HASH = "0x42d95cc7";
var OrderType;
(function (OrderType) {
    OrderType["Maker"] = "Maker";
    OrderType["Batch"] = "Batch";
    OrderType["Relative"] = "Relative";
    OrderType["Unknown"] = "Unknown";
    OrderType["Swap"] = "Swap";
})(OrderType || (OrderType = {}));
function upsertOrder(order) {
    return prisma.order.upsert({
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
    });
}
function classifyMakerOrder(event) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = yield event.getTransaction();
        event.blockNumber;
        let orderType = OrderType.Unknown;
        if (txn.data.startsWith(MAKER_ORDER_HASH)) {
            orderType = OrderType.Maker;
        }
        else if (txn.data.startsWith(BATCH_ORDER_HASH)) {
            orderType = OrderType.Batch;
        }
        else if (txn.data.startsWith(RELATIVE_ORDER_HASH)) {
            orderType = OrderType.Relative;
        }
        return {
            hash: txn.hash,
            address: event.args[1],
            block: txn.blockNumber,
            orderType,
        };
    });
}
function getMakerOrders(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const makerOrderEvents = yield getMakerOrderEvents(provider, blockStart, blockEnd);
        console.log(makerOrderEvents.length);
        const orders = yield Promise.all(makerOrderEvents.map(classifyMakerOrder));
        yield prisma.$transaction(orders.map((order) => prisma.order.upsert({
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
        })));
        const makerOrders = orders.filter((order) => order.orderType === OrderType.Maker);
        const batchOrders = orders.filter((order) => order.orderType === OrderType.Batch);
        const relativeOrders = orders.filter((order) => order.orderType === OrderType.Relative);
        const unknownOrder = orders.filter((order) => order.orderType === OrderType.Unknown);
        console.log("Maker Order Addresses", getUniqueOrderAddresses(makerOrders).size);
        console.log("Batch Order Addresses", getUniqueOrderAddresses(batchOrders).size);
        console.log("Relative Order Addresses", getUniqueOrderAddresses(relativeOrders).size);
        console.log("Unkown Order Addresses", getUniqueOrderAddresses(unknownOrder).size);
        return {
            makerOrders,
            batchOrders,
            relativeOrders,
        };
    });
}
var TASK_IDS;
(function (TASK_IDS) {
    TASK_IDS["SWAP"] = "294483983094947840";
    TASK_IDS["MAKER"] = "294486182093037568";
    TASK_IDS["ADVANCED"] = "294488445817626624";
})(TASK_IDS || (TASK_IDS = {}));
function updateTasks(credId, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const operation = "APPEND";
        const res = yield axios_1.default.post("https://graphigo.prd.galaxy.eco/query", {
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
        }, {
            headers: {
                "access-token": process.env.GALXE_ACCESS_TOKEN,
            },
        });
        console.log(res.status);
        return res;
    });
}
function processSwapEvents(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const swapEvents = yield getSwapEvents(provider, blockStart, blockEnd);
        const swapAddresses = yield getUniqueAddressOrderType(OrderType.Swap);
        const newAddresses = Array.from(getUniqueEventAddresses(swapEvents)).filter((address) => !swapAddresses.has(address));
        yield updateTasks(TASK_IDS.SWAP, newAddresses);
        console.log("Swap event count", swapEvents.length);
        console.log("New swap addresses", newAddresses.length);
        yield prisma.$transaction(swapEvents.map((swap) => prisma.order.upsert({
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
        })));
        console.log("Swap Addresses Complete", getUniqueEventAddresses(swapEvents).size);
    });
}
function getHistoricalOrderStats(blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentSwapAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Swap, blockStart, blockEnd);
        const pastSwapAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Swap, blockStart - 1);
        const newSwapAddresses = Array.from(currentSwapAddresses).filter((address) => !pastSwapAddresses.has(address));
        console.log("New Swap Addresses", newSwapAddresses.length);
        const currentMakerAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Maker, blockStart, blockEnd);
        const pastMakerAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Maker, blockStart - 1);
        const newMakerAddresses = Array.from(currentMakerAddresses).filter((address) => !pastMakerAddresses.has(address));
        console.log("New Maker Addresses", newMakerAddresses.length);
        const currentBatchAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Batch, blockStart, blockEnd);
        const pastBatchAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Batch, blockStart - 1);
        const newBatchAddresses = Array.from(currentBatchAddresses).filter((address) => !pastBatchAddresses.has(address));
        console.log("New Batch Addresses", newBatchAddresses.length);
        const currentRelativeAddresses = yield getUniqueAddressOrderTypeWithBlockInterval(OrderType.Relative, blockStart, blockEnd);
        const pastRelativeAddresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Relative, blockStart - 1);
        const newRelativeAddresses = Array.from(currentRelativeAddresses).filter((address) => !pastRelativeAddresses.has(address));
        console.log("New Relative Addresses", newRelativeAddresses.length);
    });
}
function processMakerOrders(provider, blockStart, blockEnd) {
    return __awaiter(this, void 0, void 0, function* () {
        const { makerOrders, batchOrders, relativeOrders } = yield getMakerOrders(provider, blockStart, blockEnd);
        const maker = getUniqueOrderAddresses(makerOrders);
        const pastMakerAddresses = yield getUniqueAddressOrderType(OrderType.Maker);
        const newMakerAddresses = Array.from(maker).filter((address) => !pastMakerAddresses.has(address));
        yield updateTasks(TASK_IDS.MAKER, newMakerAddresses);
        console.log("All Maker Addresses Complete:", maker.size);
        console.log("New Maker Addresses Complete: ", newMakerAddresses.length);
        const pastBatch = yield getUniqueAddressOrderType(OrderType.Batch);
        const pastRelative = yield getUniqueAddressOrderType(OrderType.Relative);
        const pastBoth = new Set([
            ...Array.from(pastBatch),
            ...Array.from(pastRelative),
        ]);
        const newBatch = new Set([...getUniqueOrderAddresses(batchOrders)].filter((address) => !pastBoth.has(address)));
        const newRelative = new Set([...getUniqueOrderAddresses(relativeOrders)].filter((address) => !pastBoth.has(address)));
        const newComplete = new Set([
            ...[...newBatch].filter((x) => pastRelative.has(x) || newRelative.has(x)),
            ...[...newRelative].filter((x) => pastBatch.has(x) || newBatch.has(x)),
        ]);
        yield updateTasks(TASK_IDS.ADVANCED, Array.from(newComplete));
        console.log("New Relative Addresses Complete", newRelative.size);
        console.log("New Batch Addresses Complete", newBatch.size);
        console.log("Advanced Order Addresses Complete", newComplete.size);
    });
}
function updateMakerOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const mostRecentBlock = (yield getMostRecentBlockMaker()) + 1;
        yield processMakerOrders(provider, mostRecentBlock, currentBlock);
    });
}
function updateSwapOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const mostRecentBlock = (yield getMostRecentBlockSwap()) + 1;
        yield processSwapEvents(provider, mostRecentBlock, currentBlock);
    });
}
function updateAllAdvancedOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const batch = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Batch, currentBlock);
        const relative = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Relative, currentBlock);
        const both = [...batch].filter((x) => relative.has(x));
        yield updateTasks(TASK_IDS.ADVANCED, both);
        console.log("Advanced Order Addresses Complete", both.length);
    });
}
function updateAllMakerOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const addresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Maker, currentBlock);
        yield updateTasks(TASK_IDS.MAKER, [...addresses]);
        console.log("Maker Addresses Complete", addresses.size);
    });
}
function updateAllSwapOrders(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBlock = yield provider.getBlockNumber();
        const addresses = yield getUniqueAddressOrderTypeWithBlockCumulative(OrderType.Maker, currentBlock);
        yield updateTasks(TASK_IDS.SWAP, [...addresses]);
        console.log("Swap Addresses Complete", addresses.size);
    });
}
const INFURA_PROVIDER = `https://linea-goerli.infura.io/v3/${process.env.API_KEY}`;
const PUBLIC_PROVIDER = "https://rpc.goerli.linea.build";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const provider = new ethers_1.ethers.JsonRpcProvider(PUBLIC_PROVIDER, 59140);
        const currentBlock = yield provider.getBlockNumber();
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
        yield updateAllAdvancedOrders(provider);
        console.log("ALL MAKER ---------");
        yield updateAllMakerOrders(provider);
        console.log("ALL SWAP ---------");
        yield updateAllSwapOrders(provider);
    });
}
main()
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}))
    .catch((e) => __awaiter(void 0, void 0, void 0, function* () {
    console.error(e);
    yield prisma.$disconnect();
    process.exit(1);
}));
//# sourceMappingURL=index.js.map