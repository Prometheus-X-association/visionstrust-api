import {
    DataUseExchange,
    ExchangeAuthorization,
    Purpose,
    Service,
} from '@visionsofficial/visions-public-models';
import { IDataType } from '@visionsofficial/visions-public-models/lib/types/datatype';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { ModelConverter } from '@visionsofficial/visions-public-models/lib/utils';
import { NextFunction, Request, Response } from 'express';
import { HydratedDocument, Types } from 'mongoose';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';
import { Logger } from '../../../libs/loggers';

/**
 * Returns all owned purposes
 * @author Felix Bole
 */
export const getOwnedPurposes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purposes = await Purpose.find({ service: req.service });
        return restfulResponse(res, 200, purposes);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns an owned purpose by ID
 * @author Felix Bole
 */
export const getOwnedPurpose = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purpose = await Purpose.findOne({
            service: req.service,
            _id: req.params.id,
        });
        return restfulResponse(res, 200, purpose);
    } catch (err) {
        next(err);
    }
};

/**
 * Creates a purpose for the authenticated service
 * @author Felix Bole
 */
export const createPurpose = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { name, description } = req.body;
        const purpose = new Purpose({
            name,
            description,
            service: req.service,
        });
        await purpose.save();
        return restfulResponse(res, 201, purpose);
    } catch (err) {
        next(err);
    }
};

/**
 * Updates an existing purpose via its ID
 * @author Felix Bole
 */
export const updatePurpose = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { name, description } = req.body;
        const purpose = await Purpose.findOne({
            service: req.service,
            _id: req.params.id,
        });

        if (!purpose) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Purpose not found',
            });
        }

        purpose.name = name || purpose.name;
        purpose.description = description || purpose.description;

        await purpose.save();

        return restfulResponse(res, 200, purpose);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns complete purpose information with giver purpose ID
 * @author Felix Bole
 */
export const getPurposeInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purpose = await Purpose.findById(req.params.purposeId)
            .populate<{
                service: Pick<HydratedDocument<IService>, 'name' | '_id'>;
            }>('service', 'name')
            .populate<{
                datatypes: IDataType[] & {
                    provenance: Pick<
                        HydratedDocument<IService>,
                        'name' | '_id'
                    >;
                };
            }>({
                path: 'datatypes',
                populate: { path: 'provenance', select: 'name' },
            })
            .populate<{
                importedDatatypes: {
                    datatype: IDataType & {
                        provenance: Pick<
                            HydratedDocument<IService>,
                            'name' | '_id'
                        >;
                    };
                };
            }>({
                path: 'importedDatatypes.datatype',
                populate: { path: 'provenance', select: 'name' },
            });

        if (!purpose) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'purpose not found',
                message: 'The purpose does not exist',
            });
        }

        return res.status(200).json(ModelConverter.toPurposeModel(purpose));
    } catch (error) {
        Logger.error(`purposes.getPurposeInfo -- ${error.message}`);
        next(error);
    }
};

/**
 * Returns the services to which you can get purpose information from
 * @author Felix Bole
 */
export const getConfiguredExchangeServices = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const exchanges = await ExchangeAuthorization.getAllByService(
            req.service,
            {
                populate: true,
                lean: false,
            }
        );

        if (!exchanges || exchanges.length === 0) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'exchange authorization not found',
                message:
                    'No exchange authorization was found with other services.',
            });
        }

        const services: string[] = [];

        for (const exchange of exchanges) {
            if (!exchange.isAuthorized()) continue;
            if (!exchange.requester.service || !exchange.receiver.service)
                continue; // TODO Clean broken authExchanges
            if (
                exchange.requester.service._id.toString() !==
                req.service.toString()
            ) {
                if (
                    !services.includes(
                        exchange.requester.service._id.toString()
                    ) &&
                    !(exchange.requester.service instanceof Types.ObjectId)
                )
                    services.push(exchange.requester.service.name);
            }
            if (
                exchange.receiver.service._id.toString() !==
                req.service.toString()
            ) {
                if (
                    !services.includes(
                        exchange.receiver.service._id.toString()
                    ) &&
                    !(exchange.receiver.service instanceof Types.ObjectId)
                )
                    services.push(exchange.receiver.service.name);
            }
        }

        return res.status(200).json(services);
    } catch (error) {
        Logger.error(
            'purposes.getConfiguredExchangeServices -- ' + error.message
        );
        next(error);
    }
};

