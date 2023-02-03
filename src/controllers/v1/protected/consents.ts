import crypto from 'crypto';
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { HydratedDocument } from 'mongoose';
import { IDataTypeField } from '@visionsofficial/visions-public-models/lib/types/datatypefield';
import { IDataUseExchange } from '@visionsofficial/visions-public-models/lib/types/datauseexchange';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IUser } from '@visionsofficial/visions-public-models/lib/types/user';

import {
    Service,
    Purpose,
    DataType,
    DataTypeField,
    DataUseExchange,
    Identifier,
    ConsentExchange,
    AuthenticationInfo,
    User,
    ConfirmationAccount,
} from '@visionsofficial/visions-public-models';

import { EmailHandler } from '../../../libs/emails/EmailHandler';
import { makeId } from '../../../utils/idGenerator';
import { updateConsentStatus } from '../../../utils/consentStatus';
import {
    getEndpoint,
    decryptSignedConsent,
} from '../../../utils/consentExchangeHelper';
import { errorRes, successRes } from '../../../libs/api/VisionsAPIResponse';
import { keys } from '../../../config';
import { Logger } from '../../../libs/loggers';
import { updateUrlParameter } from '../../../utils/utils';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { VisionsError } from '../../../libs/errors/VisionsError';
import { IConsentExchange } from '@visionsofficial/visions-public-models/lib/types/consentexchange';

/**
 * Starts the import exchange process - Creates the consent exchange
 * @author Felix Bole, Yanick Kifack
 * @todo Legacy code, needs checking an updating
 */
