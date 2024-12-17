import {
    Cell,
    CellDep,
    CellDepLike,
    CellInput,
    CellInputLike,
    CellOutput,
    CellOutputLike,
    DepType,
    DepTypeLike,
    epochFromHex,
    HashType,
    HashTypeLike,
    OutPoint,
    OutPointLike,
    Script,
    ScriptLike,
    Transaction,
    TransactionLike,
    hashTypeFrom,
    depTypeFrom,
    Num,
    epochToHex,
    numLeToBytes,
    bytesTo,
    bytesConcat
} from "@ckb-ccc/core";
import {
    JsonRpcBlock,
    JsonRpcBlockHeader,
    JsonRpcBlockUncle,
    JsonRpcCellDep,
    JsonRpcCellInput,
    JsonRpcCellOutput,
    JsonRpcDepType,
    JsonRpcHashType, JsonRpcIndexerFindTransactionsGroupedResponse,
    JsonRpcIndexerFindTransactionsResponse,
    JsonRpcIndexerSearchKey,
    JsonRpcIndexerSearchKeyFilter,
    JsonRpcIndexerSearchKeyTransaction,
    JsonRpcOutPoint,
    JsonRpcScript
} from "@ckb-ccc/core/src/client/jsonRpc/types";
import {numFrom, numLeFromBytes, NumLike, numToHex} from "@ckb-ccc/core";
import {apply} from "@ckb-ccc/core";
import {
    ClientBlock,
    ClientBlockHeader,
    ClientBlockUncle,
    ClientFindCellsResponse, ClientFindTransactionsGroupedResponse, ClientFindTransactionsResponse,
    ClientIndexerSearchKey,
    ClientIndexerSearchKeyFilter,
    ClientIndexerSearchKeyLike, ClientIndexerSearchKeyTransaction, ClientIndexerSearchKeyTransactionLike,
    ClientTransactionResponse,
    TransactionStatus
} from "@ckb-ccc/core";
import {Hex, hexFrom, HexLike} from "@ckb-ccc/core";
import {bytesFrom} from "@ckb-ccc/core";
import {JsonRpcTransaction} from "./jsonRpc";


export class JsonRpcTransformers {
    static hashTypeFrom(hashType: HashTypeLike): JsonRpcHashType {
        return hashTypeFrom(hashType);
    }

    static hashTypeTo(hashType: JsonRpcHashType): HashType {
        return hashType;
    }

    static depTypeFrom(depType: DepTypeLike): JsonRpcDepType {
        switch (depTypeFrom(depType)) {
            case "code":
                return "code";
            case "depGroup":
                return "dep_group";
        }
    }

    static depTypeTo(depType: JsonRpcDepType): DepType {
        switch (depType) {
            case "code":
                return "code";
            case "dep_group":
                return "depGroup";
        }
    }

    static scriptFrom(scriptLike: ScriptLike): JsonRpcScript {
        const script = Script.from(scriptLike);
        return {
            code_hash: script.codeHash,
            hash_type: JsonRpcTransformers.hashTypeFrom(script.hashType),
            args: script.args,
        };
    }

    static scriptTo(script: JsonRpcScript): Script {
        return Script.from({
            codeHash: script.code_hash,
            hashType: JsonRpcTransformers.hashTypeTo(script.hash_type),
            args: script.args,
        });
    }

    static outPointFrom(outPointLike: OutPointLike): JsonRpcOutPoint {
        const outPoint = OutPoint.from(outPointLike);
        return {
            index: numToHex(outPoint.index),
            tx_hash: outPoint.txHash,
        };
    }

    static outPointTo(outPoint: JsonRpcOutPoint): OutPoint {
        return OutPoint.from({
            index: outPoint.index,
            txHash: outPoint.tx_hash,
        });
    }

    static cellInputFrom(cellInputLike: CellInputLike): JsonRpcCellInput {
        const cellInput = CellInput.from(cellInputLike);
        return {
            previous_output: JsonRpcTransformers.outPointFrom(
                cellInput.previousOutput,
            ),
            since: numToHex(cellInput.since),
        };
    }

    static cellInputTo(cellInput: JsonRpcCellInput): CellInput {
        return CellInput.from({
            previousOutput: JsonRpcTransformers.outPointTo(cellInput.previous_output),
            since: cellInput.since,
        });
    }

    static cellOutputFrom(cellOutput: CellOutputLike): JsonRpcCellOutput {
        return {
            capacity: numToHex(cellOutput.capacity),
            lock: JsonRpcTransformers.scriptFrom(cellOutput.lock),
            type: apply(JsonRpcTransformers.scriptFrom, cellOutput.type),
        };
    }

