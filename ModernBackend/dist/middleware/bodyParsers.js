"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlencodedParser = exports.jsonParser = void 0;
const express_1 = __importDefault(require("express"));
/**
 * JSON body parser with raw body capture for Stripe webhook signature
 * verification. The raw Buffer is stashed on `req.rawBody`.
 */
exports.jsonParser = express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
});
exports.urlencodedParser = express_1.default.urlencoded({ extended: true });
