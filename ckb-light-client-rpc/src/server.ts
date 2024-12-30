import express from 'express';
import bodyParser from 'body-parser';
import {JSONRPCServer} from 'json-rpc-2.0';
import {Browser, chromium, Page} from "playwright";
import {
    lightClientGetTransactionsResultFrom,
    LightClientScriptStatus,
    LightClientSetScriptsCommandTo, localNodeFrom, RemoteNode, remoteNodeFrom,
    scriptStatusFrom,
    scriptStatusTo,
} from "./types";
import {
    ClientBlock,
    ClientBlockHeader,
    ClientTransactionResponse, Hex,
    hexFrom,
    numFrom,
    NumLike,
    numToHex,
    Transaction
} from "@ckb-ccc/core";
import {JsonRpcIndexerSearchKeyTransaction} from "@ckb-ccc/core/src/client/jsonRpc/types";
import {JsonRpcTransformers} from "./transformers";
import {JsonRpcIndexerSearchKey, JsonRpcTransaction} from "./jsonRpc";
import {apply} from "@ckb-ccc/core";
import {BrowserContext} from "playwright-core";

const app = express();
const port = 9000;
const lightClientUrl = 'http://localhost:8000'
const buttonName = 'Initialize workers'
const buttonDevName = 'Initialize dev workers'

let browser:Browser, context:BrowserContext, page:Page;

// @ts-ignore
BigInt.prototype.toJSON = function () {
    return `0x${this.toString(16)}`
}


const server = new JSONRPCServer();
app.use(express.json({limit: '50000mb'}));
app.use(express.urlencoded({limit: '50000mb'}));


// set_scripts
server.addMethod("set_scripts", async ([scripts, command]: [LightClientScriptStatus[], string?]) => {
    let scripts1 = scripts.map(script => scriptStatusTo(script))
    if (command == undefined) {
        return await page.evaluate((scripts1) => {
            // @ts-ignore
            window.client.setScripts(scripts1)
        }, scripts1);
    }
    // @ts-ignore
    let cmd = LightClientSetScriptsCommandTo(command);
    let params = {
        scripts: scripts1,
        cmd: cmd
    }
    return await page.evaluate((params) => {
        // @ts-ignore
        window.client.setScripts(params.scripts, params.cmd)
    }, params);
});
// get_scripts
server.addMethod("get_scripts", async () => {
    // @ts-ignore
    let result = await page.evaluate(() => window.client.getScripts());
    // @ts-ignore
    return result.map(script => scriptStatusFrom(script))
});

// send_transaction
server.addMethod("send_transaction", async ([tx]: [JsonRpcTransaction]) => {
    let tx1 = JsonRpcTransformers.transactionTo(tx)
    return await page.evaluate((tx1) => {
        // @ts-ignore
        window.tx = tx1;
        // @ts-ignore
        return window.client.sendTransaction(tx1)
    }, tx1);
})
// estimate_cycles
server.addMethod("estimate_cycles", async ([tx]: [JsonRpcTransaction]) => {
    let tx1 = JsonRpcTransformers.transactionTo(tx)
    return await page.evaluate((tx1) => {
        // @ts-ignore
        window.tx = tx1;
        // @ts-ignore
        return window.client.estimateCycles(tx1)
    }, tx1);
})
// get_tip_header
server.addMethod("get_tip_header", async () => {
    // @ts-ignore
    let  tipHeader: ClientBlockHeader = await page.evaluate(() => window.client.getTipHeader());
    return JsonRpcTransformers.blockHeaderFrom(tipHeader);
});
// get_genesis_block
server.addMethod("get_genesis_block", async () => {
    // @ts-ignore
    let  block: ClientBlock = await page.evaluate(() => window.client.getGenesisBlock());
    // todo fix block data
    return JsonRpcTransformers.blockFrom(block);
});
// get_header
server.addMethod("get_header", async ([block_hash]: [string]) => {
    // @ts-ignore
    let  header: ClientBlockHeader = await page.evaluate((block_hash) => window.client.getHeader(block_hash), block_hash);
    if (header == null){
        return null
    }
    return JsonRpcTransformers.blockHeaderFrom(header);

});
// get_transaction
server.addMethod("get_transaction", async ([tx_hash]: [string]) => {
    // @ts-ignore
    const tx: ClientTransactionResponse = await page.evaluate((tx_hash) => window.client.getTransaction(tx_hash), tx_hash);
    if (tx === undefined) {
        return {"cycles": null, "transaction": null, "tx_status": {"block_hash": null, "status": "unknown"}}
    }
    return JsonRpcTransformers.transactionResponseFrom(tx);
});
// fetch_header
server.addMethod("fetch_header", async ([header_hash]: [string]) => {
    // @ts-ignore
    let input = await page.evaluate((header_hash) => window.client.fetchHeader(header_hash), header_hash);
    if (input.status === "fetched") {
        return {status: "fetched", data: JsonRpcTransformers.blockHeaderFrom(input.data)};
    }
    return input
});
// fetch_transaction
server.addMethod("fetch_transaction", async ([tx_hash]: [string]) => {
    // @ts-ignore
    let input = await page.evaluate((tx_hash) => window.client.fetchTransaction(tx_hash), tx_hash);
    if (input.status === "fetched") {
        return {status: "fetched", data: JsonRpcTransformers.transactionResponseFrom(input.data)};
    }
    return input;
});
// get_peers
server.addMethod("get_peers", async () => {
    // @ts-ignore
    return (await page.evaluate(() => window.client.getPeers()) as RemoteNode[]).map(node => remoteNodeFrom(node))
});

