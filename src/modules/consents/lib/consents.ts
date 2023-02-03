import {
    ConsentExchange,
    DataUseExchange,
    Identifier,
    Purpose,
    Service,
    User,
} from '@visionsofficial/visions-public-models';
import { IDataType } from '@visionsofficial/visions-public-models/lib/types/datatype';
import { DataUseExchangeData } from '@visionsofficial/visions-public-models/lib/types/datauseexchange';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { HydratedDocument, Types } from 'mongoose';
import { isExchangeAuthorized } from '../../../utils/exchangeAuthHelper';
import { infoText } from './data';
import {
    UnauthorizedExchangeError,
    NoUserIdentifierError,
    handleCaughtErrors,
    NoExchangeDataError,
} from './errors';

export const buildSpecificInterappConsentPopupData = async (
    userId: Types.ObjectId | string,
    serviceImportId: Types.ObjectId,
    serviceExportId: Types.ObjectId,
    purposeId: Types.ObjectId | string
) => {
    try {
        const [
            isAuthorized,
            user,
            serviceImport,
            dataUseExchange,
            purpose,
            serviceExport,
        ] = await Promise.all([
            isExchangeAuthorized(serviceImportId, serviceExportId),
            // Can't lean user as we're possibly saving it in the identifier creation for type API
            User.findById(userId).populate<{
                identifiers: HydratedDocument<IIdentifier>[];
            }>('identifiers', 'service email userKey'),
            Service.findById(serviceImportId).select('name logo urls type'),
            DataUseExchange.findOne({ purpose: purposeId })
                .select('name description data')
                .populate<{
                    data: Omit<DataUseExchangeData, 'datatype'>[] &
                        {
                            datatype: HydratedDocument<IDataType>;
                        }[];
                }>('data.datatype', '_id name description')
                .lean(),
            Purpose.findById(purposeId).select('name description').lean(),
            Service.findById(serviceExportId).select('name logo urls type'),
        ]);

        if (!isAuthorized) {
            throw new UnauthorizedExchangeError(
                'buildSpecificInterappConsentPopupData'
            );
        }

        const userImportIdentifier = user.identifiers.find(
            (id) => id.service.toString() === serviceImportId.toString()
        );
        const userExportIdentifier = user.identifiers.find(
            (id) => id.service.toString() === serviceExportId.toString()
        );

        if (!userExportIdentifier) {
            throw new NoUserIdentifierError(
                'buildSpecificInterappConsentPopupData.1',
                serviceExportId.toString()
            );
        }

        let importIdentifier = userImportIdentifier;
        if (!userImportIdentifier) {
            // If service import is API, need to create it
            if (serviceImport.type === 1) {
                importIdentifier = await Identifier.createForAPIService(
                    serviceImportId,
                    user as typeof user & { identifiers: Types.ObjectId[] }
                );
            }
        }

        if (!dataUseExchange)
            throw new NoExchangeDataError(
                'buildSpecificInterappConsentPopupData.3'
            );

        const buildServiceInfo = (service: HydratedDocument<IService>) => {
            return {
                name: service.name,
                logo: `${process.env.URL}/images/services/` + service.logo,
                _id: service._id,
                id: service._id,
                termsOfUse: service.urls.termsOfUse || null,
            };
        };

        // Find last consentExchange if exists
        const lastConsent = await ConsentExchange.findOne({
            dataUseExchange: dataUseExchange._id,
            user: userId,
        }).select('-timestamp');

        const authorizedDatatypes = dataUseExchange.data.filter(
            (dt) =>
                dt.authorized &&
                dt.serviceExport.toString() === serviceExportId.toString()
        );

        const finalDatatypes: {
            datatype: IDataType;
            checked: boolean;
            provenance: {
                name: string;
                logo: string;
                _id: Types.ObjectId;
                id: Types.ObjectId;
                termsOfUse: string;
            };
        }[] = [];

        const pushDatatypeToArr = (
            datatype: IDataType,
            status: boolean,
            serviceExport: HydratedDocument<IService>
        ) => {
            finalDatatypes.push({
                datatype,
                checked: status,
                provenance: buildServiceInfo(serviceExport),
            });
        };

        if (lastConsent) {
            for (const dt of authorizedDatatypes) {
                const consentedDatatype = lastConsent.data.find(
                    (d) => d.datatype.toString() === dt.datatype._id.toString()
                );

                pushDatatypeToArr(
                    dt.datatype,
                    consentedDatatype ? consentedDatatype.authorized : false,
                    serviceExport
                );
            }
        } else {
            for (const dt of authorizedDatatypes) {
                pushDatatypeToArr(dt.datatype, false, serviceExport);
            }
        }

        const popupData = {
            infoText: infoText(
                serviceImport.name,
                typeof serviceExport === 'boolean' ? '' : serviceExport.name
            ),
            purpose: {
                _id: purpose._id,
                id: purpose._id,
                name: purpose.name,
                description: purpose.description,
            },
            serviceImport: buildServiceInfo(serviceImport),
            serviceExport: buildServiceInfo(serviceExport),
            user: {
                importIdentifier,
                exportIdentifier: userExportIdentifier,
            },
            launchConsentEndpoint: `${process.env.URL}/interapp/galaxystudent/consents/export`,
            datatypes: finalDatatypes,
            shouldRequestEmail: importIdentifier ? false : true,
            shouldRequestNewAccount:
                !importIdentifier && serviceImport.type !== 1,
        };

        return popupData;
    } catch (err) {
        handleCaughtErrors(err);
    }
};
