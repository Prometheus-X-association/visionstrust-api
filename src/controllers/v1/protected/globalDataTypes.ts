import {
    DataType,
    GlobalDataType,
} from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';

/**
 * Returns all datatypes of the service that are associated
 * with any of the existing globalDataTypes
 * @author Felix Bole
 */
export const getDataTypeToGlobalDataTypeAssociations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const datatypes = await DataType.find({
            provenance: req.service,
            globalDatatype: { $and: [{ $exists: true }, { $ne: null }] },
        }).populate('globalDatatype');

        return restfulResponse(res, 200, datatypes);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns all datatypes of the service associated to this global datatype
 * @author Felix Bole
 */
export const getAssociatedDataTypes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const datatypes = await DataType.find({
            provenance: req.service,
            globalDatatype: req.params.id,
        });
        return restfulResponse(res, 200, datatypes);
    } catch (err) {
        next(err);
    }
};

/**
 * Creates an association of a service's datatype to a global datatype
 * @author Felix Bole
 */
export const createDataTypeToGlobalDataTypeAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { datatype } = req.body;
        const { id } = req.params;
        const [foundDataType, gd] = await Promise.all([
            DataType.findById(datatype),
            GlobalDataType.findById(id),
        ]);

        if (!foundDataType) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'DataType not found',
            });
        }

        if (!gd) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Global DataType not found',
            });
        }

        if (foundDataType.globalDatatype) {
            return errorRes({
                req,
                res,
                code: 409,
                errorMsg: 'purpose global purpose association conflict',
                message: `This purpose already has an associated globalPurpose with ID : ${foundDataType.globalDatatype}`,
            });
        }

        foundDataType.globalDatatype = new Types.ObjectId(id);
        await foundDataType.save();
        return restfulResponse(res, 201, foundDataType);
    } catch (err) {
        next(err);
    }
};

/**
 * Updates an association of a datatype to a global datatype
 * @author Felix Bole
 */
export const updateDataTypeToGlobalDataTypeAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { datatype } = req.body;
        const { id } = req.params;
        const [foundDatatype, gd] = await Promise.all([
            DataType.findById(datatype),
            GlobalDataType.findById(id),
        ]);

        if (!foundDatatype) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'DataType not found',
            });
        }

        if (!gd) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Global DataType not found',
            });
        }

        foundDatatype.globalDatatype = new Types.ObjectId(id);
        await foundDatatype.save();
        return restfulResponse(res, 200, foundDatatype);
    } catch (err) {
        next(err);
    }
};

/**
 * Deletes an association of a datatype to a global DataType
 * @author Felix Bole
 */
export const deleteDataTypeToGlobalDataTypeAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { datatypeId } = req.params;
        const foundDatatype = await DataType.findById(datatypeId);

        if (!foundDatatype) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'DataType not found',
            });
        }

        foundDatatype.globalDatatype = undefined;
        await foundDatatype.save();
        return restfulResponse(res, 200, foundDatatype);
    } catch (err) {
        next(err);
    }
};
