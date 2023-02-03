import fs from 'fs';
import crypto from 'crypto';
import { IIdentifier } from '@visionsofficial/visions-public-models/lib/types/identifier';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { HydratedDocument, Types } from 'mongoose';
import { keys } from '../config';

/**
 * Retrieves a user defined url or the service configured endpoint
 * @author Felix Bole
 */
export const getEndpoint = (
    identifier: HydratedDocument<IIdentifier>,
    targetServiceId: Types.ObjectId | string,
    defaultService: HydratedDocument<IService>,
    keyEndpoint: 'consentImport' | 'consentExport' | 'dataImport' | 'dataExport'
) => {
    const result = { url: '', error: '' };

    if (
        identifier.endpoints &&
        identifier.endpoints[keyEndpoint] &&
        identifier.endpoints[keyEndpoint].length >= 0
    ) {
        const endpoints = identifier.endpoints[keyEndpoint];

        if (endpoints.length > 1) {
            const index = endpoints.findIndex(
                (o) => o.serviceId.toString() === targetServiceId.toString()
            );

            if (index != -1) {
                result.url = endpoints[index].url;
            } else {
                result.error = `No ${keyEndpoint} defined for that service`;
            }
        } else {
            if (endpoints[0] && endpoints[0].url && endpoints[0].url != '') {
                result.url = endpoints[0].url;
            } else {
                result.url = defaultService.urls[keyEndpoint];
            }
        }
    } else {
        if (defaultService.urls[keyEndpoint]) {
            result.url = defaultService.urls[keyEndpoint];
        } else {
            result.error = `The ${keyEndpoint} endpoint is not configured in the service configuration.`;
        }
    }

    return result;
};

/**
 * Decrypts the signed consent
 * @param signedConsent The signed Consent
 * @returns The consent content
 * @author Felix Bole
 */
export const decryptSignedConsent = (signedConsent: string) => {
    if (!signedConsent) throw new Error('No signed consent');
    const publicKeyFromFile = fs.readFileSync(keys.publicRSAEncrypt).toString();
    const publicKey = crypto.createPublicKey(publicKeyFromFile);

    const decryptedData = crypto.publicDecrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(JSON.stringify(signedConsent), 'base64')
    );

    const consentData = JSON.parse(decryptedData.toString());
    return consentData as { consentId: string; token: string };
};

/**
 * Encrypts the consent's content before being sent to platforms
 * @param content The content of the consent
 * @param whether or not to convert it to string base 64 directly
 * @returns The signed consent
 * @author Felix Bole
 */
export const signConsent = (content: object, toBase64 = false) => {
    const privateKeyFromFile = fs
        .readFileSync(keys.privateRSAEncrypt)
        .toString();
    const privateKey = crypto.createPrivateKey(privateKeyFromFile);
    const encryptedData = crypto.privateEncrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
            // oaepHash: "sha256",
        },
        // We convert the data string to a buffer using `Buffer.from`
        Buffer.from(JSON.stringify(content))
    );
    return toBase64 ? encryptedData.toString('base64') : encryptedData;
};
