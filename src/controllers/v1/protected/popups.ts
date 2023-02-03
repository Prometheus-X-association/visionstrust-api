import {
    AuthenticationInfo,
    ConsentExchange,
    DataType,
    DataUseExchange,
    ExchangeAuthorization,
    Identifier,
    Purpose,
    Service,
    User,
} from '@visionsofficial/visions-public-models';
import { DataUseExchangeData } from '@visionsofficial/visions-public-models/lib/types/datauseexchange';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { IUser } from '@visionsofficial/visions-public-models/lib/types/user';
import axios from 'axios';
import { Request, Response } from 'express';
import { HydratedDocument } from 'mongoose';
import { errorRes } from '../../../libs/api/VisionsAPIResponse';
import { Logger } from '../../../libs/loggers';
import { isExchangeAuthorized } from '../../../utils/exchangeAuthHelper';
import { makeId } from '../../../utils/idGenerator';
import { CreateHashCodeForOauth } from '../../../utils/securityHash';

type PopupPurpose = {
    name: string;
    id: string;
    flow: string;
    popupRequestMethod: string;
    details: string;
    popupRequestEndpoint: string;
};
type PurposeObjects = {
    service: string;
    description: string;
    purposes: PopupPurpose[];
};

/**
 * Generates data to load any existing exchange popup
 * @author Felix Bole
 * @todo Find how to specify the type instead of any in the populated DUE
 */
