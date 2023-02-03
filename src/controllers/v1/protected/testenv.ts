import {
    ConsentExchange,
    DataType,
    DataTypeField,
    Identifier,
    Service,
    TestImportData,
} from '@visionsofficial/visions-public-models';
import { IDataTypeField } from '@visionsofficial/visions-public-models/lib/types/datatypefield';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { HydratedDocument, Types } from 'mongoose';
import { errorRes, successRes } from '../../../libs/api/VisionsAPIResponse';
import { Logger } from '../../../libs/loggers';
import {
    decryptSignedConsent,
    signConsent,
} from '../../../utils/consentExchangeHelper';
import { updateConsentStatus } from '../../../utils/consentStatus';
import { makeId } from '../../../utils/idGenerator';
import { impersonatePOST } from '../../../utils/impersonate';

/**
 * Find the internal service of the corresponding type
 * @returns Found service or null
 * @author Felix Bole
 */
const findInternalService = async (type: 'isDataProvider' | 'isDataUser') => {
    return await Service.findOne({
        $and: [
            {
                [`checks.${type}`]: true,
            },
            {
                [`checks.isVisionsInternalService`]: true,
            },
        ],
    });
};

/**
 * Find the internal user identifier corresponding to
 * the internal export or import service
 * @returns Found identifier or null
 * @author Felix Bole
 */
const findOrCreateInternalIdentifier = async (type: 'export' | 'import') => {
    try {
        const match: { [key: string]: 'isDataProvider' | 'isDataUser' } = {
            export: 'isDataProvider',
            import: 'isDataUser',
        };

        const service = await findInternalService(match[type]);
        if (!service) return null;

        const identifier = await Identifier.findOne({ service: service._id });
        if (!identifier) {
            Logger.debug('no identifier found');
            // Create
            const email = 'internaltestidentifier@visionspol.eu';
            await impersonatePOST(service._id, '/v1/users', {
                email,
                userServiceId: 'visions',
            });
            const newIdentifier = await Identifier.findOne({
                email,
                service: service._id,
            });
            return newIdentifier;
        }
        return identifier;
    } catch (err) {
        Logger.error({
            location: 'findOrCreateInternalIdentifier',
            message: err.message,
        });
        return null;
    }
};

/**
 * Finds datatypes of the DUE
 * @author Felix Bole
 */
const buildMockDatatypeSelection = async (
    serviceId: Types.ObjectId | string
) => {
    const datatypes = await DataType.find({ provenance: serviceId });
    const response = [];
    for (const d of datatypes) {
        response.push({
            datatype: d.id,
            authorized: true,
        });
    }
    return response;
};

export const startExport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const [userExportIdentifier, serviceExport] = await Promise.all([
            Identifier.findOne({
                email: req.body.email,
                service: req.user._id,
            }),
            Service.findById(req.user._id),
        ]);

        if (!userExportIdentifier)
            return res.status(404).json({
                message: 'User not registered',
            });

        const { datatypes } = req.body;
        const consentDatatypes = datatypes.map(
            (d: { id: string; authorized: boolean }) => {
                return { datatype: d.id, authorized: true };
            }
        );

        const consentExchange = new ConsentExchange({
            data: consentDatatypes,
            verified: 0,
            flow: 2,
            isTest: true,
        });

        updateConsentStatus(consentExchange, 2000);
        await consentExchange.save();

        consentExchange.userExportId = userExportIdentifier.id;
        consentExchange.userImportId = new Types.ObjectId();
        consentExchange.dataUseExchange = new Types.ObjectId();

        updateConsentStatus(consentExchange, 2100);
        await consentExchange.save();

        consentExchange.verified = 1;
        consentExchange.consented = true;

        const content = {
            purposeName: 'testingPurpose',
            serviceImportName: 'testingService',
            serviceExportName: serviceExport.name,
            userImportId: 'testingUserImportId',
            userExportId: userExportIdentifier.userServiceId,
            emailImport: 'testingUserImportEmail',
            emailExport: userExportIdentifier.email,
            consentId: consentExchange._id.toString(),
        };

        try {
            await axios({
                method: 'POST',
                url: serviceExport.urls.consentExport,
                data: {
                    signedConsent: signConsent(content, true),
                },
                headers: { 'Content-Type': 'application/json' },
            });
            return res.status(200).json({
                payload: {
                    signedConsent: signConsent(content, true),
                },
                consentId: consentExchange._id.toString(),
            });
        } catch (error) {
            Logger.error(
                `{consents.exchange}.startExportExchange.axios.fail -- url: ${serviceExport.urls.consentExport} - message: ${error.message}`
            );
            return res.status(424).json({
                error: 'EREQUESTFAILED',
                message:
                    'An error occured after calling the consent export endpoint of ' +
                    serviceExport.name,
                details: {
                    errorMessage: error.message,
                    urlRequested: serviceExport.urls.consentExport,
                    fullError: error,
                },
            });
        }
    } catch (err) {
        Logger.error({ message: err.message, location: 'testenv.startExport' });
        next(err);
    }
};

