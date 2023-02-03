/// MIDDLEWARE FOR POPULATING INFORMATION IN REQUEST TO USE V1 CONTROLLERS

import { Identifier } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';

export const setForGetImportPopup = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    req.body.purpose = req.params.purpose;
    req.body.isLegacy = true;
    return next();
};

export const setForStartExportExchange = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    req.body.purpose = req.params.purpose;
    return next();
};

export const setForVerifiedAccountCreation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.body.userServiceId)
        return res
            .status(400)
            .json({ error: 'Missing parameter userServiceId' });

    const identifier = await Identifier.findOne({
        service: req.service,
        userServiceId: req.body.userServiceId,
    });

    if (!identifier) return res.status(404).json({ error: 'User not found' });

    req.body.isLegacy = true;
    req.body.userKey = identifier.userKey;
    next();
};
