import {
    Dataset,
    DatasetRequest,
    DataType,
    Purpose,
    TermsOfUse,
} from '@visionsofficial/visions-public-models';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';

/**
 * Search datasets
 * Created Date: 07/09/2021
 * @author Felix Bole
 * @todo format responses with errorRes / successRes
 */
export const searchDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 0;

        const queryPopulate = [
            { path: 'dataProvider', select: 'name legalRepresentative DPO' },
            { path: 'datatypes', select: 'name' },
            { path: 'termsOfUse' },
        ];

        if (req.query.datasetId) {
            try {
                const dataset = await Dataset.findById(
                    req.query.datasetId
                ).populate(queryPopulate);

                return res.json(dataset);
            } catch (error) {
                return res.status(404).json({
                    error: 'search-error',
                    message: 'Could not find datasetId',
                });
            }
        }

        if (req.query.service) {
            try {
                const datasets = await Dataset.find({
                    dataProvider: req.query.service,
                })
                    .skip(skip)
                    .limit(limit)
                    .populate(queryPopulate);

                return res.status(200).json(datasets);
            } catch (error) {
                return res.status(404).json({
                    error: 'search-error',
                    message: 'Could not find service',
                });
            }
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Returns all Datasets of the service
 * @author Felix Bole
 */
export const allDatasets = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const datasets = await Dataset.find({ dataProvider: req.service });

        if (datasets) return res.status(200).json({ datasets });
    } catch (error) {
        next(error);
    }
};

/**
 * Returns all Datasets of the service
 */
export const oneDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const dataset = await Dataset.findById(req.params.id);

        if (dataset) return res.status(200).json({ dataset });
    } catch (error) {
        next(error);
    }
};

/**
 * Creates a dataset for the service
 */
export const createDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const errors = [];

        if (
            !req.body.datatypes ||
            (req.body.datatypes && req.body.datatypes.length == 0)
        )
            return res.status(400).json({
                error: 'missing-parameter-error',
                message: 'datatypes missing from request body',
            });

        const datatypes = req.body.datatypes;

        const dataset = new Dataset();

        if (!req.body.termsOfUse)
            return res.status(400).json({
                error: 'missing-parameter-error',
                message: 'Missing termsOfUse from request body.',
            });

        dataset.dataProvider = req.service as Types.ObjectId;
        dataset.termsOfUse = req.body.termsOfUse;
        dataset.description = req.body.description || '';
        dataset.datatypes = [];

        for (const dt of datatypes) {
            const datatype = await DataType.findById(dt);

            if (datatype) {
                dataset.datatypes.push(dt);
            } else {
                errors.push(
                    'Could not add DataType : ' + dt + ' as it does not exist.'
                );
            }
        }

        await dataset.save();

        return res.status(200).json({
            message: 'Dataset successfully created',
            dataset: dataset,
            errors: errors.length > 0 ? errors : '',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletes a dataset with the specified id
 * @author Felix Bole
 */
export const deleteDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        await Dataset.findByIdAndRemove(req.body.datasetId);
        return res
            .status(201)
            .json({ success: 'Dataset successfully deleted' });
    } catch (error) {
        next(error);
    }
};

/**
 * Updates a dataset. If a terms of use id is specified, only changes the reference terms of use.
 * @author Felix Bole
 */
export const updateDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const errors = [];

        const dataset = await Dataset.findById(req.body.datasetId);

        if (req.body.termsOfUseId) {
            const tou = await TermsOfUse.findById(req.body.termsOfUseId);

            if (!tou)
                return res.status(404).json({
                    error: 'not-found-error',
                    message: 'The terms of use with this id do not exist.',
                });

            dataset.termsOfUse = req.body.termsOfUseId;
        }

        if (req.body.datatypes && req.body.datatypes.length > 0) {
            const datatypes = req.body.datatypes;

            for (const dt of datatypes) {
                const datatype = await DataType.findById(dt);

                if (datatype) {
                    dataset.datatypes.push(datatype._id);
                } else {
                    errors.push(
                        'Could not add DataType : ' +
                            dt +
                            ' as it does not exist.'
                    );
                }
            }
        }

        if (req.body.description && req.body.description != '')
            dataset.description = req.body.description;

        await dataset.save();

        if (errors.length > 0) {
            return res.status(400).json({ errors: errors });
        }

        return res
            .status(200)
            .json({ message: 'Successfully updated dataset', dataset });
    } catch (error) {
        next(error);
    }
};

/**
 * Requests access to a services Dataset
 * @author Felix Bole
 */
export const requestDataset = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.body.purpose) {
            return res.status(400).json({
                error: 'missing-param-error',
                message: 'Mising purpose from request body',
            });
        }

        const dataset = await Dataset.findById(req.params.datasetId);
        if (!dataset) {
            return res.status(404).json({
                error: 'not-found-error',
                message: 'Dataset ID not found',
            });
        }

        if (dataset.dataProvider == req.service) {
            return res.status(400).json({
                error: 'bad-request-error',
                message: 'Cannot make a request for your own dataset',
            });
        }

        const purpose = await Purpose.findById(req.body.purpose);
        if (!purpose) {
            return res.status(404).json({
                error: 'not-found-error',
                message: 'Purpose ID not found',
            });
        }

        const exists = await DatasetRequest.findOne({
            dataset: dataset.id,
            purpose: purpose.id,
            dataUser: req.service,
        });

        if (exists) {
            return res.status(400).json({
                message: 'A request already exists for this dataset.',
                request: exists,
            });
        }

        const datasetRequest = new DatasetRequest();
        datasetRequest.dataProvider = dataset.dataProvider;
        datasetRequest.dataUser = req.service as Types.ObjectId;
        datasetRequest.purpose = purpose.id;
        datasetRequest.dataset = dataset.id;

        await datasetRequest.save();

        return res.status(200).json({
            message: 'Successfully created dataset request',
            request: datasetRequest,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all incoming dataset requests
 * @author Felix Bole
 * @todo Check code relevance
 */
export const incomingDatasetRequests = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const requests = await DatasetRequest.find({
            dataProvider: req.service,
        });

        return res.status(200).json({ requests });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all outgoing dataset requests
 */
export const outgoingDatasetRequests = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const requests = await DatasetRequest.find({
            dataUser: req.service,
        });

        return res.status(200).json({ requests });
    } catch (error) {
        next(error);
    }
};

/**
 * Get info on one dataset request
 */
export const oneDatasetRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const populateQuery = [
            { path: 'dataProvider', select: 'name' },
            { path: 'dataUser', select: 'name' },
            { path: 'purpose', select: 'name' },
        ];

        const request = await DatasetRequest.findById(
            req.params.requestId
        ).populate(populateQuery);

        if (!request)
            return res.status(404).json({
                error: 'not-found-error',
                message: 'Request ID not found',
            });

        return res.status(200).json({ request });
    } catch (error) {
        next(error);
    }
};

/**
 * Authorize a dataset request
 */
export const authorizeDatasetRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const request = await DatasetRequest.findById(req.params.requestId);

        if (!request)
            return res.status(404).json({
                error: 'not-found-error',
                message: 'Request ID not found',
            });

        if (request.dataProvider !== req.service)
            return res.status(403).json({
                error: 'forbidden-error',
                message:
                    'Cannot authorize this dataset request as you are not the owner.',
            });

        request.authorized = true;

        await request.save();

        return res.status(200).json({
            message: 'Successfully authorized the dataset request.',
            request,
        });
    } catch (error) {
        next(error);
    }
};
