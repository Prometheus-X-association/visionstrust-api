import globalPurposes from './globalPurposes';
import globalDataTypes from './globalDataTypes';

const routers = [
    {
        prefix: '/globaldatatypes',
        router: globalDataTypes,
    },
    {
        prefix: '/globalpurposes',
        router: globalPurposes,
    },
];

export default {
    prefix: '/v1',
    routers,
};