export const getAllExchangePopups = async (req: Request, res: Response) => {
    try {
        const response: {
            export: PurposeObjects[];
            import: PurposeObjects[];
        } = { export: [], import: [] };
        response.export = [];
        response.import = [];
        const isLegacy = !!req.query.isLegacy;

        const [service, exchanges] = await Promise.all([
            Service.findById(req.service),
            ExchangeAuthorization.getAllByService(req.service, {
                populate: true,
                lean: false,
            }),
        ]);

        /**
         * Builds a purpose popup element
         * @param configuredExchange The configured exchange
         * @param flow import || export
         * @param isLegacyRequest If the request is rerouted from a legacy call
         * @returns The purpose / configured exchange
         */
        const buildPopupElement = (
            configuredExchange: any,
            flow: 'import' | 'export',
            isLegacyRequest: boolean
        ) => {
            const popupElement = {
                name: configuredExchange.purpose.name,
                id: configuredExchange.purpose._id.toString(),
                flow,
                popupRequestMethod: 'POST',
                details: '',
                popupRequestEndpoint: '',
            };

            if (flow == 'import') {
                popupElement.details =
                    "The request will need the key 'emailImport' (string) to be informed in the body. This will be the email of the user currently logged in your service.";
            } else {
                popupElement.details =
                    "The request will need the following keys to be informed in the body: 'purpose' (string), which is the purpose id found inside this response and 'emailExport' (string), the email of the user currently logged in to your service.";
            }

            if (isLegacyRequest) {
                if (flow == 'import') {
                    popupElement.popupRequestEndpoint = `${process.env.URL}/exchange/popup/${popupElement.id}`;
                } else {
                    popupElement.popupRequestEndpoint = `${process.env.URL}/consents/popup/export`;
                }
            } else {
                popupElement.popupRequestEndpoint = `${process.env.API_URL}/popups/${flow}`;
            }

            return popupElement;
        };

        for (const exchange of exchanges) {
            if (!exchange.isAuthorized()) continue;

            // Import
            const importExchanges = await DataUseExchange.find({
                $and: [
                    { serviceImport: service._id },
                    {
                        $or: [
                            {
                                'data.serviceExport':
                                    exchange.requester.service._id,
                            },
                            {
                                'data.serviceExport':
                                    exchange.receiver.service._id,
                            },
                        ],
                    },
                ],
            })
                .populate<{
                    data: DataUseExchangeData[] &
                        {
                            serviceExport: Pick<
                                HydratedDocument<IService>,
                                'name' | 'description' | '_id'
                            >;
                        }[];
                }>('data.serviceExport', 'name description')
                .populate<{
                    purpose: Pick<HydratedDocument<IPurpose>, 'name' | '_id'>;
                }>('purpose', 'name');

            if (!importExchanges.length) continue;

            for (const ie of importExchanges) {
                if (!ie.purpose) continue;

                for (const data of ie.data) {
                    // Check if the service export is already in response service list
                    const serviceIndex = response.import.findIndex(
                        (s) => s.service == data.serviceExport.name
                    );

                    if (serviceIndex > -1) {
                        // Check if the purpose is in the purpose list for the service
                        const purposeIndex = response.import[
                            serviceIndex
                        ].purposes.findIndex(
                            (p) => p.id.toString() === ie.purpose._id.toString()
                        );

                        if (purposeIndex === -1) {
                            const tmpPurpose = buildPopupElement(
                                ie,
                                'import',
                                isLegacy
                            );
                            response.import[serviceIndex].purposes.push(
                                tmpPurpose
                            );
                        }
                    } else {
                        const tmpService = {
                            service: data.serviceExport.name,
                            description: data.serviceExport.description,
                            purposes: Array(0),
                        };

                        const tmpPurpose = buildPopupElement(
                            ie,
                            'import',
                            isLegacy
                        );
                        tmpService.purposes.push(tmpPurpose);
                        response.import.push(tmpService);
                    }
                }
            }

            // Export
            const otherServiceId =
                exchange.requester.service._id.toString() ===
                service._id.toString()
                    ? exchange.receiver.service._id
                    : exchange.requester.service._id;

            const exportExchanges = await DataUseExchange.find({
                $and: [
                    { serviceImport: otherServiceId },
                    { 'data.serviceExport': service._id },
                ],
            })
                .populate<{
                    data: DataUseExchangeData[] &
                        {
                            serviceExport: HydratedDocument<IService>;
                        }[];
                }>('data.serviceExport', 'name description')
                .populate<{ purpose: HydratedDocument<IPurpose> }>(
                    'purpose',
                    'name'
                )
                .populate<{ serviceImport: HydratedDocument<IService> }>(
                    'serviceImport',
                    'name description'
                );

            if (!exportExchanges.length) continue;

            for (const ee of exportExchanges) {
                if (!ee.purpose) continue;

                // Check if service Import is in the service list export
                const serviceIndex = response.export.findIndex(
                    (s) => s.service == ee.serviceImport.name
                );

                if (serviceIndex > -1) {
                    // Check if the purpose is in the purpose list for the service
                    const purposeIndex = response.export[
                        serviceIndex
                    ].purposes.findIndex((p) => p.id == ee.purpose.id);

                    if (purposeIndex === -1) {
                        const tmpPurpose = buildPopupElement(
                            ee,
                            'export',
                            isLegacy
                        );
                        response.export[serviceIndex].purposes.push(tmpPurpose);
                    }
                } else {
                    const tmpService = {
                        service: ee.serviceImport.name,
                        description: ee.serviceImport.description,
                        purposes: Array(0),
                    };

                    const tmpPurpose = buildPopupElement(
                        ee,
                        'export',
                        isLegacy
                    );
                    tmpService.purposes.push(tmpPurpose);
                    response.export.push(tmpService);
                }
            }
        }

        res.status(200).json(response);
    } catch (err) {
        Logger.error('popups.getAllExchangePopups -- ' + err.message);
        return res
            .status(500)
            .json({ error: 'internal-server-error', details: err.message });
    }
};

/**
 * Generates data for the Import service exchange popup
 * @author Yanick Kifack
 * @author Felix Bole
 * @todo This method needs serious optimization work
 */
