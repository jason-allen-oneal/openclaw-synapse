"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignature = verifySignature;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
function verifySignature(payload, signature, publicKey) {
    try {
        const verify = crypto_1.default.createVerify('SHA256');
        verify.update(payload);
        verify.end();
        return verify.verify(publicKey, signature, 'base64');
    }
    catch (err) {
        return false;
    }
}
function generateToken(nodeId) {
    return jsonwebtoken_1.default.sign({ nodeId }, JWT_SECRET, { expiresIn: '10y' }); // Long-lived
}
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (err) {
        return null;
    }
}
