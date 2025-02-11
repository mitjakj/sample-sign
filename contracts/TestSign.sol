// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";

contract TestSign {


    function createSubstrate(bytes memory randSeed, bytes memory data) external view returns (bytes memory signature, bytes memory pk, bytes memory sk) {
        // bytes memory randSeed = Sapphire.randomBytes(32, "");

        // bytes32 keypairSecret = 0x689fec26ad6e43b74e7185fe6145533d97245e7c8e074c4e8d8e2a02e263964f;
        // bytes memory randSeed = abi.encodePacked(keypairSecret);

        (pk, sk) = Sapphire.generateSigningKeyPair(
            Sapphire.SigningAlg.Sr25519,
            randSeed
        );

        // Sign data
        signature = Sapphire.sign(
            Sapphire.SigningAlg.Sr25519,
            sk, // substrate_sk_bytes, // abi.encodePacked(substrate_sk),
            data, // data,
            "" // ""
        );

        Sapphire.verify(
            Sapphire.SigningAlg.Sr25519, 
            pk, 
            data, // data,
            "", // ""
            signature
        );
    }

}