export const getImportPopup = async (req: Request, res: Response) => {
    try {
        const [serviceImport, purpose, dataUseExchange] = await Promise.all([
            Service.findById(req.service),
            Purpose.findById(req.body.purpose.trim()),
            await DataUseExchange.findOne({
                purpose: req.body.purpose.trim(),
            }),
        ]);
        if (!purpose)
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'purpose not found',
                message: 'Purpose not found',
            });

        if (purpose.service.toString() !== serviceImport.id.toString()) {
            return errorRes({
                code: 403,
                req,
                res,
                errorMsg: 'purpose-not-owned',
                message: 'The purpose does not belong to your service',
            });
        }

        if (!dataUseExchange) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'exchange configuration not found',
                message: 'No import exchange data found for this purpose.',
            });
        }

        const exportServices = [];
        const serviceIds: string[] = [];

        //Get list of datatypes allowed for exchange
        const datatypes = dataUseExchange.data.filter(
            (item) => item.authorized
        );

        const userImportIdentifier = await Identifier.findOne({
            email: req.body.emailImport.trim(),
            service: serviceImport.id,
        });

        if (!userImportIdentifier) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'user identifier not found',
                message:
                    "The User's identifier for this email does not exist. Please make sure you have created a User for this email before trying to do a data exchange.",
            });
        }

        const infoText = `Visions ne stocke pas et n'accède jamais aux données qui circulent. Nous garantissons que vos données sont uniquement utilisées par ${serviceImport.name} pour la finalité décrite et aucune autre.
    Vous pouvez révoquer votre consentement à tout moment depuis ${serviceImport.name}, l'un des services d'export de la donnée ou depuis votre compte Visions. Nous vous envoyons un email récapitulatif. Les partenaires de notre réseau de données sont engagés juridiquement et contraints techniquement à respecter vos consentements. Nous vous avertirons au moindre écart ou à la moindre faille et nous assurerons que vos droits sont respectés.`;

        //Result object to send to the import service
        const result = {
            purpose: purpose.name,
            description: purpose.description,
            tosImport: serviceImport.urls.termsOfUse,
            exportServices: Array(0),
            infoText: infoText,
            datatypes: Array(0),
            emailsExport: Array(0),
            authUrls: Array(0),
        };

        // Verify if SI identifier has a user associated
        // If there is a user associated
        if (userImportIdentifier.user) {
            // Check for previous consentExchange
            const lastConsent = await ConsentExchange.findOne({
                dataUseExchange: dataUseExchange.id,
                user: userImportIdentifier.user,
            }).sort({ createdAt: -1 });

            const datatypesList = [];

            if (lastConsent) {
                // Get datatypes and status
                for (let i = 0; i < datatypes.length; i++) {
                    // If dataUseExchange datatypes are authorized

                    // Find id of corresponding datatype in consentExchange
                    const datatype = await DataType.findById(
                        datatypes[i].datatype
                    ).populate<{
                        provenance: Pick<
                            HydratedDocument<IService>,
                            'name' | '_id'
                        >;
                    }>('provenance', 'name');

                    const datatypeId = lastConsent.data.find(
                        (dt) =>
                            dt.datatype.toString() === datatype.id.toString()
                    );

                    const serviceExportId = datatypes[i].serviceExport;

                    if (serviceIds.indexOf(serviceExportId.toString()) == -1) {
                        serviceIds.push(serviceExportId.toString());
                        const service = await Service.findById(
                            serviceExportId
                        ).select('name urls.termsOfUse logo');
                        exportServices.push(service.name);
                        result.exportServices.push({
                            serviceId: service.id,
                            serviceName: service.name,
                            logo:
                                'https://visionstrust.com/images/services/' +
                                service.logo,
                            description: service.description,
                            termsOfUse: service.urls.termsOfUse,
                        });
                    }
                    datatypesList.push({
                        id: datatype.id,
                        name: datatype.name || '',
                        description: datatype.description,
                        provenance: datatype.provenance.name,
                        checked:
                            datatypeId != undefined
                                ? datatypeId.authorized
                                : false,
                        serviceExport:
                            exportServices[exportServices.length - 1],
                    });
                }
            } else {
                for (let i = 0; i < datatypes.length; i++) {
                    // Find id of corresponding datatype in consentExchange
                    const datatype = await DataType.findById(
                        datatypes[i].datatype
                    ).populate<{
                        provenance: Pick<
                            HydratedDocument<IService>,
                            'name' | '_id'
                        >;
                    }>('provenance', 'name');

                    const serviceExportId = datatypes[i].serviceExport;

                    if (serviceIds.indexOf(serviceExportId.toString()) == -1) {
                        serviceIds.push(serviceExportId.toString());
                        const service = await Service.findById(
                            serviceExportId
                        ).select('name urls.termsOfUse logo');
                        exportServices.push(service.name);
                        result.exportServices.push({
                            serviceId: service.id,
                            serviceName: service.name,
                            logo:
                                'https://visionstrust.com/images/services/' +
                                service.logo,
                            description: service.description,
                            termsOfUse: service.urls.termsOfUse,
                        });
                    }

                    datatypesList.push({
                        id: datatype.id,
                        name: datatype.name || '',
                        description: datatype.description,
                        provenance: datatype.provenance.name,
                        checked: false,
                        serviceExport:
                            exportServices[exportServices.length - 1],
                    });
                }
            }

            result.datatypes = datatypesList;

            // Find User
            const user = await User.findById(
                userImportIdentifier.user
            ).populate<{ identifiers: HydratedDocument<IIdentifier>[] }>(
                'identifiers'
            );

            const existingIdentifiers = [];
            const notExistingIdentifiers = [];

            for (let i = 0; i < serviceIds.length; i++) {
                const existingIdentifier = user.identifiers.find(
                    (identifier) =>
                        identifier.service.toString() === serviceIds[i]
                );

                if (existingIdentifier)
                    existingIdentifiers.push({
                        serviceId: serviceIds[i],
                        service: exportServices[i],
                        identifier: existingIdentifier,
                    });
                else
                    notExistingIdentifiers.push({
                        serviceId: serviceIds[i],
                        service: exportServices[i],
                    });
            }

            if (existingIdentifiers.length > 0) {
                const emails = [];

                for (let i = 0; i < existingIdentifiers.length; i++) {
                    const emailExport = (
                        await Identifier.findById(
                            existingIdentifiers[i].identifier
                        ).select('email')
                    ).email;

                    emails.push({
                        email: emailExport,
                        service: existingIdentifiers[i].service,
                    });
                }

                // Add email export to the result
                result.emailsExport = emails;
            }
        } else {
            const datatypesList = [];
            for (let i = 0; i < datatypes.length; i++) {
                const serviceExportId = datatypes[i].serviceExport;

                if (serviceIds.indexOf(serviceExportId.toString()) == -1) {
                    serviceIds.push(serviceExportId.toString());
                    const service = await Service.findById(
                        serviceExportId
                    ).select('name urls.termsOfUse logo');
                    exportServices.push(service.name);
                    result.exportServices.push({
                        serviceId: service.id,
                        serviceName: service.name,
                        logo: `${process.env.URL_STATIC}/images/services/${service.logo}`,
                        description: service.description,
                        termsOfUse: service.urls.termsOfUse,
                    });
                }
                const datatype = await DataType.findById(
                    datatypes[i].datatype
                ).populate<{
                    provenance: Pick<
                        HydratedDocument<IService>,
                        'name' | '_id'
                    >;
                }>('provenance', 'name');

                datatypesList.push({
                    id: datatype.id,
                    name: datatype.name,
                    description: datatype.description,
                    provenance: datatype.provenance.name,
                    checked: false,
                    serviceExport: exportServices[exportServices.length - 1],
                });
            }
            result.datatypes = datatypesList;
            // No user associated to SI
            // Verify if the email in SI is found in an identifier of SE
            const emails = [];
            const urls = [];

            for (let i = 0; i < serviceIds.length; i++) {
                const existingExportIdentifier = await Identifier.findOne({
                    service: serviceIds[i],
                    email: req.body.emailImport,
                });

                if (existingExportIdentifier) {
                    // Check if existing export identifier has a reference to a user
                    if (existingExportIdentifier.user) {
                        // Update user
                        const user = await User.findById(
                            existingExportIdentifier.user
                        );
                        if (!user.identifiers.includes(userImportIdentifier.id))
                            user.identifiers.push(userImportIdentifier.id);
                        await user.save();
                    } else {
                        // Create user
                        const user = new User({
                            emails: [
                                userImportIdentifier.email,
                                existingExportIdentifier.email,
                            ],
                            identifiers: [
                                userImportIdentifier.id,
                                existingExportIdentifier.id,
                            ],
                        });
                        await user.save();
                    }

                    // Add email export to the result
                    emails.push({
                        service: exportServices[i],
                        email: existingExportIdentifier.email,
                    });
                } else {
                    const tempService = await Service.findById(
                        serviceIds[i]
                    ).select('urls name visions authMethod');

                    if (tempService.authMethod == 1) continue;

                    const fetchData = await axios.post(
                        tempService.urls.requestToken,
                        {
                            emailImport: req.body.emailImport,
                        }
                    );

                    const authenticationInfo = new AuthenticationInfo({
                        service: tempService.id,
                        requestToken: fetchData.data,
                    });

                    await authenticationInfo.save();

                    const clientId = tempService.serviceKey;
                    const secretKey = tempService.serviceSecretKey;
                    const hashCode = CreateHashCodeForOauth(
                        clientId,
                        fetchData.data,
                        secretKey
                    );
                    urls.push({
                        authorizeUrl:
                            tempService.urls.authURL +
                            '?requestToken=' +
                            fetchData.data +
                            '&clientId=' +
                            clientId +
                            '&hash=' +
                            hashCode,
                        service: tempService.name,
                    });
                }
            }

            result.emailsExport = emails;
            result.authUrls = urls;
        }
        if (req.body.isLegacy === true) {
            return res.status(200).json({ data: result, success: true });
        }
        return res.status(200).json(result);
    } catch (err) {
        Logger.error('popups.getImportPopup -- ' + err.message);
        return res
            .status(500)
            .json({ error: 'internal-server-error', details: err.message });
    }
};

