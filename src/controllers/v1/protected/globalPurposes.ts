import { GlobalPurpose, Purpose } from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';

/**
 * Returns all purposes of the service that are associated
 * with any of the existing globalPurposes
 * @author Felix Bole
 */
export const getPurposeToGlobalPurposesAssociations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purposes = await Purpose.find({
            service: req.service,
            globalPurpose: { $and: [{ $exists: true }, { $ne: null }] },
        }).populate('globalPurpose', 'name');

        return restfulResponse(res, 200, purposes);
    } catch (err) {
        next(err);
    }
};

/**
 * Returns all purposes of the service associated to this globalPurpose
 * @author Felix Bole
 */
export const getAssociatedPurposes = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const purposes = await Purpose.find({
            service: req.service,
            globalPurpose: req.params.id,
        });
        return restfulResponse(res, 200, purposes);
    } catch (err) {
        next(err);
    }
};

/**
 * Creates an association of a service's purpose to a GlobalPurpose
 * @author Felix Bole
 */
export const createPurposeToGlobalPurposeAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { purpose } = req.body;
        const { id } = req.params;
        const [foundPurpose, gp] = await Promise.all([
            Purpose.findById(purpose),
            GlobalPurpose.findById(id),
        ]);

        if (!foundPurpose) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Purpose not found',
            });
        }

        if (!gp) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Global Purpose not found',
            });
        }

        if (foundPurpose.globalPurpose) {
            return errorRes({
                req,
                res,
                code: 409,
                errorMsg: 'purpose global purpose association conflict',
                message: `This purpose already has an associated globalPurpose with ID : ${foundPurpose.globalPurpose}`,
            });
        }

        foundPurpose.globalPurpose = new Types.ObjectId(id);
        await foundPurpose.save();
        return restfulResponse(res, 201, foundPurpose);
    } catch (err) {
        next(err);
    }
};

/**
 * Updates an association of a purpose to a global purpose
 * @author Felix Bole
 */
export const updatePurposeToGlobalPurposeAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { purpose } = req.body;
        const { id } = req.params;
        const [foundPurpose, gp] = await Promise.all([
            Purpose.findById(purpose),
            GlobalPurpose.findById(id),
        ]);

        if (!foundPurpose) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Purpose not found',
            });
        }

        if (!gp) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Global Purpose not found',
            });
        }

        foundPurpose.globalPurpose = new Types.ObjectId(id);
        await foundPurpose.save();
        return restfulResponse(res, 200, foundPurpose);
    } catch (err) {
        next(err);
    }
};

/**
 * Deletes an association of a purpose to a global purpose
 * @author Felix Bole
 */
export const deletePurposeToGlobalPurposeAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { purposeId } = req.params;
        const foundPurpose = await Purpose.findById(purposeId);

        if (!foundPurpose) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Purpose not found',
            });
        }

        foundPurpose.globalPurpose = undefined;
        await foundPurpose.save();
        return restfulResponse(res, 200, foundPurpose);
    } catch (err) {
        next(err);
    }
};
