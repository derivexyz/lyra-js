"use strict";
exports.__esModule = true;
var contracts_1 = require("../constants/contracts");
var kovan_addresses_json_1 = require("../contracts/addresses/kovan.addresses.json");
// TODO: Remove local address maps in favor of protocol SDK
var local_addresses_json_1 = require("../contracts/addresses/local.addresses.json");
function getLyraContractAddress(deployment, contractId) {
    switch (deployment) {
        case contracts_1.Deployment.Kovan:
            return kovan_addresses_json_1["default"][contractId];
        case contracts_1.Deployment.Local:
            return local_addresses_json_1["default"][contractId];
    }
}
exports["default"] = getLyraContractAddress;
