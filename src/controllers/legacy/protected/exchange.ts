import {
    DataUseExchange,
    ExchangeAuthorization,
    Purpose,
    Service,
} from '@visionsofficial/visions-public-models';
import { IDataType } from '@visionsofficial/visions-public-models/lib/types/datatype';
import { DataUseExchangeData } from '@visionsofficial/visions-public-models/lib/types/datauseexchange';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { Request, Response } from 'express';
import { HydratedDocument } from 'mongoose';
import { Logger } from '../../../libs/loggers';

/**
 * Get all data required to generate a popup window to allow user to exchange data
 * @author Yanick Kifack
 * @author Felix Bole
 */
export const getAllExchangePurposes = async (req: Request, res: Response) => {
    try {
        const service = await Service.findById(req.params.serviceId).select(
            'name'
        );

        if (service) {
            const dataUseExchanges = await DataUseExchange.find({
                serviceImport: service.id,
            })
                .select('purpose')
                .populate<{ purpose: HydratedDocument<IPurpose> }>('purpose', [
                    'name',
                    'privacyIcon',
                ]);

            const purposes = dataUseExchanges.map((de) => ({
                purpose: de.purpose.name,
                privacyIcon: de.purpose.privacyIcon,
            }));

            res.json(purposes);
        } else {
            res.status(404).json({
                success: false,
                message: 'Service not found',
            });
        }
    } catch (err) {
        Logger.error({
            message: err.message,
            location: 'legacy.exchanges.getAllExchangePurposes',
        });
        res.status(500).json({
            error: 'internal-server-error',
            details: err.message,
        });
    }
};

/**
 * Validates a data specific export request for another service's purpose
 * @author Yanick Kifack
 * @author Felix Bole
 */
export const validateDemands = async (req: Request, res: Response) => {
    const { serviceExportId, serviceImportId, purposeId } = req.body;

    const [purpose, dataUseExchange] = await Promise.all([
        Purpose.findById(purposeId),
        DataUseExchange.findOne({
            purpose: purposeId,
            serviceImport: serviceImportId,
            'data.serviceExport': serviceExportId,
        }).populate<{
            data: DataUseExchangeData[] & {
                datatype?: HydratedDocument<IDataType>;
            };
        }>('data.datatype'),
    ]);

    const data = dataUseExchange.data;
    const datatypes: any[] = req.body.datatypes;

    const datatypesForDataSharingContract = [];

    for (let i = 0; i < data.length; i++) {
        const datatype = data[i].datatype;

        if (!datatype) continue;

        // Find if DUE datatype.name is in selected datatypes
        const selectedDatatype = datatypes.find((dt) => dt.id === datatype.id);

        if (
            data[i].serviceExport.toString() === serviceExportId &&
            selectedDatatype != undefined
        ) {
            dataUseExchange.data[i].authorized = selectedDatatype.checked; // Update DUE

            await dataUseExchange.save();

            const alreadyInPurpose = purpose.importedDatatypes.find(
                (dt) => dt.datatype.toString() === data[i].datatype.toString()
            );

            if (selectedDatatype.checked == true) {
                datatypesForDataSharingContract.push(datatype.id);

                if (alreadyInPurpose == undefined) {
                    const importedDatatype = {
                        datatype: datatype._id,
                        used: true,
                    };

                    purpose.importedDatatypes.push(importedDatatype);
                    await purpose.save();
                }
            } else {
                // Find datatype in purpose imported datatypes and remove
                const updatedImportedDatatypes =
                    purpose.importedDatatypes.filter(
                        (dt) => dt.datatype.id !== datatype.id
                    );

                purpose.importedDatatypes = updatedImportedDatatypes;
                await purpose.save();
            }
        }
    }

    await dataUseExchange.save();

    res.json({ success: true });
};

/**
 * Get list of all export services
 * @author Felix Bole
 */
