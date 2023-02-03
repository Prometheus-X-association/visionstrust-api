import { IConsentExchange } from '@visionsofficial/visions-public-models/lib/types/consentexchange';
import { HydratedDocument } from 'mongoose';

/**
 * Updates and saves the consent Exchange using the followCode
 * @param consentExchange The current consent exchange object
 * @param followCode The follow code for the consent exchange
 * @param param The email or the service name depending on the follow code
 * @author Felix Bole
 */
export const updateConsentStatus = (
    consentExchange: HydratedDocument<IConsentExchange>,
    followCode: number,
    param = ''
) => {
    const statusDictionnary = {
        1000: 'Consent created.',
        1100: 'User identifiers and exchange data attached to consent.',
        1150: `Consent paused and waiting on email validation sent to ${param}.`,
        1200: 'Consent has been verified.',
        1300: `Consent signed and sent to ${param}.`,
        2000: 'Consent created.',
        2050: `User export identifier and exchange data attached to consent but user does not have an account in ${param}. Consent paused and waiting on an account to be created.`,
        2100: 'User identifiers and exchange data attached to consent.',
        2150: `Consent paused and waiting on email validation sent to ${param}.`,
        2200: 'Consent has been verified',
        2300: `Consent signed and sent to ${param}.`,
        3000: `Token attached to consent and sent to ${param}.`,
        3050: `Token attached and consent send to interop service ${param}`,
        4000: `Consent verified and datatypes sent to ${param}.`,
        6666: 'OAUTH PROCESS - NEEDS WORK',
    };

    consentExchange.status.followCode = followCode;
    consentExchange.status.text =
        statusDictionnary[followCode as keyof typeof statusDictionnary];
};