/**
 * Test environment for attach token in consent exchange protocol
 * @author Felix Bole
 */
export const testAttachToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (req.body.token && req.body.token.length > 50) {
            return errorRes({
                code: 400,
                errorMsg: 'ETOKENSIZE',
                message:
                    'Your token is too large, plase use a token of at most 50 characters.',
                req,
                res,
            });
        }
        const ce = await ConsentExchange.findById(req.body.consentId);
        const token = req.body.token;
        ce.token = token;

        await ce.save();

        const userExportIdentifier = await Identifier.findById(
            ce.userExportId
        ).lean();
        const serviceExport = await Service.findById(
            userExportIdentifier.service
        ).lean();

        const content = {
            purposeName: 'testingPurpose',
            serviceImportName: 'testingService',
            serviceExportName: serviceExport.name,
            userImportId: 'testingUserImportId',
            userExportId: userExportIdentifier.userServiceId,
            emailImport: 'testingUserImportEmail',
            emailExport: userExportIdentifier.email,
            consentId: ce._id.toString(),
            token,
        };

        const payload = {
            signedConsent: signConsent(content, true),
            dataImportUrl: process.env.API_URL + '/testenv/data/import',
        };

        updateConsentStatus(ce, 3000, 'testingService');
        await ce.save();

        successRes({
            req,
            res,
            code: 200,
            message: `Simulated data request to your endpoint ${serviceExport.urls.dataExport}`,
            data: {},
        });

        try {
            await axios({
                method: 'POST',
                url: serviceExport.urls.dataExport,
                data: payload,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (err) {
            Logger.error(
                `testenv.attachToken -- url ${serviceExport.urls.dataExport} failed -> ${err.message}`
            );
        }
    } catch (err) {
        next(err);
    }
};

/**
 * Test environment for validation, last step of consent protocol
 * @author Felix Bole
 */
export const testValidate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const ce = await ConsentExchange.findById(req.body.consentId);
        const datatypes = [];
        for (const dt of ce.data) {
            if (!dt.authorized) continue;
            const datatype = await DataType.findById(dt.datatype);
            if (!datatype) continue;

            const datatypeField = await DataTypeField.findOne({
                datatype: datatype.id,
            }).populate<{ fields: HydratedDocument<IDataTypeField>[] }>(
                'fields',
                'name'
            );

            let obj: { [key: string]: string | string[] } = {
                name: datatype.name,
            };

            if (datatypeField) {
                obj = {
                    ...obj,
                    table: datatypeField.name,
                    fields: datatypeField.fields.map((item) => item.name),
                };
                datatypes.push(obj);
            } else {
                obj = {
                    ...obj,
                    table: null,
                    fields: null,
                };
                datatypes.push(obj);
            }
        }

        const [userExport, interopService] = await Promise.all([
            Identifier.findById(ce.userExportId),
            ce.interoperability.active && ce.interoperability.interopService
                ? Service.findById(ce.interoperability.interopService)
                : null,
        ]);
        const userExportObject = {
            email: userExport.email,
            userServiceId: userExport.userServiceId,
        };
        const userImportObject = {
            email: 'testingEmail',
            userServiceId: 'testingUserImportId',
        };

        updateConsentStatus(ce, 4000, 'service export');
        await ce.save();

        const url = interopService
            ? interopService.urls.dataImport
            : process.env.API_URL + '/testenv/data/import';

        return successRes({
            code: 200,
            req,
            res,
            data: {
                userExport: userExportObject,
                userImport: userImportObject,
                dataImportEndpoint: url,
                datatypes: datatypes,
                verified: true,
                isInteropProtocol: ce.interoperability.active,
            },
        });
    } catch (err) {
        next(err);
    }
};