/**
 * Returns the configured purposes with another given service
 * @author Felix Bole
 */
export const getConfiguredPurposesWithService = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const [service, otherService] = await Promise.all([
            Service.findById(req.service),
            Service.findOne({ name: req.params.serviceName }),
        ]);

        if (!otherService) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'service not found',
                message:
                    'Could not find the service you are looking for. Please note the service name is case sensitive.',
            });
        }

        if (service._id.toString() !== otherService._id.toString()) {
            const authorization = await ExchangeAuthorization.getAuthorization(
                service._id,
                otherService._id,
                true
            );

            if (!authorization.authorization)
                return res.status(403).json({
                    error: 'unauthorized-exchange-error',
                    message: `You have no configured exchange authorization with ${otherService.name}`,
                });
        }

        // Find all dataUseExchanges
        const dataUseExchanges = await DataUseExchange.find({
            $or: [
                { serviceImport: otherService.id },
                { serviceImport: service.id },
            ],
        }).populate<{
            purpose: Pick<HydratedDocument<IPurpose>, 'name' | 'id' | '_id'>;
        }>({
            path: 'purpose',
            select: 'name id',
        });

        if (!dataUseExchanges || dataUseExchanges.length === 0) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'exchange configuration not found',
                message: 'No configured exchange was found with this service.',
            });
        }

        type ReturnedPurpose = {
            purposeName: string;
            purposeId: string;
            owner: string;
            import: boolean;
            export: boolean;
        };

        const purposes: ReturnedPurpose[] = [];

        if (dataUseExchanges.length > 0 || dataUseExchanges != null) {
            for (const due of dataUseExchanges) {
                if (!due.purpose) continue;

                const purpose: ReturnedPurpose = {
                    purposeName: due.purpose.name,
                    purposeId: due.purpose.id,
                    owner: '',
                    import: false,
                    export: false,
                };

                if (
                    due.serviceImport.toString() == otherService.id.toString()
                ) {
                    purpose.owner = otherService.name;
                    purpose.import = false;
                    purpose.export = true;
                } else {
                    purpose.owner = service.name;
                    purpose.import = true;
                    purpose.export = false;
                }
                purposes.push(purpose);
            }
        }

        return restfulResponse(res, 200, purposes);
    } catch (error) {
        Logger.error(
            'purposes.getConfiguredPurposesWithService -- ' + error.message
        );
        next(error);
    }
};

/**
 * Returns the list of owned purposes in a service
 * @author Felix Bole
 */
export const getOwnedPurposeInformation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purposes = await Purpose.find({ service: req.service })
            .populate('datatypes')
            .populate('importedDatatypes')
            .populate('service');

        const returnedPurposes = [];

        for (const p of purposes) {
            returnedPurposes.push({
                id: p.id,
                name: p.name,
                description: p.description,
            });
        }

        return restfulResponse(res, 200, returnedPurposes);
    } catch (error) {
        Logger.error('purposes.getOwnedPurposeInformation -- ' + error.message);
        next(error);
    }
};

/**
 * Adds a datatype to the list of DataTypes the purpose uses
 * @author Felix Bole
 * @todo imported Datatypes should simply be an array of IDs, the used field is not useful
 */
export const addImportedDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purpose = await Purpose.findById(req.params.id);
        const { dataTypeId } = req.body;

        const existing = purpose.importedDatatypes.find(
            (dt) => dt.datatype.toString() === dataTypeId
        );
        if (!existing) {
            purpose.importedDatatypes.push({
                datatype: dataTypeId,
                used: true,
            });

            await purpose.save();
        }

        return restfulResponse(res, 200, purpose);
    } catch (err) {
        next(err);
    }
};

/**
 * Removes an imported datatype from the purpose
 * @author Felix Bole
 */
export const removeImportedDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purpose = await Purpose.findById(req.params.id);
        const { dataTypeId } = req.body;

        const existing = purpose.importedDatatypes.findIndex(
            (dt) => dt.datatype.toString() === dataTypeId
        );
        if (existing) {
            purpose.importedDatatypes.splice(existing, 1);
            await purpose.save();
        }

        return restfulResponse(res, 200, purpose);
    } catch (err) {
        next(err);
    }
};
