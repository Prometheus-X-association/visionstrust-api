import {
    Dataset,
    DataType,
    DataUseExchange,
    Purpose,
    Service,
} from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';

/**
 * Returns all DataTypes of the authenticated service
 * @author Felix Bole
 */
export const getOwnedDataTypes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const datatypes = await DataType.find({ provenance: req.service });
        return restfulResponse(res, 200, datatypes);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns a Service's DataType using its ID
 * @author Felix Bole
 */
export const getOwnedDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const datatype = await DataType.findOne({
            service: req.service,
            _id: req.params.id,
        });
        return restfulResponse(res, 200, datatype);
    } catch (err) {
        next(err);
    }
};

/**
 * Creates a new DataType
 * @author Felix Bole
 * @todo Switch remove the addition to the service datatypes (virtual lookup)
 */
export const createDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { name, description } = req.body;

        const [service, datatype] = await Promise.all([
            Service.findById(req.service),
            DataType.findOne({
                name: name,
                provenance: req.service,
            }),
        ]);

        if (datatype) {
            return errorRes({
                req,
                res,
                code: 409,
                errorMsg: 'existing resource conflict',
                message:
                    'A DataType with this name has already been created for your service',
            });
        }

        const newDatatype = new DataType({
            name,
            description,
            provenance: service.id,
        });
        service.datatypes.push(newDatatype.id);
        await Promise.all([newDatatype.save(), service.save()]);
        return restfulResponse(res, 201, newDatatype);
    } catch (err) {
        next(err);
    }
};

/**
 * Updates an existing datatype
 * @author Felix Bole
 */
export const updateDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const datatype = await DataType.findOne({
            _id: id,
            provenance: req.service,
        });

        if (!datatype) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource not found',
                message: 'No DataTypes found for this id',
            });
        }

        const {
            name,
            description,
            globalDatatype,
            conservationType,
            conservationUnit,
            conservationLength,
            conservationDescription,
            frequencyUnit,
            frequencyValue,
            frequencyRepeats,
        } = req.body;

        datatype.name = name || datatype.name;
        datatype.description = description || datatype.description;
        datatype.globalDatatype = globalDatatype || datatype.globalDatatype;
        datatype.conservationType =
            conservationType || datatype.conservationType;
        datatype.conservationUnit =
            conservationUnit || datatype.conservationUnit;
        datatype.conservationLength =
            conservationLength || datatype.conservationLength;
        datatype.conservationDescription =
            conservationDescription || datatype.conservationDescription;
        datatype.frequency = {
            unit: frequencyUnit || datatype.frequency.unit,
            value: frequencyValue || datatype.frequency.value,
            repeats: frequencyRepeats || datatype.frequency.repeats,
        };

        await datatype.save();
        return restfulResponse(res, 200, datatype);
    } catch (err) {
        next(err);
    }
};

/**
 * Deletes a datatype and handles all relation updates
 * @author Felix Bole
 */
export const deleteDataType = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const datatype = await DataType.findById(req.params.id);

        if (!datatype) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource not found',
                message: 'No DataTypes found for this id',
            });
        }

        const [service, dataUseExchanges, purposes, datasets] =
            await Promise.all([
                Service.findById(req.service),
                DataUseExchange.find({ 'data.datatype': datatype.id }),
                Purpose.find({
                    $or: [
                        { datatypes: datatype.id },
                        { consentData: datatype.id },
                        { importedDatatypes: datatype.id },
                    ],
                }),
                Dataset.find({ datatypes: datatype.id }),
            ]);

        const toSave = [];

        if (service) {
            const idx = service.datatypes.indexOf(datatype._id);
            if (idx !== -1) {
                service.datatypes.splice(idx, 1);
                toSave.push(service.save());
            }
        }

        dataUseExchanges.forEach((due) => {
            let modified = false;
            due.data.forEach((data) => {
                if (data.datatype.toString() === datatype.id) {
                    due.data.splice(
                        due.data.findIndex((d) => d.datatype === datatype.id),
                        1
                    );
                    modified = true;
                }
            });

            if (modified) toSave.push(due.save());
        });

        purposes.forEach((purpose) => {
            const dtIdx = purpose.datatypes.findIndex(
                (d) => d.toString() === datatype.id
            );
            if (dtIdx !== -1) purpose.datatypes.splice(dtIdx, 1);

            const consentDtIdx = purpose.consentData.findIndex(
                (d) => d.toString() === datatype.id
            );
            if (consentDtIdx !== -1)
                purpose.consentData.splice(consentDtIdx, 1);

            const importedDtIdx = purpose.importedDatatypes.findIndex(
                (d) => d.toString() === datatype.id
            );
            if (importedDtIdx !== -1)
                purpose.importedDatatypes.splice(importedDtIdx, 1);

            toSave.push(purpose.save());
        });

        datasets.forEach((dataset) => {
            dataset.datatypes.splice(dataset.datatypes.indexOf(datatype._id));
            toSave.push(dataset.save());
        });

        await Promise.all(toSave);
        return restfulResponse(res, 200, datatype);
    } catch (err) {
        next(err);
    }
};
