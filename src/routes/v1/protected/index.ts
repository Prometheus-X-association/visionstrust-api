import users from './users';
import contracts from './contracts';
import consents from './consents';
import datasets from './datasets';
import datatypes from './datatypes';
import exchangeAuthorizations from './exchangeAuthorizations';
import exchanges from './exchanges';
import globalDataTypes from './globalDataTypes';
import globalPurposes from './globalPurposes';
import popups from './popups';
import purposes from './purposes';
import services from './services';
import termsOfUse from './termsOfUse';
import testenv from './testenv';

const routers = [
    {
        prefix: '/consents',
        router: consents,
    },
    {
        prefix: '/contracts',
        router: contracts,
    },
    {
        prefix: '/datasets',
        router: datasets,
    },
    {
        prefix: '/datatypes',
        router: datatypes,
    },
    {
        prefix: '/exchangeauthorizations',
        router: exchangeAuthorizations,
    },
    {
        prefix: '/exchanges',
        router: exchanges,
    },
    {
        prefix: '/globaldatatypes',
        router: globalDataTypes,
    },
    {
        prefix: '/globalpurposes',
        router: globalPurposes,
    },
    {
        prefix: '/popups',
        router: popups,
    },
    {
        prefix: '/purposes',
        router: purposes,
    },
    {
        prefix: '/services',
        router: services,
    },
    {
        prefix: '/termsofuse',
        router: termsOfUse,
    },
    {
        prefix: '/testenv',
        router: testenv,
    },
    {
        prefix: '/users',
        router: users,
    },
];

export default {
    prefix: '/v1',
    routers,
};