export const dataImport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get service by decrypting consent
        const decryptedData = decryptSignedConsent(req.body.signedConsent);
        const { isInteropProtocol, data } = req.body;
        const { consentId } = decryptedData;

        const ce = await ConsentExchange.findById(consentId)
            .populate<{
                interoperability: {
                    active: boolean;
                    interopService: HydratedDocument<IService>;
                };
            }>('interoperability.interopService')
            .populate<{ userExportId: HydratedDocument<IIdentifier> }>(
                'userExportId'
            );

        const receivedData = new TestImportData({
            testService: ce.userExportId.service,
            data: data || {
                error: 'The internal import service received no data or an empty data object. You probably received a 400 response from VisionsTrust when trying to export your data at the end of the protocol.',
            },
            isInteropProtocol,
            consentExchange: consentId,
            flow: 1,
        });

        if (ce.interoperability.active) {
            if (ce.interoperability.interopService) {
                receivedData.testService =
                    ce.interoperability.interopService._id;
            }
        }

        receivedData.markModified('data');
        await receivedData.save();

        Logger.info({
            message: `${JSON.stringify(req.body)}`,
            location: 'testenv.dataImport',
        });
        if (!data || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'empty request body' });
        }
        return res
            .status(200)
            .json({ message: 'Data received', body: req.body });
    } catch (err) {
        next(err);
    }
};

// INTEROP

/**
 * Starts an interop consent exchange protocol
 * @author Felix Bole
 */
export const startInteropExport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const [serviceExport, userExportIdentifier] = await Promise.all([
            findInternalService('isDataProvider'),
            findOrCreateInternalIdentifier('export'),
        ]);

        if (!userExportIdentifier)
            return res.status(404).json({
                message: 'User not registered',
            });

        const consentDatatypes = await buildMockDatatypeSelection(
            serviceExport._id
        );

        const consentExchange = new ConsentExchange({
            data: consentDatatypes,
            verified: 0,
            flow: 2,
            isTest: true,
            interoperability: {
                active: true,
                interopService: req.user._id,
            },
        });

        updateConsentStatus(consentExchange, 2000);
        await consentExchange.save();

        consentExchange.userExportId = userExportIdentifier.id;
        consentExchange.userImportId = new Types.ObjectId();
        consentExchange.dataUseExchange = new Types.ObjectId();

        updateConsentStatus(consentExchange, 2100);
        await consentExchange.save();

        consentExchange.verified = 1;
        consentExchange.consented = true;

        const content = {
            purposeName: 'testingPurpose',
            serviceImportName: 'testingService',
            serviceExportName: serviceExport.name,
            userImportId: 'testingUserImportId',
            userExportId: userExportIdentifier.userServiceId,
            emailImport: 'testingUserImportEmail',
            emailExport: userExportIdentifier.email,
            consentId: consentExchange._id.toString(),
        };

        const encryptedData = signConsent(content);

        try {
            await axios({
                method: 'POST',
                url: `${process.env.API_URL}/testenv/interop/consent/export`,
                data: {
                    signedConsent: encryptedData.toString('base64'),
                },
                headers: { 'Content-Type': 'application/json' },
            });
            return res.status(200).json({
                payload: {
                    signedConsent: encryptedData.toString('base64'),
                },
                consentId: consentExchange._id.toString(),
            });
        } catch (error) {
            Logger.error(
                `{consents.exchange}.startExportExchange.axios.fail -- url: ${`${process.env.API_URL}/testenv/interop/consent/export`} - message: ${
                    error.message
                }`
            );
            return res.status(424).json({
                error: 'EREQUESTFAILED',
                message:
                    'An error occured after calling the consent export endpoint of ' +
                    serviceExport.name,
                details: {
                    errorMessage: error.message,
                    urlRequested: `${process.env.API_URL}/testenv/interop/consent/export`,
                },
            });
        }
    } catch (err) {
        Logger.error({
            message: 'Failed to start interop export',
            location: 'testenv.startInteropExport',
        });
        next(err);
    }
};

export const internalConsentExport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const query = (type: 'isDataProvider' | 'isDataUser') => {
            return {
                $and: [
                    { [`checks.${type}`]: true },
                    { [`checks.isVisionsInternalService`]: true },
                ],
            };
        };

        const [serviceExport, serviceImport] = await Promise.all([
            Service.findOne(query('isDataProvider')),
            Service.findOne(query('isDataUser')),
        ]);

        if (!serviceExport || !serviceImport)
            return res
                .status(404)
                .json({ error: 'Missing an internal service' });

        const decryptedData = decryptSignedConsent(req.body.signedConsent);

        if (!decryptedData) {
            Logger.error(
                'testenv.internalConsentExport -- Cannot get decryptedData'
            );
            return res
                .status(400)
                .json({ error: 'Cannot read decrypted data' });
        }

        const originalConsent = decryptedData;

        // Generate token
        const token = makeId(30);

        const consentId = originalConsent.consentId;

        await axios({
            method: 'POST',
            url: process.env.API_URL + '/testenv/interop/token',
            data: {
                consentId,
                token,
            },
        });

        return res.status(200).json({ message: 'Sent to token verification' });
    } catch (err) {
        Logger.error({
            message: 'Failed internal consent export - ' + err.message,
            location: 'testenv.internalConsentExport',
        });
        next(err);
    }
};