    static cellOutputTo(cellOutput: JsonRpcCellOutput): CellOutput {
        return CellOutput.from({
            capacity: cellOutput.capacity,
            lock: JsonRpcTransformers.scriptTo(cellOutput.lock),
            type: apply(JsonRpcTransformers.scriptTo, cellOutput.type),
        });
    }

    static cellDepFrom(cellDep: CellDepLike): JsonRpcCellDep {
        return {
            out_point: JsonRpcTransformers.outPointFrom(cellDep.outPoint),
            dep_type: JsonRpcTransformers.depTypeFrom(cellDep.depType),
        };
    }

    static cellDepTo(cellDep: JsonRpcCellDep): CellDep {
        return CellDep.from({
            outPoint: JsonRpcTransformers.outPointTo(cellDep.out_point),
            depType: JsonRpcTransformers.depTypeTo(cellDep.dep_type),
        });
    }

    static transactionFrom(txLike: TransactionLike): JsonRpcTransaction {
        const tx = Transaction.from(txLike);
        return {
            version: numToHex(tx.version),
            cell_deps: tx.cellDeps.map((c) => JsonRpcTransformers.cellDepFrom(c)),
            header_deps: tx.headerDeps,
            inputs: tx.inputs.map((i) => JsonRpcTransformers.cellInputFrom(i)),
            outputs: tx.outputs.map((o) => JsonRpcTransformers.cellOutputFrom(o)),
            outputs_data: tx.outputsData,
            witnesses: tx.witnesses,
            hash: tx.hash()
        };
    }

    static transactionTo(tx: JsonRpcTransaction): Transaction {
        return Transaction.from({
            version: tx.version,
            cellDeps: tx.cell_deps.map((c) => JsonRpcTransformers.cellDepTo(c)),
            headerDeps: tx.header_deps,
            inputs: tx.inputs.map((i) => JsonRpcTransformers.cellInputTo(i)),
            outputs: tx.outputs.map((o) => JsonRpcTransformers.cellOutputTo(o)),
            outputsData: tx.outputs_data,
            witnesses: tx.witnesses,
        });
    }

    static transactionResponseTo({
                                     cycles,
                                     tx_status: {status, block_number, block_hash, tx_index, reason},
                                     transaction,
                                 }: {
        cycles?: NumLike;
        tx_status: {
            status: TransactionStatus;
            block_hash?: HexLike;
            tx_index?: NumLike;
            block_number?: NumLike;
            reason?: string;
        };
        transaction: JsonRpcTransaction | null;
    }): ClientTransactionResponse | undefined {
        if (transaction == null) {
            return;
        }

        return {
            transaction: JsonRpcTransformers.transactionTo(transaction),
            status,
            cycles: apply(numFrom, cycles),
            blockHash: apply(hexFrom, block_hash),
            blockNumber: apply(numFrom, block_number),
            txIndex: apply(numFrom, tx_index),
            reason,
        };
    }

    static transactionResponseFrom(transactionResponse: ClientTransactionResponse | undefined): {
        cycles?: NumLike;
        tx_status: {
            status: TransactionStatus;
            block_hash?: HexLike;
            tx_index?: NumLike;
            block_number?: NumLike;
            reason?: string;
        };
        transaction: JsonRpcTransaction | null;
    } {
        if (transactionResponse === undefined){
            return null;
        }

        return {
            transaction: JsonRpcTransformers.transactionFrom(transactionResponse.transaction),
            tx_status: {
                status: transactionResponse.status,
                block_hash: apply(hexFrom, transactionResponse.blockHash),
                tx_index: apply(numToHex, transactionResponse.txIndex),
                reason: transactionResponse.reason
            },
            cycles: apply(numToHex, transactionResponse.cycles),
        };
    }

    static blockHeaderTo(header: JsonRpcBlockHeader): ClientBlockHeader {
        const dao = bytesFrom(header.dao);
        return {
            compactTarget: numFrom(header.compact_target),
            dao: {
                c: numLeFromBytes(dao.slice(0, 8)),
                ar: numLeFromBytes(dao.slice(8, 16)),
                s: numLeFromBytes(dao.slice(16, 24)),
                u: numLeFromBytes(dao.slice(24, 32)),
            },
            epoch: epochFromHex(header.epoch),
            extraHash: header.extra_hash,
            hash: header.hash,
            nonce: numFrom(header.nonce),
            number: numFrom(header.number),
            parentHash: header.parent_hash,
            proposalsHash: header.proposals_hash,
            timestamp: numFrom(header.timestamp),
            transactionsRoot: header.transactions_root,
            version: numFrom(header.version),
        };
    }

