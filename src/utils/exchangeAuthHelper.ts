/// Helper to make authorization checks between marketplace and normal auths

import { ExchangeAuthorization } from '@visionsofficial/visions-public-models';
import { Types } from 'mongoose';
import { checkAuthorizationInMarketplace } from '../modules/marketplace';

export const isExchangeAuthorized = async (
    serviceAId: Types.ObjectId,
    serviceBId: Types.ObjectId
) => {
    const marketplaceAuth = await checkAuthorizationInMarketplace(
        serviceAId,
        serviceBId
    );
    if (marketplaceAuth) return true;

    const auth = await ExchangeAuthorization.findOne({
        $or: [
            {
                $and: [
                    { 'requester.service': serviceAId },
                    { 'receiver.service': serviceBId },
                ],
            },
            {
                $and: [
                    { 'requester.service': serviceBId },
                    { 'receiver.service': serviceAId },
                ],
            },
        ],
    });

    if (!auth) return false;

    return auth.isAuthorized();
};

export const getAuthorizationAndStatus = async (
    serviceAId: Types.ObjectId,
    serviceBId: Types.ObjectId,
    isForServiceAId = false
) => {
    const marketplaceAuth = await checkAuthorizationInMarketplace(
        serviceAId,
        serviceBId
    );
    if (marketplaceAuth)
        return {
            authorization: true,
            status: 'authorized',
            exchangeAuthorization: false,
        };

    const { authorization, status, exchangeAuthorization } =
        await ExchangeAuthorization.getAuthorization(
            serviceAId,
            serviceBId,
            isForServiceAId
        );
    return { authorization, status, exchangeAuthorization };
};
