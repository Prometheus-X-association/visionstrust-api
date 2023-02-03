import crypto from 'crypto';

import {
    AuthenticationInfo,
    ConfirmationAccount,
    ConsentExchange,
    DataType,
    DataTypeField,
    DataUseExchange,
    Identifier,
    Purpose,
    Service,
    User,
} from '@visionsofficial/visions-public-models';
import { Request, Response } from 'express';
import { HydratedDocument } from 'mongoose';
import { keys } from '../../../config';
import { Logger } from '../../../libs/loggers';
import { getEndpoint } from '../../../utils/consentExchangeHelper';
import { updateConsentStatus } from '../../../utils/consentStatus';
import axios from 'axios';
import { updateUrlParameter } from '../../../utils/utils';
import { EmailHandler } from '../../../libs/emails/EmailHandler';
import { makeId } from '../../../utils/idGenerator';
import { IDataTypeField } from '@visionsofficial/visions-public-models/lib/types/datatypefield';

/**
 * Creates a new ConsentExchange
 * @author Yanick Kifack
 * @author Felix Bole
 */
export const createConsentExchange = async (req: Request, res: Response) => {
    try {
        let serviceImport, user;

        // Parameters verification

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
                parameter: 'userKey',
                message: 'Missing key of your user',
            });

        if (!req.body.datatypes)
            errors.push({
                datatypes: 'datatypes',
                message: 'Missing data selected by the user',
            });

        if (errors.length > 0) return res.status(400).json({ errors: errors });

        serviceImport = await Service.findOne({
            serviceKey: req.serviceKey,
        }).populate('purposes', ['name', 'id']);
        if (!serviceImport)
            return res.status(404).json({
                error: 'Could not find Service Import',
                message:
                    'Please verify your serviceKey and authorisation header',
            });

        const serviceExport = await Service.findOne({
            name: req.body.serviceExport,
        });
        if (!serviceExport)
            return res.status(404).json({
                error:
                    'Could not find Service Export for name : ' +
                    req.body.serviceExport,
            });

        const purpose = await Purpose.findById(req.body.purpose.trim());
        if (!purpose)
            return res.status(404).json({
                error: 'Could not find purpose for id : ' + req.params.purpose,
            });

        const dataUseExchange = await DataUseExchange.findOne({
            purpose: purpose.id,
            serviceImport: serviceImport.id,
            'data.serviceExport': serviceExport.id,
        });

        if (!dataUseExchange)
            return res.status(404).json({
                error: 'Could not find a configured data exchange',
                message:
                    'Please verify that you have requested data and that ' +
                    serviceExport.name +
                    ' has authorized the exchange',
            });

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
        const userImportIdentifier = await Identifier.findOne({
            userKey: userKey,
        });

        if (!userImportIdentifier) {
            return res
                .status(404)
                .json({ message: 'User import identifier not found' });
            // Send back to SI.urls.authURL
        }
        // Find export identifier
        const userExportIdentifier = await Identifier.findOne({
            email: emailExport,
            service: serviceExport.id,
        });

        if (!userExportIdentifier) {
            return res.json({
                success: false,
                message: 'Identifier in export service not found',
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
            // Generate mail token
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

            return res.json({
                verifyEmail: true,
                message:
                    'Consent paused and waiting on email validation sent to: ' +
                    emailExport,
            });
        } else if (!authInfo && serviceExport.authMethod == 0) {
            return res.json({
                success: false,
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
                // let user;
                if (identifierHasUser != undefined) {
                    // Update user
                    user = await User.findById(identifierHasUser.user);

                    user.identifiers.push(
                        userImportIdentifier.id,
                        userExportIdentifier.id
                    );

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
                Logger.error({
                    message: 'urlObject url is null',
                    location:
                        '{consent.exchange.legacy}.createConsentExchange.urls.consentExport.null',
                });
                return res.status(404).json({ message: urlObject.error });
            }

            const url = urlObject.url;
            const consentId = consentExchange._id.toString();

            // Processor protocol
            if (serviceImport.isProcessing) {
                const consentP = new ConsentExchange({
                    dataUseExchange: consentExchange.dataUseExchange,
                    userImportId: consentExchange.userImportId,
                    data: consentExchange.data,
                    consented: true,
                    parent: consentExchange.id,
                    verified: 1,
                });

                consentExchange.child = consentP.id;

                await consentExchange.save();
                await consentP.save();
            }

            const content = {
                serviceImportName: serviceImport.name,
                serviceExport: serviceExport.name,
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
                return res.status(500).json({
                    error: 'request-error',
                    message:
                        'Something went wrong when making the request to the consent export endpoit of ' +
                        serviceExport.name,
                });
            }

            updateConsentStatus(consentExchange, 1300, serviceExport.name);
            await consentExchange.save();

            return res.json({
                success: true,
                redirectionUrl: serviceExport.urls.website || undefined,
                signedConsent: encryptedData.toString('base64'),
                message: 'Consentement signé envoyé à ' + serviceExport.name,
                followInfo: `To follow the status of the consent, please une the following link ${process.env.URL}/consents/status/${consentExchange.id}`,
            });
        } else if (!userImportIdentifier) {
            serviceImport = await Service.findById(
                dataUseExchange.serviceImport
            );

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
            res.status(404).json({
                message:
                    'No users were found in your service or the target service.',
            });
        }
    } catch (err) {
        Logger.error({
            message: err.message,
            location: '{consent.exchange.legacy}.createConsentExchange.catch',
        });
        return res
            .status(500)
            .json({ error: 'internal-server-error', details: err.message });
    }
};

/**
 * Creates or updated consent document
 */
export const getConsentStatusInformation = async (
    req: Request,
    res: Response
) => {
    const consent = await ConsentExchange.findById(req.params.consentId);
    if (consent.status) return res.json({ status: consent.status });
    else return res.json({ message: 'No status on this consent' });
};

/**
 * Verifies that the token matches the right consent and the user identity in the service
 * @author Yanick Kifack
 * @deprecated Use V1 instead
 */
export const verifyTokenAndUserIdentity = async function (
    req: Request,
    res: Response
) {
    const consentExchange = await ConsentExchange.findById(req.body.consentId);
    if (!consentExchange) {
        return res.status(404).json({
            error: true,
            message: 'Consent Exchange not found',
            verified: false,
            success: false,
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

        if (user) {
            confirm.user = user.id;
        } else {
            confirm.identifiers = [userExport.id, userImport.id];
        }
        await confirm.save();

        try {
            EmailHandler.sendExchangeCompleteEmail(
                userExport.email,
                userImport.email,
                confirm.token
            );
        } catch (e) {
            Logger.error({
                message: e.message,
                location: '{legacy.consents.verifyTokenAndUserIdentity.email}',
            });
        }
    }

    updateConsentStatus(consentExchange, 4000, 'service export');
    await consentExchange.save();

    res.json({
        user: userExportObject,
        userImport: userImportObject,
        datatypes: datatypes,
        verified: true,
        success: true,
    });
};