export const internalAttachToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { consentId, token } = req.body;
        const ce = await ConsentExchange.findById(consentId);
        if (!ce) return res.status(404).json({ error: 'Consent not found' });
        ce.token = token;

        const userExportIdentifier = await Identifier.findById(
            ce.userExportId
        ).lean();
        const [serviceExport, serviceImport] = await Promise.all([
            Service.findById(userExportIdentifier.service).lean(),
            findInternalService('isDataUser'),
        ]);

        const content = {
            purposeName: 'testingPurpose',
            serviceImportName: serviceImport.name,
            serviceExportName: serviceExport.name,
            userImportId: 'testingUserImportId',
            userExportId: userExportIdentifier.userServiceId,
            emailImport: 'testingUserImportEmail',
            emailExport: userExportIdentifier.email,
            consentId: ce._id.toString(),
            token,
        };

        const encryptedData = signConsent(content);

        const payload = {
            signedConsent: encryptedData.toString('base64'),
            dataImportUrl: process.env.API_URL + '/testenv/data/import',
            isInteropProtocol: false,
            requestUrl: '',
        };

        // Retrieve dataExport url endpoint to be called by SI or Interop service
        // const urlObject = consentExchangeHelper.getEndpoint(userExportIdentifier, null, serviceExport, 'dataExport');
        // HARDCODE for testenv
        const urlObject = {
            url: `${process.env.API_URL}/testenv/interop/data/export`,
        };

        // if (urlObject.url === null) {
        //     Logger.error('testenv.internalAttachToken -- ' + urlObject.error);
        //     return res.status(404).json({ message: urlObject.error });
        // }

        if (ce.interoperability.active) {
            if (!ce.interoperability.interopService)
                throw new Error('No interop service on ConsentExchange');

            const interopService = await Service.findById(
                ce.interoperability.interopService
            );

            if (!interopService)
                throw new Error(
                    'Interop service on consentExchange returned null'
                );

            payload.dataImportUrl = interopService.urls.dataImport;
            payload.requestUrl = interopService.urls.consentImport;
            payload.isInteropProtocol = true;
        }

        const url = payload.isInteropProtocol
            ? payload.requestUrl
            : serviceImport.urls.consentImport;

        try {
            await axios({
                method: 'POST',
                url,
                data: {
                    ...payload,
                    requestUrl: undefined,
                    serviceExportUrl: urlObject.url,
                },
            });
        } catch (error) {
            Logger.error(
                `testenv.internalAttachToken.axios.fail -- url: ${url} - error: ${error.message}`
            );
            return res.status(424).json({
                error: 'EREQUESTFAILED',
                message:
                    'An error occured after calling the consent import endpoint of ' +
                    serviceImport.name,
                details: {
                    errorMessage: error.message,
                    urlRequested: url,
                },
            });
        }

        const updateCode = ce.interoperability.active ? 3050 : 3000;
        const updateServiceName = ce.interoperability.active
            ? ''
            : serviceImport.name;
        updateConsentStatus(ce, updateCode, updateServiceName);
        await ce.save();

        return res.status(200).json({
            success: true,
            message: 'Signed consent sent to import service',
            consentId: ce.id,
        });
    } catch (err) {
        Logger.error('testenv.internalAttachToken -- ' + err.message);
        next(err);
    }
};

