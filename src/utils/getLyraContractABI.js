"use strict";
exports.__esModule = true;
var contracts_1 = require("../constants/contracts");
var LiquidityPool_json_1 = require("../contracts/abis/LiquidityPool.json");
var LiquidityTokens_json_1 = require("../contracts/abis/LiquidityTokens.json");
var OptionGreekCache_json_1 = require("../contracts/abis/OptionGreekCache.json");
var OptionMarket_json_1 = require("../contracts/abis/OptionMarket.json");
var OptionMarketViewer_json_1 = require("../contracts/abis/OptionMarketViewer.json");
var OptionMarketWrapper_json_1 = require("../contracts/abis/OptionMarketWrapper.json");
var OptionToken_json_1 = require("../contracts/abis/OptionToken.json");
var ShortCollateral_json_1 = require("../contracts/abis/ShortCollateral.json");
var TestFaucet_json_1 = require("../contracts/abis/TestFaucet.json");
function getLyraContractABI(contractId) {
    switch (contractId) {
        case contracts_1.LyraContractId.OptionMarketViewer:
            return OptionMarketViewer_json_1["default"];
        case contracts_1.LyraContractId.OptionMarketWrapper:
            return OptionMarketWrapper_json_1["default"];
        case contracts_1.LyraContractId.TestFaucet:
            return TestFaucet_json_1["default"];
        case contracts_1.LyraMarketContractId.LiquidityPool:
            return LiquidityPool_json_1["default"];
        case contracts_1.LyraMarketContractId.LiquidityTokens:
            return LiquidityTokens_json_1["default"];
        case contracts_1.LyraMarketContractId.OptionGreekCache:
            return OptionGreekCache_json_1["default"];
        case contracts_1.LyraMarketContractId.OptionMarket:
            return OptionMarket_json_1["default"];
        case contracts_1.LyraMarketContractId.OptionToken:
            return OptionToken_json_1["default"];
        case contracts_1.LyraMarketContractId.ShortCollateral:
            return ShortCollateral_json_1["default"];
    }
}
exports["default"] = getLyraContractABI;