export const startImportExchange = async (req: Request, res: Response) => {
    let serviceImport, user;

    const errors = [];

    if (!req.body.serviceExport)
        errors.push({
            parameter: 'serviceExport',
            message: 'Service export name is missing',
        });

    const emailImport = req.body.emailImport;
    if (!emailImport)
        errors.push({
            parameter: 'emailImport',
            message: "Missing user's email in your service",
        });

    const emailExport = req.body.emailExport;
    if (!emailExport)
        errors.push({
            parameter: 'emailExport',
            message: "Missing user's email in export service",
        });

    if (!req.body.userKey)
        errors.push({
            parameter: 'userkey',
            message: 'Missing key of your user',
        });

    if (!req.body.datatypes)
        errors.push({
            datatypes: 'datatypes',
            message: 'Missing data selected by the user',
        });

    if (errors.length > 0)
        return res.status(400).json({
            error: 'Missing request body parameters',
            details: errors,
        });

    serviceImport = await Service.findById(req.service).populate<{
        purposes: HydratedDocument<IPurpose>[];
    }>('purposes', ['name', 'id']);

    if (!serviceImport) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'resource not found',
            message: 'Service not found',
        });
    }

    const serviceExport = await Service.findOne({
        name: req.body.serviceExport,
    });
    if (!serviceExport) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'resource not found',
            message: `Service ${req.body.serviceExport} not found`,
        });
    }

    const purpose = await Purpose.findById(req.body.purpose.trim());
    if (!purpose) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'resource not found',
            message: `Purpose not found. Please check the provided purpose`,
        });
    }

    const dataUseExchange = await DataUseExchange.findOne({
        purpose: purpose.id,
        serviceImport: serviceImport.id,
        'data.serviceExport': serviceExport.id,
    });
    if (!dataUseExchange) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'resource not found',
            message: `Data exchange configuration not found between your service and ${serviceExport.name}`,
        });
    }

    // Find datatypes
    const datatypes = [];
    const datatypesArray = dataUseExchange.data;
    const selectedDatatypes: {
        id?: string;
        datatype?: string;
        checked?: boolean | string;
    }[] = req.body.datatypes;

    for (let i = 0; i < datatypesArray.length; i++) {
        const datatype = await DataType.findById(
            datatypesArray[i].datatype
        ).select('name id');

        const selectedDatatype = selectedDatatypes.find(
            (item) => item.id === datatype.id.toString()
        );

        if (selectedDatatype !== undefined) {
            datatypes.push({
                datatype: datatype.id,
                authorized:
                    typeof selectedDatatype.checked === 'boolean'
                        ? selectedDatatype.checked
                        : JSON.parse(selectedDatatype.checked),
            });
        }
    }

    if (datatypes.length === 0) {
        return errorRes({
            code: 400,
            req,
            res,
            errorMsg: 'ENODATATYPES',
            message: `No datatypes or wrong format was used in the request body. Please check that the id's of the datatypes match the ones you received when generating the exchange popup.`,
        });
    }

    // Create new consent exchange (verified: false)
    const consentExchange = new ConsentExchange({
        data: datatypes,
        verified: 0,
        flow: 1,
    });

    updateConsentStatus(consentExchange, 1000);
    await consentExchange.save();

    const userKey = req.body.userKey;
    // Verify provenance of request using userKey (assume body)
    const userImportIdentifier = await Identifier.findOne({ userKey: userKey });

    if (!userImportIdentifier) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'resource not found',
            message:
                'Please make sure you have created a Visions user identifier for the user before launching the data exchange.',
        });
    }

    // Find export identifier
    const userExportIdentifier = await Identifier.findOne({
        email: emailExport,
        service: serviceExport.id,
    });

    if (!userExportIdentifier) {
        return errorRes({
            code: 404,
            req,
            res,
            errorMsg: 'resource not found',
            message: `User identifier in the export service not found. ${serviceExport.name} does not seem to have registered the identifier for this user on their service or the user does not have an account in that service.`,
        });
    }

    consentExchange.userExportId = userExportIdentifier.id;
    consentExchange.userImportId = userImportIdentifier.id;
    consentExchange.dataUseExchange = dataUseExchange.id;

    updateConsentStatus(consentExchange, 1100);
    await consentExchange.save();

    const authInfo = await AuthenticationInfo.findOne({
        service: serviceExport.id,
        email: userExportIdentifier.email,
    });

    const hasAccountsWithSameEmail =
        userImportIdentifier.email == userExportIdentifier.email;

    if (
        serviceExport.authMethod == 1 &&
        !hasAccountsWithSameEmail &&
        !userExportIdentifier.emailVerified
    ) {
        const token = makeId(40);
        const daysUntilExpire = 2;
        const secondsUntilExpire = daysUntilExpire * 24 * 60 * 60;
        const expiresAt = Date.now() / 1000 + secondsUntilExpire;

        // Save token in consentExchange
        consentExchange.emailToken.token = token;
        consentExchange.emailToken.expires = expiresAt;

        updateConsentStatus(consentExchange, 1150, emailExport);
        await consentExchange.save();

        EmailHandler.sendEmailVerification(
            emailExport,
            serviceImport.id,
            serviceExport.id,
            serviceExport.name,
            serviceImport.name,
            purpose.id,
            token
        );

        return successRes({
            code: 202,
            req,
            res,
            message: `Consent paused and waiting on email validation sent to: ${emailExport}`,
            data: {
                verifyEmail: true,
                consentId: consentExchange.id,
            },
        });
    } else if (!authInfo && serviceExport.authMethod == 0) {
        // TODO Remove this legacy unused cde
        return res.status(403).json({
            error: 'user-authenticated-export-error',
            message: 'User not authenticated in service Export',
        });
    }

    consentExchange.verified = 1;
    consentExchange.consented = true;

    updateConsentStatus(consentExchange, 1200);
    await consentExchange.save();

    // Verify both identifiers are in CE
    if (userImportIdentifier && userExportIdentifier) {
        if (!userImportIdentifier.user && !userExportIdentifier.user) {
            // Look for identifier matching with email export or email import
            const emailMatchingIdentifiers = await Identifier.find({
                $or: [{ email: emailExport }, { email: emailImport }],
            });

            // Find one that has a user
            const identifierHasUser = emailMatchingIdentifiers.find(
                (id) => id.user != null
            );

            if (identifierHasUser != undefined) {
                // Update user
                user = await User.findById(identifierHasUser.user);

                user.identifiers.push(
                    userImportIdentifier.id,
                    userExportIdentifier.id
                );
                // TODO stop using emails in user model
                user.emails.push(emailImport, emailExport);

                await user.save();
            } else {
                user = new User({
                    identifiers: [
                        userImportIdentifier.id,
                        userExportIdentifier.id,
                    ],
                    emails: [emailImport, emailExport],
                });
                await user.save();
            }

            userImportIdentifier.user = user.id;
            userExportIdentifier.user = user.id;

            await Promise.all([
                userImportIdentifier.save(),
                userExportIdentifier.save(),
            ]);
        } else if (!userImportIdentifier.user || !userExportIdentifier.user) {
            // Set the id and email as the one that is missing
            const id = !userImportIdentifier.user
                ? userExportIdentifier.user
                : userImportIdentifier.user;
            const email = !userImportIdentifier.user
                ? userImportIdentifier.email
                : userExportIdentifier.email;
            const userIdentifierId = !userImportIdentifier.user
                ? userImportIdentifier.id
                : userExportIdentifier.id;

            userImportIdentifier.user = id;
            userExportIdentifier.user = id;

            user = await User.findById(id);

            user.emails.push(email);
            user.identifiers.push(userIdentifierId);

            await Promise.all([
                userImportIdentifier.save(),
                userExportIdentifier.save(),
                user.save(),
            ]);
        } else {
            user = await User.findById(userImportIdentifier.user);
        }

        const urlObject = getEndpoint(
            userExportIdentifier,
            serviceImport.id,
            serviceExport,
            'consentExport'
        );

        if (urlObject.url === null) {
            Logger.error(urlObject.error);
            return errorRes({
                code: 404,
                req,
                res,
                message: urlObject.error,
                errorMsg: 'Failed to find the correct consentExport endpoint',
            });
        }

        const url = urlObject.url;
        const consentId = consentExchange._id.toString();
        const content = {
            serviceImportName: serviceImport.name,
            serviceExportName: serviceExport.name,
            serviceExport: serviceExport.name, // Kept for legacy
            userImportId: userImportIdentifier.userServiceId,
            userExportId: userExportIdentifier.userServiceId,
            emailImport: userImportIdentifier.email,
            emailExport: userExportIdentifier.email,
            consentId,
        };

        const privateKey = crypto.createPrivateKey(keys.privateRSAEncrypt);
        const encryptedData = crypto.privateEncrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(JSON.stringify(content))
        );

        try {
            axios({
                method: 'POST',
                url: url,
                data: {
                    signedConsent: encryptedData.toString('base64'),
                },
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            Logger.error(
                'consents.exchange.startImportExchange.axios.fail -- ' +
                    error.message
            );
            return res.status(500).json({
                error: 'request-error',
                message:
                    'Something went wrong when making the request to the consent export endpoit of ' +
                    serviceExport.name,
            });
        }

        updateConsentStatus(consentExchange, 1300, serviceExport.name);
        await consentExchange.save();

        return successRes({
            code: 200,
            req,
            res,
            message: `Consent signed and sent to ${serviceExport.name}`,
            data: {
                consentId: consentExchange.id,
                signedConsent: encryptedData.toString('base64'),
                followInfo: `To follow the status of the consent, please use the following link ${process.env.URL}/consents/status/${consentExchange.id}`,
            },
        });
    } else if (!userImportIdentifier) {
        // TODO legacy code, verify relevance (OAuth testing early 2020)
        serviceImport = await Service.findById(dataUseExchange.serviceImport);

        let url = serviceImport.urls.authURL;

        consentExchange.userExportId = userExportIdentifier.id;
        consentExchange.dataUseExchange = dataUseExchange.id;
        consentExchange.consented = true;

        updateConsentStatus(consentExchange, 6666);
        await consentExchange.save();

        url = updateUrlParameter(
            url,
            'consentID',
            consentExchange.id.ToString()
        );

        res.redirect(url);
    } else {
        return errorRes({
            code: 500,
            req,
            res,
            errorMsg: 'unknown-error',
            message: 'internal server error',
        });
    }
};

