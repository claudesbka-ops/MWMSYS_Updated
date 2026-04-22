import express from "express";

/**
 * JSON body parser with raw body capture for Stripe webhook signature
 * verification. The raw Buffer is stashed on `req.rawBody`.
 */
export const jsonParser = express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
});

export const urlencodedParser = express.urlencoded({ extended: true });
