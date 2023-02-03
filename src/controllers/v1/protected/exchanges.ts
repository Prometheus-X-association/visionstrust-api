import { DataUseExchange } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';

/**
 * Returns all exchange configuration where the service is either
 * its creator or the receiver
 * @author Felix Bole
 */
export const getAllExchangeConfigurations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const dues = await DataUseExchange.find({
            $or: [
                { serviceImport: req.service },
                { 'data.serviceExport': req.service },
            ],
        })
            .populate('serviceImport', 'name id')
            .populate('data.serviceExport', 'name id')
            .populate('data.datatype', 'name id description');

        return restfulResponse(res, 200, dues);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns information on one exchange configuration by ID
 * if the service belongs in it
 * @author Felix Bole
 */
export const getOneExchangeConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const due = await DataUseExchange.findById(req.params.id);
        if (!due) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange Configuration not found for this id.',
            });
        }

        return restfulResponse(res, 200, due);
    } catch (err) {
        next(err);
    }
};

/**
 * Creates an exchange configuration request where the service
 * is the service that will be importing data
 * @author Felix Bole
 */
export const createExchangeConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { serviceId, datatypes, purposeId } = req.body as {
            serviceId: string;
            datatypes: string[];
            purposeId: string;
        };

        const [existingBetweenTwoServices, existingForService] =
            await Promise.all([
                DataUseExchange.findOne({
                    serviceImport: req.service,
                    purpose: purposeId,
                    'data.serviceExport': serviceId,
                }),
                DataUseExchange.findOne({
                    serviceImport: req.service,
                    purpose: purposeId,
                    'data.serviceExport': { $ne: serviceId },
                }),
            ]);

        if (existingBetweenTwoServices) {
            return errorRes({
                req,
                res,
                code: 409,
                errorMsg: 'conflict: exchange configuration already exists',
                message: `There is an existing exchange configuration between your service and this purpose under the following id: ${existingBetweenTwoServices.id}. If you wish to bring modifications to it, please use PUT /v1/exchanges/${existingBetweenTwoServices.id}`,
            });
        }

        const datatypesAsDataUseExchangeData = datatypes.map((id) => {
            return {
                datatype: new Types.ObjectId(id),
                authorized: false,
                serviceExport: new Types.ObjectId(serviceId),
            };
        });

        if (existingForService) {
            existingForService.data.push(...datatypesAsDataUseExchangeData);
            await existingForService.save();
            return restfulResponse(res, 201, existingForService);
        } else {
            const newExchange = new DataUseExchange({
                serviceImport: req.service,
                data: datatypesAsDataUseExchangeData,
            });

            await newExchange.save();
            return restfulResponse(res, 201, newExchange);
        }
    } catch (err) {
        next(err);
    }
};

/**
 * Updates an existing exchange configuration where the service is the one
 * that initially made the exchange request, essentially requesting for a
 * different set of datatypes.
 * @author Felix Bole
 */
export const updateExchangeConfigurationRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const due = await DataUseExchange.findById(req.params.id);
        if (!due) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange configuration not found.',
            });
        }

        if (due.serviceImport.toString() !== req.service.toString()) {
            return errorRes({
                req,
                res,
                code: 400,
                errorMsg: 'invalid exchange configuration action',
                message: `The exchange configuration you are trying to update is not a configuration coming from your service. To update the right to access datatypes on an incoming exchange configuration request, please use PUT /v1/exchanges/${req.params.id}/authorization`,
            });
        }

        const { datatypes } = req.body as { datatypes?: string[] };

        // Remove all unauthorized datatypes where the service is req.service and replace
        // with the new datatypes from payload
        due.data = due.data.filter(
            (o) =>
                o.serviceExport.toString() !== req.service.toString() ||
                (o.serviceExport.toString() === req.service.toString() &&
                    o.authorized === true)
        );

        // Filter out datatypes that are already validated
        const filteredDatatypes = datatypes.filter((dt) => {
            if (
                !due.data.find(
                    (o) =>
                        o.datatype.toString() === dt &&
                        o.serviceExport.toString() === req.service.toString()
                )
            )
                return true;
            return false;
        });

        due.data.push(
            ...filteredDatatypes.map((id) => {
                return {
                    datatype: new Types.ObjectId(id),
                    authorized: false,
                    serviceExport: new Types.ObjectId(req.service),
                };
            })
        );

        await due.save();
        return restfulResponse(res, 200, due);
    } catch (err) {
        next(err);
    }
};

/**
 * Updates the authorization on an exchange configuration received by the
 * service making the request
 * @author Felix Bole
 */
export const updateExchangeConfigurationAuthorizations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const due = await DataUseExchange.findById(req.params.id);
        if (!due) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange configuration not found.',
            });
        }

        if (due.serviceImport.toString() === req.service.toString()) {
            return errorRes({
                req,
                res,
                code: 400,
                errorMsg: 'invalid exchange configuration action',
                message: `The exchange configuration you are trying to update is an exchange configuration coming from your service. To update the datatypes you are requesting, please use PUT /v1/exchanges/${req.params.id}`,
            });
        }

        const { datatypes } = req.body as {
            datatypes?: { datatype?: string; authorization?: boolean }[];
        };

        datatypes.forEach((obj) => {
            const idx = due.data.findIndex(
                (data) => data.datatype.toString() === obj.datatype
            );

            if (idx === -1) return;

            due.data[idx].authorized = obj.authorization;
        });

        await due.save();
        return restfulResponse(res, 200, due);
    } catch (err) {
        next(err);
    }
};

/**
 * Revokes the exchange configuration request altogether
 * @author Felix Bole
 */
export const revokeExchangeConfigurationRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const due = await DataUseExchange.findById(req.params.id);

        if (!due) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange configuration not found.',
            });
        }

        if (due.serviceImport.toString() !== req.service.toString()) {
            return errorRes({
                req,
                res,
                code: 400,
                errorMsg: 'unauthorized action',
                message: `Cannot revoke an exchange configuration request on which your service is not the creator of the request. To revoke authorizations on rights to access your data on this exchange configuration, please use DELETE /v1/exchanges/${req.params.id}/authorization`,
            });
        }

        const deleted = await DataUseExchange.findByIdAndRemove(req.params.id);
        return restfulResponse(res, 200, deleted);
    } catch (err) {
        next(err);
    }
};

/**
 * Revokes all datatype access authorizations given by the service on
 * an existing exchange configuration
 * @author Felix Bole
 */
export const revokeExchangeConfigurationRequestAuthorizations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const due = await DataUseExchange.findById(req.params.id);

        if (!due) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Exchange configuration not found.',
            });
        }

        if (due.serviceImport.toString() !== req.service.toString()) {
            return errorRes({
                req,
                res,
                code: 400,
                errorMsg: 'unauthorized action',
                message: `Cannot revoke datatype access authorizations on this exchange configuration as you are the initiator of the exchange request. To revoke your exchange configuration request please use DELETE /v1/exchanges/${req.params.id}`,
            });
        }

        due.data.forEach((data) => {
            if (data.serviceExport.toString() !== req.service.toString())
                return;

            data.authorized = false;
        });

        await due.save();
        return restfulResponse(res, 200, due);
    } catch (err) {
        next(err);
    }
};
