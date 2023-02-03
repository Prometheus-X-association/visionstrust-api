import {
    AuthenticationInfo,
    ConsentExchange,
    DataType,
    DataUseExchange,
    Identifier,
    Purpose,
    Service,
    User,
} from '@visionsofficial/visions-public-models';
import { Request, Response } from 'express';
import { keys } from '../../../config';
import { Logger } from '../../../libs/loggers';
import { getEndpoint } from '../../../utils/consentExchangeHelper';
import { updateConsentStatus } from '../../../utils/consentStatus';
import crypto from 'crypto';
import axios from 'axios';
import moment from 'moment';

/**
 * Validates the email sent to the user for his consent on an exchange
 * @important This method is still used even for v1 as emailhandler points the URL to this route
 */
export const validateEmail = async (req: Request, res: Response) => {
    try {
        const {
            token,
            purpose: purposeId,
            serviceImport: serviceImportId,
            serviceExport: serviceExportId,
        } = req.params;

        const [serviceImport, serviceExport, purpose, consentExchange] =
            await Promise.all([
                Service.findById(serviceImportId),
                Service.findById(serviceExportId),
                Purpose.findById(purposeId),
                ConsentExchange.findOne({ 'emailToken.token': token }),
            ]);

        let user;

        if (!consentExchange) {
            return res.render('confirmation/errorMessage', {
                message: 'Ce consentement a déjà été validé',
            });
        }
        const expiresAt = consentExchange.emailToken.expires;
        const secondsSinceEpoch = Date.now() / 1000;

        if (expiresAt < secondsSinceEpoch) {
            return res.render('confirmation/errorMessage', {
                message:
                    'Le token du consentement a expiré, veuillez effectuer un nouvel échange de données et valider le lien qui vous sera envoyé dans un nouveau mail suite à ce nouvel échange.',
            });
        }

        const [userExportIdentifier, dataUseExchange, userImportIdentifier] =
            await Promise.all([
                Identifier.findById(consentExchange.userExportId),
                DataUseExchange.findById(consentExchange.dataUseExchange),
                Identifier.findById(consentExchange.userImportId),
            ]);

        if (!dataUseExchange) {
            res.send('<h1>Data useExchange not found</h1>');
            return;
        }

        userExportIdentifier.emailVerified = true;
        userImportIdentifier.emailVerified = true;

        consentExchange.verified = 1;
        consentExchange.consented = true;
        consentExchange.emailToken.token = '';
        updateConsentStatus(consentExchange, 1200);

        await Promise.all([
            userExportIdentifier.save(),
            userImportIdentifier.save(),
            consentExchange.save(),
        ]);

        const emailImport = userImportIdentifier?.email;
        const emailExport = userExportIdentifier?.email;

        if (!userImportIdentifier && !userExportIdentifier) {
            return res.send('<h1>Unexpected Error</h1>');
        }

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
                user.emails.push(emailExport, emailImport);
                await user.save();
            } else {
                user = new User();
                user.identifiers.push(
                    userImportIdentifier.id,
                    userExportIdentifier.id
                );
                user.emails.push(emailExport, emailImport);
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

            if (emailImport != emailExport) {
                user.emails.push(email);
            }

            user.identifiers.push(userIdentifierId);
            await Promise.all([
                userImportIdentifier.save(),
                userExportIdentifier.save(),
                user.save(),
            ]);
        } else {
            user = await User.findById(userImportIdentifier.user);
        }

        let content: any = {};

        const urlObject = getEndpoint(
            userExportIdentifier,
            serviceImport.id,
            serviceExport,
            'consentExport'
        );

        if (urlObject.url === null) {
            Logger.error({
                message: 'urlObject.url is null',
                location: 'exchange.validateEmail.urls.consentExport.null',
            });
            return res.status(404).json({ message: urlObject.error });
        }

        const url = urlObject.url;
        const consentId = consentExchange._id.toString();

        content = {
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
            Logger.error({
                message: `${url} -> ${error.message}`,
                location: 'exchange.validateEmail.axios.fail',
            });
            return res.send('Error');
        }

        updateConsentStatus(consentExchange, 1300, serviceExport.name);
        await consentExchange.save();

        const result: any = {
            serviceExportName: serviceExport.name,
            serviceImportLogo: '/images/services/' + serviceImport.logo,
            serviceExportLogo: '/images/services/' + serviceExport.logo,
            purpose: purpose.name,
            serviceExport: serviceExport.name,
            serviceImport: serviceImport.name,
            exportEmail: userExportIdentifier.email,
            importEmail: userImportIdentifier.email,
            createdAt: consentExchange.timestamp,
            datatypes: [],
        };

        const data = consentExchange.data;

        for (let i = 0; i < data.length; i++) {
            const dt = await DataType.findById(data[i].datatype).select('name');

            result.datatypes.push({
                name: dt.name,
                authorized: data[i].authorized,
            });
        }

        return res.render('confirmation/emailConfirm', {
            data: result,
            moment: moment,
        });
    } catch (error) {
        Logger.error({
            message: error.message,
            location: 'helper.validateEmail',
        });
        res.send('<h1>Error</h1>');
    }
};

/**
 * @author Yanick Kifack
 */
export const getAccessToken = async (req: Request, res: Response) => {
    const service = await Service.findOne({
        name: req.body.serviceName,
    });
    if (!service)
        return res.json({ received: false, message: 'Service not found' });
    const [identifier, authenticationInfo] = await Promise.all([
        Identifier.findOne({
            email: req.body.email,
            service: service.id,
        }),
        AuthenticationInfo.findOne({
            service: service.id,
            requestToken: req.body.requestToken,
        }),
    ]);

    if (identifier && authenticationInfo) {
        authenticationInfo.accessToken = req.body.accessToken;
        authenticationInfo.email = req.body.email;
        await authenticationInfo.save();
        return res.json({
            received: true,
            message: 'Access token received',
        });
    } else {
        return res.json({
            received: false,
            message: 'No user found with this email',
        });
    }
};

/**
 * Return datatypes of one purpose
 * @author Yanick Kifack
 */
export const getPurposeDataTypes = async (req: Request, res: Response) => {
    const purpose = await Purpose.findById(req.params.purposeId)
        .select('name _id datatypes')
        .populate('datatypes', 'name _id provenance');
    res.json({
        datatypes: purpose.datatypes,
        name: purpose.name,
        id: purpose.id,
    });
};

/**
 * Return all datatypes of a service
 * @author Yanick Kifack
 */
export const getSerciceDataTypes = async (req: Request, res: Response) => {
    const datatypes = await DataType.find({
        provenance: req.params.serviceId,
    });
    res.json(datatypes);
};