/**
 * Generates data for the Export service exchange popup
 * @author Yanick Kifack
 * @author Felix Bole
 * @todo This method needs serious optimization work
 */
export const getExportPopup = async (req: Request, res: Response) => {
    try {
        const [purpose, dataUseExchange] = await Promise.all([
            Purpose.findById(req.body.purpose.trim()),
            await DataUseExchange.findOne({
                purpose: req.body.purpose.trim(),
            }),
        ]);
        if (!purpose)
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'purpose not found',
                message: 'Purpose not found',
            });

        if (!dataUseExchange) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'exchange configuration not found',
                message: 'No import exchange data found for this purpose.',
            });
        }

        const [serviceImport, serviceExport] = await Promise.all([
            Service.findById(dataUseExchange.serviceImport).select(
                'id name authMethod urls visions logo type'
            ),
            Service.findOne({
                serviceKey: req.serviceKey,
            }),
        ]);

        const exchangeAuthorized = await isExchangeAuthorized(
            serviceImport._id,
            serviceExport._id
        );
        if (!exchangeAuthorized) {
            return errorRes({
                code: 403,
                req,
                res,
                errorMsg: 'exchange-authorization-denied',
                message: 'Cannot exchange with ' + serviceImport.name,
            });
        }

        const userExportIdentifier = await Identifier.findOne({
            email: req.body.emailExport.trim(),
            service: serviceExport.id,
        });

        if (!userExportIdentifier) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'user identifier not found',
                message:
                    "The User's identifier for this email does not exist. Please make sure you have created a User for this email before trying to do a data exchange.",
            });
        }

        let user;
        const infoText = `Visions ne stocke pas et n'accède jamais aux données qui circulent. Nous garantissons que vos données sont uniquement utilisées par ${serviceImport.name} pour la finalité décrite et aucune autre.
        Vous pouvez révoquer votre consentement à tout moment depuis ${serviceImport.name}, ${serviceExport.name} ou depuis votre compte Visions. Nous vous envoyons un email récapitulatif. Les partenaires de notre réseau de données sont engagés juridiquement et contraints techniquement à respecter vos consentements. Nous vous avertirons au moindre écart ou à la moindre faille et nous assurerons que vos droits sont respectés.`;

        type PopupResult = {
            infoText: string;
            purpose: string;
            description: string;
            serviceImport: string;
            serviceImportLogo: string;
            serviceImportId: string;
            tosExport: string;
            tosImport: string;
            datatypes: {
                id: string;
                name: string;
                description: string;
                provenance: string;
                checked: boolean;
            }[];
            emailImport?: string;
            emailExport?: string;
            url?: string;
        };

        const result: PopupResult = {
            infoText,
            purpose: purpose.name,
            description: purpose.description,
            serviceImport: serviceImport.name,
            serviceImportLogo: `${process.env.URL_STATIC}/images/services/${serviceImport.logo}`,
            serviceImportId: serviceImport.id,
            tosExport: serviceExport.urls.termsOfUse,
            tosImport: serviceImport.urls.termsOfUse,
            datatypes: [],
        };

        let importIdentifier = await Identifier.findOne({
            service: serviceImport.id,
            email: req.body.emailExport.toString(),
        });

        if (!importIdentifier && userExportIdentifier.user) {
            user = await User.findById(userExportIdentifier.user).populate<{
                identifiers: HydratedDocument<IIdentifier>[];
            }>('identifiers');
            importIdentifier = user.identifiers.find(
                (item) =>
                    item.service.toString() === serviceImport.id.toString()
            );
        }

        const datatypesList = [];
        if (importIdentifier) {
            if (userExportIdentifier.user && importIdentifier.user) {
                const lastConsent = await ConsentExchange.findOne({
                    dataUseExchange: dataUseExchange.id,
                    user: importIdentifier.user,
                }).sort({ createdAt: -1 });

                result.emailImport = importIdentifier.email;

                if (lastConsent) {
                    // Get datatypes and status
                    for (let i = 0; i < dataUseExchange.data.length; i++) {
                        // If dataUseExchange datatypes are authorized
                        if (
                            dataUseExchange.data[i].authorized &&
                            serviceExport.id.toString() ===
                                dataUseExchange.data[i].serviceExport.toString()
                        ) {
                            // Find id of corresponding datatype in consentExchange
                            const datatype = await DataType.findById(
                                dataUseExchange.data[i].datatype
                            ).populate<{
                                provenance: Pick<
                                    HydratedDocument<IService>,
                                    'name' | '_id'
                                >;
                            }>('provenance', 'name');

                            const datatypeId = lastConsent.data.find(
                                (dt) =>
                                    dt.datatype.toString() ===
                                    dataUseExchange.data[i].datatype.toString()
                            );

                            // If the datatype exists in both DUE and CE, add with last known checked status
                            datatypesList.push({
                                id: datatype.id,
                                name: datatype.name || '',
                                description: datatype.description,
                                provenance: datatype.provenance.name,
                                checked:
                                    datatypeId != undefined
                                        ? datatypeId.authorized
                                        : false,
                            });
                        }
                    }
                }
            }

            if (datatypesList.length == 0) {
                result.emailImport = importIdentifier.email;

                for (let i = 0; i < dataUseExchange.data.length; i++) {
                    if (
                        dataUseExchange.data[i].authorized &&
                        serviceExport.id.toString() ===
                            dataUseExchange.data[i].serviceExport.toString()
                    ) {
                        // Find id of corresponding datatype in DUE
                        const datatype = await DataType.findById(
                            dataUseExchange.data[i].datatype
                        ).populate<{
                            provenance: Pick<
                                HydratedDocument<IService>,
                                'name' | '_id'
                            >;
                        }>('provenance', 'name');

                        datatypesList.push({
                            id: datatype.id,
                            name: datatype.name || '',
                            description: datatype.description,
                            provenance: datatype.provenance.name,
                            checked: false,
                        });
                    }
                }

                if (serviceImport.authMethod == 0) {
                    const fetchData = await axios.post(
                        serviceImport.urls.requestToken,
                        {
                            emailImport: importIdentifier.email,
                        }
                    );

                    const clientId = serviceImport.serviceKey;
                    const secretKey = serviceImport.serviceSecretKey;
                    const hashCode = CreateHashCodeForOauth(
                        clientId,
                        fetchData.data,
                        secretKey
                    );
                    const url = `${serviceImport.urls.authURL}?requestToken=${fetchData.data}&clientId=${clientId}&hash=${hashCode}`;

                    const authenticationInfo = new AuthenticationInfo({
                        service: serviceImport.id,
                        requestToken: fetchData.data,
                    });
                    await authenticationInfo.save();

                    result.url = url;
                }
            }
        } else {
            // IF type API create identifier (1 is API)
            if (serviceImport.type === 1) {
                const newImportIdentifier =
                    await createUserIdentifierForService(
                        serviceImport,
                        userExportIdentifier,
                        user as any
                    );

                if (!newImportIdentifier)
                    return res.status(500).json({
                        error: 'identifier-creation-error',
                        message:
                            'An error occured when trying to create the identifier for the import service.',
                    });

                result.emailImport = newImportIdentifier.email;
            } else {
                result.emailImport = '';
            }

            for (let i = 0; i < dataUseExchange.data.length; i++) {
                // Find id of corresponding datatype in DUE
                const datatype = await DataType.findById(
                    dataUseExchange.data[i].datatype
                ).populate<{
                    provenance: Pick<
                        HydratedDocument<IService>,
                        'name' | '_id'
                    >;
                }>('provenance', 'name');

                if (
                    dataUseExchange.data[i].authorized &&
                    serviceExport.id.toString() ===
                        dataUseExchange.data[i].serviceExport.toString()
                ) {
                    datatypesList.push({
                        id: datatype.id,
                        name: datatype.name || '',
                        description: datatype.description,
                        provenance: datatype.provenance.name,
                        checked: false,
                    });
                }
            }
        }

        result.datatypes = datatypesList;
        return res.status(200).json(result);
    } catch (err) {
        Logger.error('popups.getExportPopup -- ' + err.message);
        return res.status(500).json({
            error: 'internal-server-error',
            message:
                'Something unexpected went wrong. If you can, please contact us with the details of this response',
            details: err.message ? err.message : null,
        });
    }
};

