/// File implemented by Yanick Kifack a very long time ago
/// Might not be relevant anymore
/// Ported to typescript without re-checking the loigc

import crypto from 'crypto';
import { Service } from '@visionsofficial/visions-public-models';

export const CreateHashCodeForOauth = (
    clientId: string,
    requestToken: string,
    secretKey: string
) => {
    const json = {
        requestToken: requestToken,
        clientId: clientId,
    };

    const message = JSON.stringify(json);

    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    const hash = hmac.digest('hex');
    return hash;
};

export const CreateHashCodeForRegistration = (
    message: string,
    secretKey: string
) => {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    const hash = hmac.digest('hex');
    return hash;
};

export const isServiceAuthorized = async (
    hash: string,
    serviceName: string,
    serviceKey: string,
    description: string
) => {
    const service = await Service.findOne({
        name: serviceName.trim(),
        serviceKey: serviceKey,
    });

    if (!service) return false;

    const data = {
        description: description,
        service: service.name,
        serviceKey: service.serviceKey,
    };

    const secretKey = service.serviceSecretKey;
    const message = JSON.stringify(data);

    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    const hashCode = hmac.digest('hex');
    return hash == hashCode;
};