    static blockHeaderFrom(header: ClientBlockHeader): JsonRpcBlockHeader {
        return {
            compact_target: numToHex(header.compactTarget),
            dao: `0x${bytesTo(bytesConcat(
                numLeToBytes(header.dao.c, 8),
                numLeToBytes(header.dao.ar, 8),
                numLeToBytes(header.dao.s, 8),
                numLeToBytes(header.dao.u, 8)
            ), "hex")}`,
            epoch: epochToHex(header.epoch),
            extra_hash: header.extraHash,
            hash: header.hash,
            nonce: numToHex(header.nonce),
            number: numToHex(header.number),
            parent_hash: header.parentHash,
            proposals_hash: header.proposalsHash,
            timestamp: numToHex(header.timestamp),
            transactions_root: header.transactionsRoot,
            version: numToHex(header.version),
        };
    }

    static blockUncleTo(block: JsonRpcBlockUncle): ClientBlockUncle {
        return {
            header: JsonRpcTransformers.blockHeaderTo(block.header),
            proposals: block.proposals,
        };
    }

    static blockTo(block: JsonRpcBlock): ClientBlock {
        return {
            header: JsonRpcTransformers.blockHeaderTo(block.header),
            proposals: block.proposals,
            transactions: block.transactions.map((t) =>
                JsonRpcTransformers.transactionTo(t),
            ),
            uncles: block.uncles.map((u) => JsonRpcTransformers.blockUncleTo(u)),
        };
    }

    static blockFrom(block: ClientBlock): JsonRpcBlock {
        return {
            header: JsonRpcTransformers.blockHeaderFrom(block.header),
            proposals: block.proposals,
            transactions: block.transactions.map((t) =>
                JsonRpcTransformers.transactionFrom(t),
            ),
            // uncles: [block.uncles.map((u) => JsonRpcTransformers.blockUncleTo(u))],
            //todo because uncle must empty in 0 block ，we only used 0 block
            uncles: []
        };
    }

    static rangeFrom([a, b]: [NumLike, NumLike]): [Hex, Hex] {
        return [numToHex(a), numToHex(b)];
    }

    static rangeTo([a, b]: [Hex, Hex]): [Num, Num] {
        return [numFrom(a), numFrom(b)];
    }

    static indexerSearchKeyFilterFrom(
        filter: ClientIndexerSearchKeyFilter,
    ): JsonRpcIndexerSearchKeyFilter {
        return {
            script: apply(JsonRpcTransformers.scriptFrom, filter.script),
            script_len_range: apply(
                JsonRpcTransformers.rangeFrom,
                filter.scriptLenRange,
            ),
            output_data: filter.outputData,
            output_data_filter_mode: filter.outputDataSearchMode,
            output_data_len_range: apply(
                JsonRpcTransformers.rangeFrom,
                filter.outputDataLenRange,
            ),
            output_capacity_range: apply(
                JsonRpcTransformers.rangeFrom,
                filter.outputCapacityRange,
            ),
            block_range: apply(JsonRpcTransformers.rangeFrom, filter.blockRange),
        };
    }

    static indexerSearchKeyFilterTo(
        filter: JsonRpcIndexerSearchKeyFilter,
    ): ClientIndexerSearchKeyFilter {
        return {
            script: apply(JsonRpcTransformers.scriptTo, filter.script),
            scriptLenRange: apply(
                JsonRpcTransformers.rangeTo,
                filter.script_len_range,
            ),
            outputData: filter.output_data,
            outputDataSearchMode: filter.output_data_filter_mode,
            outputDataLenRange: apply(
                JsonRpcTransformers.rangeTo,
                filter.output_data_len_range,
            ),
            outputCapacityRange: apply(
                JsonRpcTransformers.rangeTo,
                filter.output_capacity_range,
            ),
            blockRange: apply(JsonRpcTransformers.rangeTo, filter.block_range),
        };
    }

    static indexerSearchKeyFrom(
        keyLike: ClientIndexerSearchKeyLike,
    ): JsonRpcIndexerSearchKey {
        const key = ClientIndexerSearchKey.from(keyLike);
        return {
            script: JsonRpcTransformers.scriptFrom(key.script),
            script_type: key.scriptType,
            script_search_mode: key.scriptSearchMode,
            filter: apply(JsonRpcTransformers.indexerSearchKeyFilterFrom, key.filter),
            with_data: key.withData,
        };
    }

