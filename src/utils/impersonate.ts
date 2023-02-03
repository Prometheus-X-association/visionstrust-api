import { Service } from '@visionsofficial/visions-public-models';
import axios from 'axios';
import { Types } from 'mongoose';
import { Logger } from '../libs/loggers';
import { generateToken } from './jwt';

/**
 * Impersonates a call to the API from a service fired from within the app
 * Used mainly in test environment right now
 * @author Felix Bole
 */
export const impersonatePOST = async (
    serviceId: Types.ObjectId | string,
    path: string,
    body = {}
) => {
    try {
        const service = await Service.findById(serviceId)
            .select('serviceKey serviceSecretKey')
            .lean();
        const res = await axios({
            method: 'POST',
            url: process.env.URL + path,
            data: body,
            headers: {
                'Content-Type': 'application/json',
                authorization:
                    'Bearer ' +
                    generateToken(service.serviceKey, service.serviceSecretKey),
            },
        });
        return res;
    } catch (err) {
        Logger.error(`impersonate.post -- ${err.message}`);
        return null;
    }
};
