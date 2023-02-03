//TODO Transform to separate lib / module

import {
    Dataset,
    DataSharingContract,
    DataType,
    TermsOfUse,
} from '@visionsofficial/visions-public-models';
import { DataSharingConditions } from '@visionsofficial/visions-public-models/lib/types/datasharingcontract';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { HydratedDocument, Types } from 'mongoose';
import { Logger } from '../libs/loggers';

/**
 * Creates a data sharing contract between 2 services
 * @param serviceImportId The id of the service Import
 * @param serviceExportId The id of the service Export
 * @param purposeId The id of the purpose to add to the contract
 * @param datatypes An array of datatype IDs
 * @author Felix Bole
 */
export const createDataSharingContract = async (
    serviceImportId: string | Types.ObjectId,
    serviceExportId: string | Types.ObjectId,
    purposeId: string | Types.ObjectId,
    datatypes: string[] | Types.ObjectId[]
) => {
    try {
        // Check for existing data sharing contract
        const existingContract = await DataSharingContract.findOne({
            $and: [
                { serviceImport: serviceImportId },
                { serviceExport: serviceExportId },
                { revoked: false },
            ],
        });

        if (existingContract) {
            const index = existingContract.dataSharing.findIndex(
                (el) => el.purpose == purposeId
            );

            if (index > -1) {
                // Replace with new datatypes or remove the purpose / datatype object if no datatypes are authorized
                if (datatypes.length > 0) {
                    existingContract.dataSharing[index].datatypes =
                        datatypes as Types.ObjectId[];
                } else {
                    existingContract.dataSharing.splice(index, 1);
                }

                for (const datatype of datatypes) {
                    const dt = await DataType.findById(datatype);

                    if (!dt) continue;

                    const dataset = await Dataset.findOne({
                        datatypes: dt.id,
                    });

                    if (dataset) {
                        if (
                            !existingContract.dataSharing[
                                index
                            ].conditions.includes(dataset.termsOfUse)
                        ) {
                            existingContract.dataSharing[index].conditions.push(
                                dataset.termsOfUse
                            );
                        }
                    }
                }
            } else {
                // Add new purpose / datatypes object

                const newDataSharing: DataSharingConditions = {
                    purpose: purposeId as Types.ObjectId,
                    datatypes: datatypes as Types.ObjectId[],
                    conditions: Array(0),
                };

                for (const datatype of datatypes) {
                    const dt = await DataType.findById(datatype);

                    if (!dt) continue;

                    const dataset = await Dataset.findOne({
                        datatypes: dt.id,
                    });

                    if (dataset) {
                        if (
                            !newDataSharing.conditions.includes(
                                dataset.termsOfUse
                            )
                        ) {
                            newDataSharing.conditions.push(dataset.termsOfUse);
                        }
                    }
                }

                existingContract.dataSharing.push(newDataSharing);
            }

            await existingContract.save();

            return existingContract;
        } else {
            // Create contract
            const contract = new DataSharingContract();

            // contract.serviceImport = toContract(serviceImport);
            // contract.serviceExport = toContract(serviceExport);
            contract.serviceImport = serviceImportId as Types.ObjectId;
            contract.serviceExport = serviceExportId as Types.ObjectId;

            const newDataSharing: DataSharingConditions = {
                purpose: purposeId as Types.ObjectId,
                datatypes: datatypes as Types.ObjectId[],
                conditions: Array(0),
            };

            for (const datatype of datatypes) {
                const dt = await DataType.findById(datatype);

                if (!dt) continue;

                const dataset = await Dataset.findOne({
                    datatypes: dt.id,
                });

                if (dataset) {
                    if (
                        !newDataSharing.conditions.includes(dataset.termsOfUse)
                    ) {
                        newDataSharing.conditions.push(dataset.termsOfUse);
                    }
                }
            }

            contract.dataSharing = [newDataSharing];

            await contract.save();

            return contract;
        }
    } catch (error) {
        Logger.error({
            message: error.message,
            location: 'contracts.createDataSharingContract',
        });
        return null;
    }
};

/**
 * Transforms a service model document into an object that contains only necessary information for the contract
 * @param  service service to adapt
 * @author Felix Bole
 */
export const toContract = (service: HydratedDocument<IService>) => {
    return {
        id: service.id,
        name: service.name,
        logo: service.logo,
        governance: '',
        endpoints: service.urls,
    };
};

/**
 * Populates a contract with necessary information to show on the frontend
 * @returns The populated contract
 * @author Felix Bole
 */
export const populateContract = async (contractId: Types.ObjectId | string) => {
    const populatedContract = await DataSharingContract.findById(
        contractId
    ).populate<{
        serviceImport: HydratedDocument<IService>;
        serviceExport: HydratedDocument<IService>;
    }>('serviceImport serviceExport');

    let populatedDatatypes = [];
    let populatedConditions = [];

    for (const ds of populatedContract.dataSharing) {
        for (const dt of ds.datatypes) {
            const datatype = await DataType.findById(dt).select('name id');
            populatedDatatypes.push(datatype._id);
        }
        ds.datatypes = populatedDatatypes;
        populatedDatatypes = [];

        for (const c of ds.conditions) {
            const termsOfUse = await TermsOfUse.findById(c);
            populatedConditions.push(termsOfUse._id);
        }
        ds.conditions = populatedConditions;
        populatedConditions = [];
    }

    return populatedContract;
};

/**
 * Checks if the contract is valid in the DSA Database
 * @author Felix Bole
 */
export const localVerify = async (
    serviceImportId: Types.ObjectId | string,
    serviceExportId: Types.ObjectId | string,
    purposeId: Types.ObjectId | string
) => {
    const dataSharingContract = await DataSharingContract.findOne({
        serviceExport: serviceExportId,
        serviceImport: serviceImportId,
        'dataSharing.purpose': purposeId,
    }).sort({ createdAt: -1 });

    if (!dataSharingContract) return false;

    if (dataSharingContract && !dataSharingContract.isValid()) return false;

    return true;
};