/**
 * Starts the export exchange process - Creates the consent exchange
 * @author Felix Bole, Yanick Kifack
 */
export const startExportExchange = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let emailExport, emailImport, user;

        // Parameters verification
        const errors = [];
        emailImport = req.body.emailImport;
        if (!emailImport && !req.body.isNewAccount)
            errors.push({
                parameter: 'emailImport',
                message: "Missing user's email in your service",
            });
        emailExport = req.body.emailExport;
        if (!emailExport)
            errors.push({
                parameter: 'emailExport',
                message: "Missing user's email in export service",
            });
        if (!req.body.userKey)
            errors.push({
                parameter: 'userKey',
                message: 'Missing key of your user',
            });
        if (!req.body.datatypes)
            errors.push({
                parameter: 'datatypes',
                message: 'Missing data selected by the user',
            });
        if (!req.body.purpose)
            errors.push({
                parameter: 'purpose',
                message: 'Missing purpose id of the exchange',
            });
        if (errors.length > 0)
            return res.status(400).json({
                error: 'Missing request body parameters',
                details: errors,
            });

        const serviceExport = await Service.findById(req.service);
        if (!serviceExport) {
            throw new VisionsError(
                'Unexpected reach of callback after api authentication middleware. ServiceExport undefined.',
                'startExportExchange',
                500
            );
        }

        const purpose = await Purpose.findById(req.body.purpose.trim());
        if (!purpose) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: `Purpose not found. Please check the provided purpose`,
            });
        }

        const serviceImport = await Service.findById(purpose.service).populate<{
            purposes: HydratedDocument<IPurpose>[];
        }>({ path: 'purposes', select: 'name id' });
        if (!serviceImport) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: 'Service not found',
            });
        }

        const dataUseExchange = await DataUseExchange.findOne({
            purpose: purpose.id,
            serviceImport: serviceImport.id,
            'data.serviceExport': serviceExport.id,
        });
        if (!dataUseExchange) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: `Data exchange configuration not found between your service and ${serviceExport.name}`,
            });
        }

        const userExportIdentifier = await Identifier.findOne({
            userKey: req.body.userKey,
        });
        if (!userExportIdentifier) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: `The user identifier in ${serviceExport.name} was not found for email ${emailExport}. Please verify you have registered this user in VisionsTrust.`,
            });
        }

        const datatypes = [];
        const datatypesArray = dataUseExchange.data;
        const selectedDatatypes: {
            id?: string;
            datatype?: string;
            checked?: boolean | string;
        }[] = req.body.datatypes;

        for (let i = 0; i < datatypesArray.length; i++) {
            const datatype = await DataType.findById(
                datatypesArray[i].datatype
            ).select('name id');

            if (!datatype) continue;

            const selectedDatatype = selectedDatatypes.find(
                (item) =>
                    item.id === datatype.id.toString() &&
                    item.datatype === datatype.name
            );

            if (selectedDatatype != undefined) {
                datatypes.push({
                    datatype: datatype.id,
                    authorized:
                        typeof selectedDatatype.checked === 'boolean'
                            ? selectedDatatype.checked
                            : JSON.parse(selectedDatatype.checked),
                });
            }
        }

        // Coming from authenticated in export service so verified by default
        userExportIdentifier.emailVerified = true;

        // Create new consent exchange (verified: false)
        const consentExchange = new ConsentExchange({
            data: datatypes,
            verified: 0,
            flow: 2,
        });

        updateConsentStatus(consentExchange, 2000);
        await consentExchange.save();

        // Verify if it's a new account being created
        if (
            userExportIdentifier &&
            req.body.isNewAccount != undefined &&
            req.body.isNewAccount.toString() === 'true'
        ) {
            const importRegisterUrl = serviceImport.urls.registerURL;

            if (!importRegisterUrl || importRegisterUrl === '') {
                // TODO We should add some safeguard to not allow exchanges with platform that aren't ready
                return errorRes({
                    code: 404,
                    req,
                    res,
                    errorMsg: 'resource not found',
                    message:
                        'The import service has not informed any registration url. We cannot process this exchange any further without it. If you can, please contact the service to inform them they have not configured all of their endpoints.',
                });
            }

            consentExchange.userExportId = userExportIdentifier.id;
            consentExchange.dataUseExchange = dataUseExchange.id;

            updateConsentStatus(consentExchange, 2050, serviceImport.name);
            await consentExchange.save();

            const redirectionUrl = serviceImport.urls?.website;

            return res.status(202).json({
                message:
                    'Consent created and waiting on new account to be created in ' +
                    serviceImport.name,
                redirectionUrl,
                consentId: consentExchange.id,
            });
        }

        emailExport = req.body.emailExport.trim();
        emailImport = req.body.emailImport.trim();

        // Verify provenance of request using userKey (assume body)

        const userImportIdentifier = await Identifier.findOne({
            email: emailImport,
            service: serviceImport.id,
        });
        if (!userImportIdentifier) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: `The user identifier in ${serviceImport.name} was not found for email ${emailImport}. If the user has entered an email for ${serviceImport.name}, it means either the account does not exist or that the email is wrong. If the user is trying to create a new account in ${serviceImport.name} he should be checking the checkbox to set the payload key "isNewAccount" to true.`,
            });
        }

        consentExchange.userExportId = userExportIdentifier.id;
        consentExchange.userImportId = userImportIdentifier.id;
        consentExchange.dataUseExchange = dataUseExchange.id;

        updateConsentStatus(consentExchange, 2100);
        await consentExchange.save();

        // TODO Legacy code, verify relevance (OAuth tests, early 2020)
        const authInfo = await AuthenticationInfo.findOne({
            service: serviceImport.id,
            email: userImportIdentifier.email,
        });

        if (
            serviceImport.authMethod == 1 &&
            !userExportIdentifier.emailVerified
        ) {
            const token = makeId(40);
            const daysUntilExpire = 2;
            const secondsUntilExpire = daysUntilExpire * 24 * 60 * 60;
            const expiresAt = Date.now() / 1000 + secondsUntilExpire;

            consentExchange.emailToken.token = token;
            consentExchange.emailToken.expires = expiresAt;

            updateConsentStatus(consentExchange, 2150, emailImport);
            await consentExchange.save();

            EmailHandler.sendEmailVerification(
                emailImport,
                serviceImport.id,
                serviceExport.id,
                serviceImport.name,
                serviceExport.name,
                purpose.id,
                token
            );

            return successRes({
                code: 202,
                req,
                res,
                message: `Consent paused and email verification link sent to ${emailImport}`,
                data: {
                    emailSent: emailImport,
                    consentId: consentExchange.id,
                    verifyEmail: true,
                },
            });
        } else if (!authInfo && serviceImport.authMethod == 0) {
            // TODO Legacy oauth tests code
            return res.status(403).json({
                error: 'user-authentication-import-error',
                message: 'User not authenticated in service Import',
            });
        }

        consentExchange.verified = 1;

        updateConsentStatus(consentExchange, 2200);
        await consentExchange.save();

        // Verify both identifiers are in CE
        if (userImportIdentifier && userExportIdentifier) {
            if (!userImportIdentifier.user && !userExportIdentifier.user) {
                // Look for identifier matching with email export or email import
                const emailMatchingIdentifiers = await Identifier.find({
                    $or: [{ email: emailExport }, { email: emailImport }],
                });

                // Find one that has a user
                const identifierHasUser = emailMatchingIdentifiers.find(
                    (id) => id.user !== null
                );

                user = identifierHasUser
                    ? await User.findById(identifierHasUser.user)
                    : new User();

                user.identifiers.push(
                    userImportIdentifier.id,
                    userExportIdentifier.id
                );
                user.emails.push(
                    userImportIdentifier.email,
                    userExportIdentifier.email
                );
                userExportIdentifier.user = user.id;
                userImportIdentifier.user = user.id;

                await Promise.all([
                    userExportIdentifier.save(),
                    userImportIdentifier.save(),
                    user.save(),
                ]);
            } else if (
                !userImportIdentifier.user ||
                !userExportIdentifier.user
            ) {
                // Set the id and email as the one that is missing
                const id = !userImportIdentifier.user
                    ? userExportIdentifier.user
                    : userImportIdentifier.user;
                const email = !userImportIdentifier.user
                    ? userImportIdentifier.email
                    : userExportIdentifier.email;

                userImportIdentifier.user = id;
                userExportIdentifier.user = id;

                const userIdentifierId = !userImportIdentifier.user
                    ? userImportIdentifier.id
                    : userExportIdentifier.id;

                user = await User.findById(id);

                user.emails.push(email);
                user.identifiers.push(userIdentifierId);

                await Promise.all([
                    userExportIdentifier.save(),
                    userImportIdentifier.save(),
                    user.save(),
                ]);
            } else {
                user = await User.findById(userExportIdentifier.user);
            }

            const consentId = consentExchange._id.toString();
            const content = {
                purposeName: purpose.name,
                serviceImportName: serviceImport.name,
                serviceExportName: serviceExport.name,
                userImportId: userImportIdentifier.userServiceId || '123',
                userExportId: userExportIdentifier.userServiceId,
                emailImport: userImportIdentifier.email,
                emailExport: userExportIdentifier.email,
                consentId,
            };

            const privateKey = crypto.createPrivateKey(keys.privateRSAEncrypt);
            const encryptedData = crypto.privateEncrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING,
                },
                Buffer.from(JSON.stringify(content))
            );

            const urlObject = getEndpoint(
                userExportIdentifier,
                serviceImport.id,
                serviceExport,
                'consentExport'
            );

            if (urlObject.url === null) {
                Logger.error(urlObject.error);
                return errorRes({
                    code: 404,
                    req,
                    res,
                    errorMsg: urlObject.error,
                    message: 'failed to get consentExport endpoint',
                });
            }

            const url = urlObject.url;

            updateConsentStatus(consentExchange, 2300, serviceExport.name);
            await consentExchange.save();

            try {
                await axios({
                    method: 'POST',
                    url: url,
                    data: {
                        signedConsent: encryptedData.toString('base64'),
                    },
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                Logger.error(
                    `{consents.exchange}.startExportExchange.axios.fail -- url: ${url} - error: ${error.message}`
                );
                return errorRes({
                    code: 424,
                    req,
                    res,
                    errorMsg: 'EREQUESTFAILED',
                    message: `An error occured after calling the consent export endpoint of ${serviceExport.name}`,
                    data: {
                        details: {
                            errorMessage: error.message,
                            urlRequested: url,
                        },
                    },
                });
            }

            const redirectionUrl = serviceImport.urls?.website;

            return successRes({
                code: 200,
                req,
                res,
                message: `Consent created and sent to ${serviceExport.name}.`,
                data: {
                    success: true,
                    followInfo: `To follow the status of the consent, please use the following link ${process.env.URL}/consents/status/${consentExchange.id}`,
                    consentId: consentExchange.id,
                    redirectionUrl,
                },
            });
        } else if (!userImportIdentifier) {
            // TODO Check relevance of this code (seems to be Yanick OAuth tests 2020)
            let url = serviceImport.urls.authURL;
            consentExchange.userExportId = userExportIdentifier.id;
            consentExchange.dataUseExchange = dataUseExchange.id;
            consentExchange.consented = true;

            updateConsentStatus(consentExchange, 6666);
            await consentExchange.save();

            url = updateUrlParameter(
                url,
                'consentID',
                consentExchange.id.ToString()
            );

            res.redirect(url);
        } else {
            return res.status(500).json({ error: 'unknown-error' });
        }
    } catch (err) {
        Logger.error('consents.startExportExchange -- ' + err.message);
        // TODO Should be consents error
        next(new VisionsError(err.message));
    }
};

