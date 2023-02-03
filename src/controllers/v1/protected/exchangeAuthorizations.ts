import { ExchangeAuthorization } from '@visionsofficial/visions-public-models';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { NextFunction, Request, Response } from 'express';
import { HydratedDocument, Types } from 'mongoose';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';
import { isExchangeAuthorized } from '../../../utils/exchangeAuthHelper';

/**
 * Returns all exchange authorizations filterable with queries
 * @author Felix Bole
 */
export const getOwnedExchangeAuthorizations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const exchangeAuths = ExchangeAuthorization.find({
            $or: [
                { 'receiver.service': req.service },
                { 'requester.service': req.service },
            ],
        })
            .populate('requester.service', 'name id')
            .populate('receiver.service', 'name id');

        return restfulResponse(res, 200, exchangeAuths);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns one exchange authorization by ID
 * @author Felix Bole
 */
export const getOwnedExchangeAuthorization = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const exchangeAuth = await ExchangeAuthorization.findById(req.params.id)
            .populate('requester.service', 'name id')
            .populate('receiver.service', 'name id');

        if (!exchangeAuth) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange Authorization with this ID not found.',
            });
        }

        return restfulResponse(res, 200, exchangeAuth);
    } catch (err) {
        next(err);
    }
};

/**
 * Updates an existing exchangeAuth with the authorization change in the request payload
 * @author Felix Bole
 */
export const updateExchangeAuthorization = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const exchangeAuth = await ExchangeAuthorization.findOne({
            _id: req.params.id,
            $or: [
                { 'requester.service': req.service },
                { 'receiver.service': req.service },
            ],
        })
            .populate<{
                requester: {
                    authorization: boolean;
                    service: HydratedDocument<IService>;
                };
            }>('requester.service', 'name id _id')
            .populate<{
                requester: {
                    authorization: boolean;
                    service: HydratedDocument<IService>;
                };
            }>('receiver.service', 'name id _id');

        const { authorize } = req.body;

        if (!exchangeAuth) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange Authorization with this ID not found.',
            });
        }

        const isRequester =
            exchangeAuth.requester.service.id === req.service.toString();

        if (isRequester) {
            exchangeAuth.requester.authorization = authorize;
        } else {
            exchangeAuth.receiver.authorization = authorize;
        }

        await exchangeAuth.save();
        return restfulResponse(res, 200, exchangeAuth);
    } catch (err) {
        next(err);
    }
};

/**
 * Creates a new exchangeAuth between the authenticated service and the specified one
 * @author Felix Bole
 */
export const createExchangeAuthorization = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { serviceId } = req.body;
        const alreadyExisting = await ExchangeAuthorization.findWithServices(
            req.service,
            serviceId
        );
        if (alreadyExisting) return restfulResponse(res, 200, alreadyExisting);

        const exchangeAuth = new ExchangeAuthorization({
            requester: {
                service: req.service,
                authorization: true,
            },
            receiver: {
                service: serviceId,
                authorization: false,
            },
        });
        await exchangeAuth.save();
        return restfulResponse(res, 200, exchangeAuth);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns the authorization status between the authenticated service
 * and the specified ond
 * @author Felix Bole
 */
export const getExchangeAuthorizationWithOtherService = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const isAuthorized = isExchangeAuthorized(
            new Types.ObjectId(req.service),
            new Types.ObjectId(req.params.serviceId)
        );

        return res.json({ authorization: isAuthorized });
    } catch (err) {
        next(err);
    }
};

/**
 * Revokes the authorization on a exchange authorization
 * @author Felix Bole
 */
export const revokeExchangeAuthorization = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const exchangeAuth = await ExchangeAuthorization.findOne({
            _id: req.params.id,
            $or: [
                { 'requester.service': req.service },
                { 'receiver.service': req.service },
            ],
        })
            .populate<{
                requester: {
                    authorization: boolean;
                    service: HydratedDocument<IService>;
                };
            }>('requester.service', 'name id _id')
            .populate<{
                requester: {
                    authorization: boolean;
                    service: HydratedDocument<IService>;
                };
            }>('receiver.service', 'name id _id');

        if (!exchangeAuth) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message:
                    'The exchange authorization for this ID does not exist',
            });
        }

        const isRequester =
            exchangeAuth.requester.service.id === req.service.toString();

        if (isRequester) {
            exchangeAuth.requester.authorization = false;
        } else {
            exchangeAuth.receiver.authorization = false;
        }

        return restfulResponse(res, 200, exchangeAuth);
    } catch (err) {
        next(err);
    }
};
