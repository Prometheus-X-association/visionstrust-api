import { DataSharingContract } from '@visionsofficial/visions-public-models';
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { restfulResponse } from '../../../libs/api/RESTfulResponse';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';
import { Logger } from '../../../libs/loggers';
import {
    createDataSharingContract,
    populateContract,
} from '../../../utils/contracts';
import { generateBlockchainToken } from '../../../utils/jwt';

const BASE_POPULATE_QUERY = [
    { path: 'serviceImport', select: 'name' },
    { path: 'serviceExport', select: 'name' },
    { path: 'dataSharing.datatypes', select: 'name' },
    { path: 'dataSharing.conditions' },
];

/**
 * Returns all contracts of a service
 * @author Felix Bole
 */
export const getMyContracts = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const dataSharingContracts = await DataSharingContract.find({
            $or: [
                { serviceImport: req.service },
                { serviceExport: req.service },
            ],
        }).populate(BASE_POPULATE_QUERY);

        return res.status(200).json(dataSharingContracts);
    } catch (error) {
        next(error);
    }
};

/**
 * Returns information about one contract using the contract ID
 * @author Felix Bole
 */
export const getOneContract = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const contract = await DataSharingContract.findById(
            req.params.contractId
        ).populate(BASE_POPULATE_QUERY);

        if (!contract) {
            return errorRes({
                req,
                res,
                code: 404,
                errorMsg: 'resource-not-found',
                message: 'Contract not found',
            });
        }

        return restfulResponse(res, 200, contract);
    } catch (error) {
        next(error);
    }
};

/**
 * Creates a data sharing contract
 * @author Felix Bole
 */
export const createContract = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const contract = await createDataSharingContract(
            req.body.serviceImportId,
            req.body.serviceExportId,
            req.body.purposeId,
            req.body.datatypes
        );

        if (!contract) {
            throw new Error('Failed to create contract');
        }

        const populatedContract = await populateContract(contract.id);

        return restfulResponse(res, 201, populatedContract);
    } catch (error) {
        next(error);
    }
};

/**
 * Gets a paginated list of contracts from the blockchain
 * @todo Verify relevance, old code
 * @author Felix Bole
 */
export const getContractsOnBlockchain = async (req: Request, res: Response) => {
    axios({
        method: 'GET',
        url: process.env.CONTRACTS_BLOCKCHAIN_ENDPOINT + '/contracts',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
        .then((data) => {
            return res.status(data.status).json(data);
        })
        .catch((err) => {
            res.json(err);
            Logger.error(
                '{contract.blockchain}.getContracts.axios.fail -- ' +
                    err.message
            );
        });
};

/**
 * Uploads a client's signature
 * @todo Verify relevance, old code
 * @author Felix Bole
 */
export const uploadClientSignature = async (req: Request, res: Response) => {
    const { contractId } = req.params;
    const { hash, signature, address } = req.body;
    const token = generateBlockchainToken(address, contractId, 'auth');
    const contract = await DataSharingContract.findById(contractId);

    if (!contract) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'not-found-error',
            message: 'Contract ID not found',
        });
    }

    axios({
        method: 'POST',
        url:
            process.env.CONTRACTS_BLOCKCHAIN_ENDPOINT +
            '/contracts/' +
            contractId +
            '/sign/client',
        data: {
            hash,
            signature,
        },
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: token,
        },
    })
        .then(async (response) => {
            // Update DSA with user signature
            contract.dataUserSignature = {
                signed: true,
                timestamp: new Date(),
            };

            await contract.save();

            return res.status(200).json({
                blokchainResponse: response.data,
                message: 'Data user signature successfully saved.',
                contract: contract,
            });
        })
        .catch((err) => {
            res.status(400).json(err);
            Logger.error(
                '{contract.blockchain}.uploadClientSignature.axios.fail -- ' +
                    err.message
            );
        });
};

/**
 * Uploads a provider's signature to the blockchain
 * @todo Verify relevance, old code
 * @author Felix Bole
 */
export const uploadProviderSignature = async (req: Request, res: Response) => {
    const { contractId } = req.params;
    const { hash, signature, address } = req.body;
    const token = generateBlockchainToken(address, contractId, 'auth');
    const contract = await DataSharingContract.findById(contractId);

    if (!contract) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'not-found-error',
            message: 'Contract ID not found',
        });
    }

    axios({
        method: 'POST',
        url:
            process.env.CONTRACTS_BLOCKCHAIN_ENDPOINT +
            '/contracts/' +
            contractId +
            '/sign/provider',
        data: {
            hash,
            signature,
        },
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: token,
        },
    })
        .then(async (response) => {
            // Update DSA with provider signature
            contract.dataProviderSignature = {
                signed: true,
                timestamp: new Date(),
            };

            await contract.save();

            return res.status(200).json({
                blokchainResponse: response.data,
                message: 'Data provider signature successfully saved.',
                contract: contract,
            });
        })
        .catch((err) => {
            res.json(err);
            Logger.error(
                '{contract.blockchain}.uploadClientSignature.axios.fail -- ' +
                    err.message
            );
        });
};

/**
 * Verifies a signature on the blockchain
 * @todo Verify relevance, old code
 * @author Felix Bole
 */
export const verifyContractOnBlockchain = async (
    req: Request,
    res: Response
) => {
    try {
        const contractId = req.params.contractId;

        axios({
            method: 'GET',
            url:
                process.env.CONTRACTS_BLOCKCHAIN_ENDPOINT +
                '/contracts/' +
                contractId +
                '/verify',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
        })
            .then((response) => {
                if (!response.data.data.txHash) {
                    return res.status(400).json({
                        error: 'txhash-null-error',
                        message: 'No txHash on contract',
                    });
                }
                return res.status(response.status).json(response.data);
            })
            .catch((err) => {
                res.json(err);
                Logger.error(
                    '{contract.blockchain}.verify.axios.fail -- ' + err.message
                );
                return;
            });
    } catch (error) {
        res.status(500).json({ error: 'internal-server-error' });
        Logger.error('{contract.blockchain}.verify.fail');
    }
};

/**
 * Revokes the contract
 * @todo Verify relevance, old code
 * @author Felix Bole
 */
export const revokeContractOnBlockchain = async (
    req: Request,
    res: Response
) => {
    try {
        const address = req.body.address;
        const contractId = req.params.contractId;

        const contract = await DataSharingContract.findById(contractId);

        if (!contract) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'not-found-error',
                message: 'Contract ID not found',
            });
        }

        const token = generateBlockchainToken(address, contractId, 'revoke');

        //! TEMPORARY IGNORE CALL TO REVOKE AS ENDPOINT IS NOT VALID
        contract.revoked = true;
        await contract.save();
        return res.status(200).json({
            message: 'Contract successfully revoked',
            contract: contract,
        });

        axios({
            method: 'POST',
            url:
                process.env.CONTRACTS_BLOCKCHAIN_ENDPOINT +
                '/contracts/' +
                contractId +
                '/revoke',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: token,
            },
        })
            .then(async (response) => {
                contract.revoked = true;

                await contract.save();

                return res.status(200).json({
                    blokchainResponse: response.data,
                    message: 'Contract successfully revoked',
                    contract: contract,
                });
            })
            .catch((err) => {
                res.json(err);
                Logger.error(
                    '{contract.blockchain}.revoke.axios.fail -- ' + err.message
                );
                return;
            });
    } catch (error) {
        res.status(500).json({ error: 'internal-server-error' });
        Logger.error('{contract.blockchain}.revoke.fail -- ' + error.message);
        return;
    }
};