/**
 * Attaches the token to the consent exchange and sends it to the importing service
 * @author Felix Bole
 * @author Yanick Kifack
 */
export const attachToken = async function (
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (req.body.token && req.body.token.length > 50)
            return res.status(400).json({
                error: 'ETOKENSIZE',
                message:
                    'Your token is too large, plase use a token of at most 50 characters.',
            });

        const consentExchange = await ConsentExchange.findById(
            req.body.consentId
        );

        if (!consentExchange) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'consent not found',
                message:
                    'Consent not found, please verify the consent id provided in the request body.',
            });
        }

        const { token } = req.body;
        consentExchange.token = token;

        const [userImportId, userExportId] = await Promise.all([
            Identifier.findById(consentExchange.userImportId),
            Identifier.findById(consentExchange.userExportId),
        ]);

        const [serviceImport, serviceExport] = await Promise.all([
            Service.findById(userImportId.service).select('name urls'),
            Service.findOne({ serviceKey: req.serviceKey }).select('urls name'),
            await consentExchange.save(),
        ]);

        const content = {
            serviceImportName: serviceImport.name,
            serviceExportName: serviceExport.name,
            userImportId: userImportId.userServiceId || '123',
            userExportId: userExportId.userServiceId,
            emailImport: userImportId.email,
            emailExport: userExportId.email,
            token: consentExchange.token,
            consentId: consentExchange._id,
        };

        const privateKey = crypto.createPrivateKey(keys.privateRSAEncrypt);
        const encryptedData = crypto.privateEncrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(JSON.stringify(content))
        );

        // Assign URLS from service or individual user

        let dataExportUrl;
        let consentImportUrl;
        let dataImportUrl;

        // Get DataExport url
        const dataExportUrlObject = getEndpoint(
            userExportId,
            serviceImport._id,
            serviceExport,
            'dataExport'
        );

        if (!dataExportUrlObject.url) {
            Logger.error(dataExportUrlObject.error);
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: dataExportUrlObject.error,
                message: 'failed to get service import data export endpoint',
            });
        } else {
            dataExportUrl = dataExportUrlObject.url;
        }

        // Get consentImport Url
        const consentImportUrlObject = getEndpoint(
            userImportId,
            serviceExport._id,
            serviceImport,
            'consentImport'
        );

        if (!consentImportUrlObject.url) {
            Logger.error(consentImportUrlObject.error);
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: consentImportUrlObject.error,
                message: 'failed to get service import consent import endpoint',
            });
        } else {
            consentImportUrl = consentImportUrlObject.url;
        }

        // Get dataImport Url
        const dataImportUrlObject = getEndpoint(
            userImportId,
            serviceExport._id,
            serviceImport,
            'dataImport'
        );

        if (!dataImportUrlObject.url) {
            Logger.error(dataImportUrlObject.error);
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: dataImportUrlObject.error,
                message: 'failed to get service import data import endpoint',
            });
        } else {
            dataImportUrl = dataImportUrlObject.url;
        }

        try {
            await axios({
                method: 'POST',
                url: consentImportUrl,
                data: {
                    serviceExportUrl: dataExportUrl,
                    dataImportUrl: dataImportUrl,
                    signedConsent: encryptedData.toString('base64'),
                },
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            Logger.error(
                `{consents.exchange}.attachToken.axios.fail -- url: ${consentImportUrl} - error: ${error.message}}`
            );
            return errorRes({
                code: 424,
                req,
                res,
                errorMsg: 'EREQUESTFAILED',
                message: `an error occured after calling the consent import endpoint of ${serviceImport.name}`,
                data: {
                    details: {
                        errorMessage: error.message,
                        urlRequested: consentImportUrl,
                    },
                },
            });
        }

        updateConsentStatus(consentExchange, 3000, serviceImport.name);
        await consentExchange.save();

        return successRes({
            code: 200,
            req,
            res,
            message: `Signed consent sent to ${serviceImport.name}`,
            data: { consentId: consentExchange.id },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verifies that the token matches the right consent and the user identity in the service and returns datatypes
 * @author Felix Bole
 * @author Yanick Kifack
 */
export const verifyTokenAndUserIdentity = async function (
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const consentExchange = await ConsentExchange.findById(
            req.body.consentId
        );

        if (!consentExchange) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: 'Consent not found',
            });
        }

        const datatypes = [];

        for (const dt of consentExchange.data) {
            if (dt.authorized == true) {
                const datatype = await DataType.findById(dt.datatype);

                if (!datatype) continue;

                const datatypeField = await DataTypeField.findOne({
                    datatype: datatype.id,
                }).populate<{
                    fields: HydratedDocument<IDataTypeField>[];
                }>('fields', 'name');

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
        }

        const [userImport, userExport] = await Promise.all([
            Identifier.findById(consentExchange.userImportId),
            Identifier.findById(consentExchange.userExportId),
        ]);

        const userImportObject = {
            email: userImport.email,
            userServiceId: userImport.userServiceId,
        };

        const userExportObject = {
            email: userExport.email,
            userServiceId: userExport.userServiceId,
        };

        let user = null;
        if (userExport.user) user = await User.findById(userExport.user);
        else if (userImport.user) user = await User.findById(userImport.user);

        if (
            (user &&
                !user.firstName &&
                !user.lastName &&
                !user.email &&
                !user.password) ||
            !user
        ) {
            const daysUntilExpire = 1;
            const secondsUntilExpire = daysUntilExpire * 24 * 60 * 60;
            const expiresAt = Date.now() / 1000 + secondsUntilExpire;

            const confirm = new ConfirmationAccount({
                email: userImport.email,
                token: makeId(50),
                expires: expiresAt,
            });

            if (user) confirm.user = user.id;
            else confirm.identifiers = [userExport.id, userImport.id];

            await confirm.save();

            try {
                EmailHandler.sendExchangeCompleteEmail(
                    userExport.email,
                    userImport.email,
                    confirm.token
                );
            } catch (e) {
                Logger.error(
                    `{consents.verifyTokenAndUserIdentity.email} -- ${e.message}`
                );
            }
        }

        // TODO: Find parent consent and update it (Processor Protocol)

        updateConsentStatus(consentExchange, 4000, 'service export');
        await consentExchange.save();

        // Find services
        const serviceImport = await Service.findById(userImport.service);
        const serviceExport = await Service.findById(userExport.service);

        const urlObject = getEndpoint(
            userImport,
            serviceExport._id,
            serviceImport,
            'dataImport'
        );

        if (urlObject.url === null) {
            Logger.error(
                '{consent.exchange}.verifyTokenAndUserIdentity.url.null'
            );
            return res.status(404).json({ message: urlObject.error });
        }

        const url = urlObject.url;

        return res.status(200).json({
            userExport: userExportObject,
            userImport: userImportObject,
            dataImportEndpoint: url,
            datatypes: datatypes,
            verified: true,
        });
    } catch (err) {
        Logger.error('Failed to verify consent : ' + err.message);
        next(err);
    }
};

type ConsentExchangeFromPopulatedType = Omit<
    Omit<
        Omit<
            Omit<HydratedDocument<IConsentExchange>, 'dataUseExchange'>,
            'userExportId'
        >,
        'userImportId'
    >,
    'user'
>;

/**
 * Fetches appropriate consent after import service creates verified account and launches exchange protocol
 * @author Felix boolean
 * @author Yanick Kifack
 */
export const verifyConsentOnVerifiedAccountCreation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let user;

    try {
        const serviceImport = await Service.findById(req.service);
        const consentExchange = await ConsentExchange.findById(
            req.body.consentId
        )
            .populate<{ dataUseExchange: HydratedDocument<IDataUseExchange> }>(
                'dataUseExchange'
            )
            .populate<{ userExportId: HydratedDocument<IIdentifier> }>(
                'userExportId'
            )
            .populate<{ userImportId: HydratedDocument<IIdentifier> }>(
                'userImportId'
            )
            .populate<{ user: HydratedDocument<IUser> }>('user');

        if (!consentExchange)
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'Resource not found',
                message: 'Specified consentId does not match any consent',
            });

        if (consentExchange.verified == 1)
            return errorRes({
                code: 409,
                req,
                res,
                errorMsg: 'ECONSENTALREADYVERIFIED',
                message: 'This consent has already been verified',
            });

        const userIdentifier = await Identifier.findOne({
            userKey: req.body.userKey,
            service: serviceImport.id,
        });

        if (!userIdentifier)
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'Resource not found',
                message:
                    'Could not find user using the user service id provided',
            });

        // We know this comes after a verified user creation so verify the identifier
        userIdentifier.emailVerified = true;

        await userIdentifier.save();

        consentExchange.userImportId = userIdentifier.id;

        const userImportIdentifier = userIdentifier;
        const userExportIdentifier = consentExchange.userExportId;
        const dataUseExchange = consentExchange.dataUseExchange;
        const emailImport = userIdentifier.email;
        const emailExport = userExportIdentifier.email;

        // Consent can now be verified
        consentExchange.verified = 1;
        consentExchange.consented = true;

        await consentExchange.save();
        updateConsentStatus(
            consentExchange as ConsentExchangeFromPopulatedType,
            2200
        );

        if (!userImportIdentifier.user && !userExportIdentifier.user) {
            // Look for identifier matching with email export or email import
            const emailMatchingIdentifiers = await Identifier.find({
                $or: [{ email: emailExport }, { email: emailImport }],
            });

            // Find one that has a user
            const identifierHasUser = emailMatchingIdentifiers.find(
                (id) => id.user !== null
            );

            const user = identifierHasUser
                ? await User.findById(identifierHasUser.user)
                : new User();

            user.identifiers.push(
                userImportIdentifier.id,
                userExportIdentifier.id
            );
            user.emails.push(
                userImportIdentifier.email,
                userExportIdentifier.email
            );
            userImportIdentifier.user = user.id;
            userExportIdentifier.user = user.id;

            await Promise.all([
                userImportIdentifier.save(),
                userExportIdentifier.save(),
                user.save(),
            ]);
        } else if (!userImportIdentifier.user || !userExportIdentifier.user) {
            // Set the id and email as the one that is missing
            const id = !userImportIdentifier.user
                ? userExportIdentifier.user
                : userImportIdentifier.user;
            const email = !userImportIdentifier.user
                ? userImportIdentifier.email
                : userExportIdentifier.email;

            userImportIdentifier.user = id;
            userExportIdentifier.user = id;

            const userIdentifierId = !userImportIdentifier.user
                ? userImportIdentifier.id
                : userExportIdentifier.id;

            user = await User.findById(id);

            if (emailImport !== emailExport) {
                if (!user.emails.includes(email)) user.emails.push(email);
            }
            if (!user.identifiers.includes(userIdentifierId))
                user.identifiers.push(userIdentifierId);

            await Promise.all([
                userImportIdentifier.save(),
                userExportIdentifier.save(),
                user.save(),
            ]);
        } else {
            user = await User.findById(userExportIdentifier.user);
        }

        if (!dataUseExchange) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'resource not found',
                message: 'Data exchange configuration not found',
            });
        }

        const serviceExport = await Service.findById(
            userExportIdentifier.service
        );

        const consentId = consentExchange._id.toString();
        const content = {
            serviceImportName: serviceImport.name,
            serviceExportName: serviceExport.name,
            userImportId: userImportIdentifier.userServiceId,
            userExportId: userExportIdentifier.userServiceId,
            emailImport: userImportIdentifier.email,
            emailExport: userExportIdentifier.email,
            consentId,
        };

        const privateKey = crypto.createPrivateKey(keys.privateRSAEncrypt);
        const encryptedData = crypto.privateEncrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(JSON.stringify(content))
        );

        const urlObject = getEndpoint(
            userExportIdentifier,
            serviceImport._id,
            serviceExport,
            'consentExport'
        );

        if (urlObject.url === null) {
            Logger.error(urlObject.error);
            return res.status(404).json({ message: urlObject.error });
        }

        const url = urlObject.url;

        try {
            axios({
                method: 'POST',
                url: url,
                data: {
                    signedConsent: encryptedData.toString('base64'),
                },
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            Logger.error(
                '{consents.verifyConsentOnVerifiedAccountCreation}.callToExportUrl -- ' +
                    error.message
            );
            return errorRes({
                code: 424,
                req,
                res,
                errorMsg: 'EREQUESTFAILED',
                message: `Something went wrong when making the request to the consent export endpoit of ${serviceExport.name}`,
                data: {
                    details: {
                        errorMessage: error.message,
                        urlRequested: url,
                    },
                },
            });
        }

        if (consentExchange.flow) {
            updateConsentStatus(
                consentExchange as ConsentExchangeFromPopulatedType,
                2300
            );
        }

        return successRes({
            code: 200,
            req,
            res,
            message:
                'Consent has been sent to the consent export endpoint of the export service. You should shortly be receiving the signed consent on your /consent/import endpoint.',
            data: {
                consentId: consentExchange.id,
            },
        });
    } catch (err) {
        Logger.error(
            '{consents.verifyConsentOnVerifiedAccountCreation}.fail -- ' +
                err.message
        );
        next(err);
    }
};