    static indexerSearchKeyTo(
        keyLike: JsonRpcIndexerSearchKey
    ): ClientIndexerSearchKeyLike {
        return {
            script: JsonRpcTransformers.scriptTo(keyLike.script),
            scriptSearchMode: undefined,
            scriptType: keyLike.script_type,
            filter: apply(JsonRpcTransformers.indexerSearchKeyFilterTo, keyLike.filter),
            withData: keyLike.with_data ?? undefined
        };
    }

    static findCellsResponseTo({
                                   last_cursor,
                                   objects,
                               }: {
        last_cursor: string;
        objects: {
            out_point: JsonRpcOutPoint;
            output: JsonRpcCellOutput;
            output_data?: Hex;
        }[];
    }): ClientFindCellsResponse {
        return {
            lastCursor: last_cursor,
            cells: objects.map((cell) =>
                Cell.from({
                    outPoint: JsonRpcTransformers.outPointTo(cell.out_point),
                    cellOutput: JsonRpcTransformers.cellOutputTo(cell.output),
                    outputData: cell.output_data ?? "0x",

                }),
            ),
        };
    }

    static findCellsResponseFrom(res: ClientFindCellsResponse): {
        last_cursor: string;
        objects: { out_point: JsonRpcOutPoint; output: JsonRpcCellOutput; output_data?: Hex; }[]
    } {
        return {
            last_cursor: res.lastCursor,
            objects: res.cells.length === 0
                ? []
                : res.cells.map((cell) => ({
                    out_point: JsonRpcTransformers.outPointFrom(cell.outPoint),
                    output: JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
                    output_data: cell.outputData ?? "0x",

                }))
        };
    }

    static indexerSearchKeyTransactionFrom(
        keyLike
            :
            ClientIndexerSearchKeyTransactionLike,
    ):
        JsonRpcIndexerSearchKeyTransaction {
        const key = ClientIndexerSearchKeyTransaction.from(keyLike);
        return {
            script: JsonRpcTransformers.scriptFrom(key.script),
            script_type: key.scriptType,
            script_search_mode: key.scriptSearchMode,
            filter: apply(JsonRpcTransformers.indexerSearchKeyFilterFrom, key.filter),
            group_by_transaction: key.groupByTransaction,
        };
    }

    static

    indexerSearchKeyTransactionTo(
        keyLike
            :
            JsonRpcIndexerSearchKeyTransaction,
    ):
        ClientIndexerSearchKeyTransactionLike {
        // const key = JsonRpcIndexerSearchKeyTransaction.from(keyLike);
        return {
            scriptSearchMode: undefined,
            script: JsonRpcTransformers.scriptTo(keyLike.script),
            scriptType: keyLike.script_type,
            filter: apply(JsonRpcTransformers.indexerSearchKeyFilterTo, keyLike.filter),
            groupByTransaction: keyLike.group_by_transaction
        };
    }

    static

    findTransactionsResponseTo({
                                   last_cursor,
                                   objects,
                               }
                                   :
                                   |
                                   JsonRpcIndexerFindTransactionsResponse
                                   | JsonRpcIndexerFindTransactionsGroupedResponse
    ):
        |
        ClientFindTransactionsResponse
        | ClientFindTransactionsGroupedResponse {
        if (objects.length === 0) {
            return {
                lastCursor: last_cursor,
                transactions: [],
            };
        }
        if ("io_index" in objects[0]) {
            return {
                lastCursor: last_cursor,
                transactions: (
                    objects as JsonRpcIndexerFindTransactionsResponse["objects"]
                ).map((tx) => ({
                    txHash: tx.tx_hash,
                    blockNumber: numFrom(tx.block_number),
                    txIndex: numFrom(tx.tx_index),
                    cellIndex: numFrom(tx.io_index),
                    isInput: tx.io_type === "input",
                })),
            };
        }

        return {
            lastCursor: last_cursor,
            transactions: (
                objects as JsonRpcIndexerFindTransactionsGroupedResponse["objects"]
            ).map((tx) => ({
                txHash: tx.tx_hash,
                blockNumber: numFrom(tx.block_number),
                txIndex: numFrom(tx.tx_index),
                cells: tx.cells.map(([type, i]) => ({
                    isInput: type === "input",
                    cellIndex: numFrom(i),
                })),
            })),
        };
    }
}