export const internalDataExport = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.body.signedConsent) {
            return res.status(400).json({
                error: 'Missing signedConsent from the request body',
                request: req.body,
            });
        }

        const { signedConsent } = req.body;

        // IMPERSONATE THE SERVICE EXPORT RECEIVING REQUEST TO EXPORT DATA
        const whoAmI = await findInternalService('isDataProvider');
        const decryptedData = decryptSignedConsent(signedConsent);

        if (!decryptedData) {
            Logger.error(
                'testenv.internalDataExport -- Cannot read signed consent'
            );
            return res
                .status(400)
                .json({ error: 'Cannot read decrypted data' });
        }

        const { consentId, token } = decryptedData;
        let verification;

        try {
            verification = await impersonatePOST(
                whoAmI._id,
                `/v1/testenv/validate`,
                {
                    signedConsent: signedConsent,
                    consentId,
                    token,
                }
            );
        } catch (err) {
            Logger.error(
                'testenv.internalDataExport -- Consent Verification Failed'
            );
            return res
                .status(500)
                .json({ error: 'consent verification failed' });
        }

        const { data } = verification;
        if (!data) throw new Error('No data from VT validation');

        const { dataImportEndpoint, isInteropProtocol, userImport } = data;

        // SEND TO IMPORT OR INTEROP SERVICE
        // The dataImportUrl received was set by the verification
        // of the interoperability protocol
        try {
            await axios({
                url: dataImportEndpoint,
                data: {
                    data: MOCK_EXPORT_DATA(),
                    dataImportUrl: dataImportEndpoint,
                    signedConsent: signedConsent,
                    user: userImport,
                    isInteropProtocol,
                },
                method: 'POST',
            });
        } catch (err) {
            Logger.error({
                message: err.message,
                location: 'testenv.internalDataExport.axios.fail',
            });
            if (err.isAxiosError) {
                if (err.message === 'Request failed with status code 400') {
                    return res.status(424).json({
                        error:
                            'Received 400 error from endpoint ' +
                            dataImportEndpoint,
                    });
                }
            }
            return res.status(400).json({
                error: 'an error occured when requesting the data import endpoint.',
                endpoint: dataImportEndpoint,
            });
        }

        return res.status(200).json({
            message: `Data sent to ${
                isInteropProtocol ? 'Interop' : 'Import'
            } Service`,
        });
    } catch (err) {
        Logger.error({
            message: err.message,
            location: 'testenv.internalDataExport',
        });
        next(err);
    }
};

export const getReceivedData = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const data = await TestImportData.findOne({
            testService: req.params.serviceId,
        }).sort({ updatedAt: -1 });
        if (!data) return res.status(404).json({ error: 'Data not found' });
        return res.status(200).json({ data });
    } catch (err) {
        Logger.error({
            message: err.message,
            location: 'testenv.getReceivedData',
        });
        next(err);
    }
};

export const internalDataImport = async (req: Request, res: Response) => {
    return res.status(200).json({ message: 'Ok' });
};

export const findReceivedDataWithSignedConsent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const signedConsent = decodeURIComponent(
            req.query.signedConsent.toString()
        );
        const serviceId = req.user._id;
        const { consentId } = decryptSignedConsent(signedConsent);

        const [consentExchange, data] = await Promise.all([
            ConsentExchange.findById(consentId),
            TestImportData.findOne({
                testService: serviceId,
                consentExchange: consentId,
            }),
        ]);

        if (!data)
            return res.status(404).json({
                error: 'No data found, make sure the protocol is fully complete',
                consentExchange,
            });

        return res.status(200).json(data);
    } catch (err) {
        Logger.error({
            message: err.message,
            location: 'testenv.findReceivedDataWithSignedConsent',
        });
        next(err);
    }
};

const MOCK_EXPORT_DATA = () => {
    const data = {
        badges: {
            ADAPTABLE: 10,
            CONCENTRE: 23,
            DYNAMIQUE: 9,
            OPTIMISTE: 13,
            RAPIDE: 17,
            RESPECTUEUX: 13,
            STUDIEUX: 15,
        },
        jobCards: [
            {
                id: 1,
                name: "Agent d'escale commercial",
                slug: "AgentD'escalecommercial",
                positionnement: 'ça me correspond',
                type: "Secteur d'activité",
                description: '...',
                isTension: true,
            },
            {
                id: 2,
                name: 'Agent d’accueil aéroportuaire',
                slug: "Agentd'accueilaéroportuaire",
                positionnement: 'ça me correspond',
                type: 'Métier',
                description: '...',
                isTension: true,
            },
            {
                id: 3,
                name: 'Réceptionniste',
                slug: 'réceptionniste',
                positionnement: 'ça me correspond',
                type: 'Métier',
                description: '...',
                isTension: true,
            },
            {
                id: 4,
                name: 'UX designer',
                slug: 'uxdesigner',
                positionnement: 'Je ne sais pas',
                type: 'Métier',
                description: '...',
            },
            {
                id: 5,
                name: 'Travailler en startup',
                slug: 'travaillerenstartup',
                positionnement: 'ça me correspond',
                type: 'Contexte professionnel',
                description: '...',
            },
            {
                id: 6,
                name: 'Gestionnaire paie',
                slug: 'gestionnairepaie',
                positionnement: 'ça ne me correspond pas',
                type: 'Métier',
                description: '...',
            },
        ],
    };

    return data;
};