/**
 * Creates an identifier for a service and attaches / creates a user accordingly
 * @param service The Import service model
 * @param exportIdentifier The user identifier in the export service
 * @param user The user for the export identifier, if it exists
 * @author Felix Bole
 */
export const createUserIdentifierForService = async (
    service: HydratedDocument<IService>,
    exportIdentifier: HydratedDocument<IIdentifier>,
    user?: HydratedDocument<IUser>
) => {
    try {
        if (!user) {
            // Create User
            const newUser = new User();

            // Create Identifier
            const identifier = new Identifier({
                service: service.id,
                email: exportIdentifier.email,
                userKey: makeId(100),
                userServiceId: null,
                emailVerified: false,
                user: newUser.id,
            });

            exportIdentifier.user = newUser.id;

            newUser.identifiers.push(exportIdentifier.id, identifier.id);
            newUser.emails.push(exportIdentifier.email);

            await Promise.all([
                exportIdentifier.save(),
                identifier.save(),
                newUser.save(),
            ]);

            return identifier;
        } else {
            const identifier = new Identifier({
                service: service.id,
                email: exportIdentifier.email,
                userKey: makeId(100),
                userServiceId: null,
                emailVerified: true,
                user: user.id,
            });

            user.identifiers.push(identifier._id);

            await identifier.save();
            await user.save();

            return identifier;
        }
    } catch (error) {
        Logger.error(
            'popups.createUserIdentifierForService -- ' + error.message
        );
        return null;
    }
};