export const getExportServices = async (req: Request, res: Response) => {
    try {
        const { serviceId } = req.params;
        const { purpose: payloadPurpose } = req.body;

        const dataUseExchange = await DataUseExchange.findOne({
            purpose: payloadPurpose,
            serviceImport: serviceId,
        }).populate<{
            data: DataUseExchangeData[] &
                { serviceExport: HydratedDocument<IService> }[];
        }>('data.serviceExport');

        const serviceNames: string[] = [];

        if (!dataUseExchange) return res.json({ services: serviceNames });

        const data = dataUseExchange.data;
        for (let i = 0; i < data.length; i++) {
            const name = data[i].serviceExport.name;

            if (serviceNames.indexOf(name) === -1) serviceNames.push(name);
        }

        res.json({ services: serviceNames });
    } catch (err) {
        Logger.error({
            message: err.message,
            location: 'legacy.exchange.getExportServices',
        });
        return res
            .status(500)
            .json({ error: 'internal-server-error', details: err.message });
    }
};

/**
 * Get list of purposes from service and requested service
 * @author Felix Bole
 * @author Yanic Kifack
 */
export const getAllExchangePurposesList = async (
    req: Request,
    res: Response
) => {
    try {
        const [service, otherService] = await Promise.all([
            Service.findOne({ serviceKey: req.service }),
            Service.findOne({ name: req.body.serviceName }),
        ]);

        if (!service)
            return res.status(404).json({
                success: false,
                message: 'Could not find your service',
            });
        if (!otherService)
            return res.status(404).json({
                success: false,
                message:
                    'Could not find import service for serviceName: ' +
                    req.body.serviceName,
            });

        // If serviceName matches the service making the request, simply return its own purposes
        if (service._id.toString() === otherService._id.toString()) {
            const populatedService = await Service.findById(service.id)
                .populate<{ purposes: HydratedDocument<IPurpose>[] }>(
                    'purposes'
                )
                .select('name id');

            const p = [];
            for (const purpose of populatedService.purposes) {
                if (purpose.name === 'Automatic Purpose Created') continue;
                p.push({
                    purposeName: purpose.name,
                    purposeId: purpose.id,
                    description: purpose.description,
                });
            }

            return res.json({ purposes: p });
        }

        // If service is requesting purposes from a different service check the exchange authorization between them
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

        // Find all dataUseExchanges where service making the request is import
        const dataUseExchanges = await DataUseExchange.find({
            $or: [
                { serviceImport: otherService.id },
                { serviceImport: service.id },
            ],
        }).populate<{ purpose: HydratedDocument<IPurpose> }>({
            path: 'purpose',
            select: 'name id',
        });

        const purposes = [];
        if (dataUseExchanges.length > 0 || dataUseExchanges != null) {
            for (const due of dataUseExchanges) {
                if (!due.purpose) continue;

                let purpose: any = null;

                const serviceToUse =
                    due.serviceImport.toString() == otherService.id.toString()
                        ? service
                        : otherService;
                const isExport =
                    due.serviceImport.toString() == otherService.id.toString();

                let hasDataFromService = false;

                for (const item of due.data) {
                    if (
                        item.serviceExport.toString() ===
                            serviceToUse.id.toString() &&
                        item.authorized
                    ) {
                        hasDataFromService = true;
                        break;
                    }
                }

                if (hasDataFromService) {
                    purpose = {};
                    purpose.purposeName = due.purpose.name;
                    purpose.description = due.purpose.description;
                    purpose.purposeId = due.purpose.id;
                    purpose.owner = isExport ? otherService.name : service.name;

                    if (isExport) purpose.export = true;
                    else purpose.import = true;
                }

                if (purpose !== null) purposes.push(purpose);
            }
        }

        return res.status(200).json({
            success: true,
            purposes: purposes,
            description: otherService.description,
        });
    } catch (error) {
        Logger.error({
            message: error.message,
            location: 'legacy.getAllExchangePurposesList',
        });
        return res.status(500).json({ error: 'internal-server-error' });
    }
};