// local_node_info
server.addMethod("local_node_info", async () => {
    // @ts-ignore
    return localNodeFrom(await page.evaluate(() => window.client.localNodeInfo()));
});

// get_cells
server.addMethod("get_cells", async ([searchKey, order, limit, afterCursor]: [JsonRpcIndexerSearchKey, string?, NumLike?, Hex?]) => {
    let query = {
        searchKey: JsonRpcTransformers.indexerSearchKeyTo(searchKey),
        order: order ?? undefined,
        limit: apply(numFrom, limit),
        afterCursor: afterCursor ?? undefined
    }
    // @ts-ignore
    let cells = await page.evaluate((query) => window.client.getCells(
        query.searchKey,
        query.order,
        query.limit,
        query.afterCursor
    ), query);

    // @ts-ignore
    return {last_cursor: cells.lastCursor, objects: cells.cells.length === 0 ? [] : cells.cells.map((cell) => (
                {
                    out_point: JsonRpcTransformers.outPointFrom(cell.outPoint),
                    output: JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
                    output_data: query.searchKey.withData == false ? undefined : cell.outputData,
                    block_number: numToHex(cell.blockNumber),
                    tx_index: numToHex(cell.txIndex)
                }))
    };
    // return JsonRpcTransformers.findCellsResponseFrom(cells,page)
});
// get_transactions

server.addMethod("get_transactions", async ([searchKey, order, limit, afterCursor]: [JsonRpcIndexerSearchKeyTransaction, string?, NumLike?, Hex?]) => {
    let query = {
        searchKey: JsonRpcTransformers.indexerSearchKeyTransactionTo(searchKey),
        order: order ?? undefined,
        limit: apply(numFrom, limit),
        afterCursor: afterCursor ?? undefined
    }
    // @ts-ignore
    let cells = await page.evaluate((query) => window.client.getTransactions(
        query.searchKey,
        query.order,
        query.limit,
        query.afterCursor
    ), query);
    return lightClientGetTransactionsResultFrom(cells)
});
// get_cells_capacity
server.addMethod("get_cells_capacity", async ([searchKey]: [JsonRpcIndexerSearchKey]) => {
    let query = {
        searchKey: JsonRpcTransformers.indexerSearchKeyTo(searchKey),
    }
    // @ts-ignore
    let cellsCapacity = await page.evaluate((query) => window.client.getCellsCapacity(
        query.searchKey
    ), query);
    // @ts-ignore
    let tipHeader = await page.evaluate(() => window.client.getTipHeader());
    //todo
    console.log(tipHeader)
    return {
        block_hash: tipHeader.hash,
        block_number: numToHex(tipHeader.number),
        capacity: cellsCapacity
    }
});

server.addMethod("stop", async () => {
    // @ts-ignore
    await page.evaluate(() => window.client.stop())
});


server.addMethod("start", async () => {
    await page.getByRole("button", {
        name: buttonName
    }).click()
    await new Promise((resolve) => setTimeout(resolve, 1000));
});


server.addMethod("new_client", async () => {
    await page.close()
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(lightClientUrl); // Adjust URL if needed

    // await page.click('button[name="Initialize workers"]');
    await page.getByRole("button", {
        name: buttonName
    }).click()
    await new Promise((resolve) => setTimeout(resolve, 1000));
});

server.addMethod("new_dev_client", async () => {
    await page.close()
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(lightClientUrl); // Adjust URL if needed

    // await page.click('button[name="Initialize workers"]');
    await page.getByRole("button", {
        name: buttonDevName
    }).click()
    await new Promise((resolve) => setTimeout(resolve, 1000));
});


app.use(bodyParser.json());


app.post('/', async (req, res) => {
    let jsonRPCRequest = req.body;
    console.log('body:', JSON.stringify(jsonRPCRequest));

    if (Array.isArray(jsonRPCRequest)) {
        // Handle batch requests
        const responses = await Promise.all(
            jsonRPCRequest.map((request) => server.receive(request))
        );
        const filteredResponses = responses.filter((response) => response !== undefined);
        res.json(filteredResponses);
    } else {
        // Handle single request
        server
            .receive(jsonRPCRequest)
            .then((jsonRPCResponse) => {
                if (jsonRPCResponse) {
                    res.json(jsonRPCResponse);
                } else {
                    res.sendStatus(204); // No content for notifications
                }
            })
            // @ts-ignore
            .catch((error) => {
                res.status(500).send(error.message);
            });
    }
});

// @ts-ignore

// start service
app.listen(port, async () => {
    browser = await chromium.launch({headless: true}); // Visible browser for debugging
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(lightClientUrl); // Adjust URL if needed

    // await page.click('button[name="Initialize workers"]');
    await page.getByRole("button", {
        name: buttonName
    }).click()
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`JSON-RPC server is running at http://localhost:${port}`);
});


