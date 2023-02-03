import {
    Identifier,
    Service,
    User,
} from '@visionsofficial/visions-public-models';
import { ModelConverter } from '@visionsofficial/visions-public-models/lib/utils';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';
import { UserAPIError } from '../../../libs/errors/UserAPIError';
import { makeId } from '../../../utils/idGenerator';

/**
 * Returns all user identifiers for a service
 * @author Felix Bole
 */
export const getAllUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const identifiers = await Identifier.find({ service: req.service });
        if (!identifiers.length)
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: 'No user identifiers were found for your service',
            });

        const result = identifiers.map((id) =>
            ModelConverter.toIdentifierModel(id)
        );

        return restfulResponse(res, 200, result);
    } catch (err) {
        next(new UserAPIError(null, 'getAllUsers'));
    }
};

/**
 * Creates a User Identifier for the authenticated service
 * @author Felix Bole
 */
export const createUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const service = await Service.findById(req.service);

        const findId = await Identifier.findOne({
            service: service._id,
            email: req.body.email,
        });

        if (findId) {
            return errorRes({
                code: 409,
                errorMsg: 'existing resource',
                message:
                    'A user already exists with this email for your service',
                req,
                res,
            });
        }

        // Check if there are no users with the same userServiceId but different email
        const checkUSId = await Identifier.findOne({
            service: service._id,
            userServiceId: req.body.userServiceId,
        });

        if (checkUSId) {
            return errorRes({
                code: 409,
                errorMsg: 'existing resource',
                message: 'A user with this userServiceId already exists.',
                req,
                res,
            });
        }

        const idModel = new Identifier({
            service: service._id,
            origin: req.body.origin,
            email: req.body.email,
            userServiceId: req.body.userServiceId,
            userKey: makeId(),
            emailVerified: false,
        });

        const endpointKeys = [
            'consentImport',
            'consentExport',
            'dataImport',
            'dataExport',
        ];

        if (req.body.endpoints) {
            for (const key of endpointKeys) {
                if (req.body.endpoints[key]) {
                    for (const keyEndpoint of req.body.endpoints[key]) {
                        const endpoint = {
                            serviceId: keyEndpoint.serviceId
                                ? keyEndpoint.serviceId
                                : null,
                            url: keyEndpoint.url ? keyEndpoint.url : null,
                        };

                        idModel.endpoints[
                            key as keyof typeof idModel.endpoints
                        ].push(endpoint);
                    }
                }
            }
        }

        await idModel.save();

        const filter = {
            $or: [{ email: req.body.email }, { emails: req.body.email }],
        };

        const existingUser = await User.findOne(filter);

        if (existingUser) {
            idModel.user = existingUser.id;
            existingUser.identifiers.push(idModel._id);
            await idModel.save();
            await existingUser.save();
        }

        return restfulResponse(
            res,
            201,
            ModelConverter.toIdentifierModel(idModel)
        );
    } catch (err) {
        next(new UserAPIError(err.message));
    }
};

/**
 * Returns the Identifier for the given email in the authenticated service
 * @author Felix Bole
 */
export const getUserByEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.identifier) throw new Error('unexpected error');
        const { identifier } = req;

        return restfulResponse(
            res,
            200,
            ModelConverter.toIdentifierModel(identifier)
        );
    } catch (err) {
        next(new UserAPIError(err.message));
    }
};

/**
 * Returns the identifier info for the given email if found with the info regarding specific use cases
 * @author Felix Bole
 */
export const getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const identifier = await Identifier.findById(req.params.userId);

        if (!identifier) {
            return errorRes({
                code: 404,
                errorMsg: 'resource not found',
                message: 'User Identifier not found',
                req,
                res,
            });
        }

        if (identifier.service !== req.service)
            return errorRes({
                code: 403,
                errorMsg: 'forbidden-resource-error',
                message:
                    'The user identifier info you are trying to access does not belong to your service',
                req,
                res,
            });

        return restfulResponse(
            res,
            200,
            ModelConverter.toIdentifierModel(identifier)
        );
    } catch (err) {
        next(new UserAPIError(err.message));
    }
};

/**
 * Updates the user identifier
 * @author Felix Bole
 */
export const updateUserIdentifier = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const identifier = await Identifier.findOne({
            userKey: req.params.userKey,
        });

        if (!identifier) {
            return errorRes({
                code: 404,
                errorMsg: 'resource not found',
                message: 'User Identifier not found',
                req,
                res,
            });
        }

        if (req.body.email) {
            if (identifier.user) {
                const user = await User.findById(identifier.user);

                if (user && !user.emails.includes(req.body.email)) {
                    user.emails.push(req.body.email);
                }
            }

            identifier.email = req.body.email;
        }

        const endpointKeys = [
            'consentImport',
            'consentExport',
            'dataImport',
            'dataExport',
        ];

        type KeyEndpoint = {
            serviceId?: string;
            url?: string;
        };

        const addEndpoints = (keyEndpoints: KeyEndpoint[], key: string) => {
            for (const keyEndpoint of keyEndpoints) {
                identifier.endpoints[
                    key as keyof typeof identifier.endpoints
                ].push({
                    serviceId: keyEndpoint.serviceId
                        ? new Types.ObjectId(keyEndpoint.serviceId)
                        : null,
                    url: keyEndpoint.url ? keyEndpoint.url : null,
                });
            }
        };

        if (req.body.endpoints) {
            for (const key of endpointKeys) {
                if (req.body.endpoints[key]) {
                    if (
                        identifier.endpoints[
                            key as keyof typeof identifier.endpoints
                        ]
                    ) {
                        addEndpoints(req.body.endpoints[key], key);
                    } else {
                        identifier.endpoints[
                            key as keyof typeof identifier.endpoints
                        ] = [];
                        addEndpoints(req.body.endpoints[key], key);
                    }
                }
            }
        }

        await identifier.save();

        return restfulResponse(
            res,
            200,
            ModelConverter.toIdentifierModel(identifier)
        );
    } catch (err) {
        next(new UserAPIError(err.message));
    }
};

/**
 * Deletes a user identifier using its userKey
 * @author Felix Bole
 */
export const deleteUserIdentifier = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const identifier = await Identifier.findOne({
            userKey: req.params.userKey,
        });

        if (!identifier) {
            return errorRes({
                code: 404,
                errorMsg: 'resource not found',
                message: 'User Identifier not found',
                req,
                res,
            });
        }

        // Remove identifier from service identifiers list
        const service = await Service.findById(identifier.service);

        const index = service.identifiers.indexOf(identifier.id);
        if (index > -1) {
            service.identifiers.splice(index, 1);
            await service.save();
        }

        // Remove identifier from user identifiers list
        const user = await User.findById(identifier.user);

        if (user) {
            const idIndex = user.identifiers.indexOf(identifier.id);
            if (idIndex > -1) {
                user.identifiers.splice(idIndex, 1);
                await user.save();
            }
        }

        await identifier.remove();
        return restfulResponse(
            res,
            200,
            ModelConverter.toIdentifierModel(identifier)
        );
    } catch (err) {
        next(new UserAPIError(err.message));
    }
};