/**
 * Verifies the signedConsent received by the interoperability service and
 * returns the associated consentExchange information such as final dataImportUrl
 * @author Felix Bole
 */
export const verifyInteropConsent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { signedConsent } = req.body;
        const consentData = decryptSignedConsent(signedConsent);
        const ce = await ConsentExchange.findById(consentData.consentId);
        if (!ce) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'consent not found',
                message: 'Consent exchange not found with this id',
                data: { verified: false },
            });
        }

        // CHECK IF IN TESTENV
        if (!(await Identifier.findById(ce.userImportId))) {
            const responseData = {
                verified: true,
                dataImportUrl: `${process.env.API_URL}/testenv/data/import`,
            };
            return successRes({ code: 200, req, res, data: responseData });
        }

        const userImportId = await Identifier.findById(
            ce.userImportId
        ).populate<{ service: Pick<HydratedDocument<IService>, 'urls'> }>(
            'service',
            'urls'
        );
        if (!userImportId) {
            return errorRes({
                code: 404,
                req,
                res,
                errorMsg: 'identifier not found',
                message: `The user identifier in the import service was not found`,
            });
        }

        const responseData = {
            verified: true,
            dataImportUrl: userImportId.service.urls.dataImport,
        };
        return successRes({ code: 200, req, res, data: responseData });
    } catch (err) {
        Logger.error({
            message: err.message,
            location: 'testenv.verifyInteropConsent',
        });
        next(err);
    }
};
