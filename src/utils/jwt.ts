import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import jwt from 'jsonwebtoken';
import { HydratedDocument } from 'mongoose';

export const generateToken = (serviceKey: string, secretKey: string) => {
    return jwt.sign(
        {
            serviceKey: serviceKey,
        },
        secretKey,
        { expiresIn: 10 * 60 }
    );
};

/**
 * Generates a token for blockchain API
 * @param address The ethereum address
 * @param id The unique contract id
 * @param subject "auth" or "revoke"
 * @author Felix Bole
 */
export const generateBlockchainToken = (
    address: string,
    id: string,
    subject: 'auth' | 'revoke'
) => {
    const secret = process.env.BLOCKCHAIN_API_SECRET;
    const payload = { id: id, address: '' };

    if (subject === 'auth') payload.address = address; // The ethereum wallet address of the user

    return jwt.sign(payload, secret, {
        subject: subject,
    });
};

export const generateSSOToken = (
    service: HydratedDocument<IService>,
    ssoKey: string
) => {
    return jwt.sign(
        {
            applicationName: service.name,
            applicationId: service.id,
        },
        ssoKey,
        {
            expiresIn: 2 * 60,
        }
    );
};
