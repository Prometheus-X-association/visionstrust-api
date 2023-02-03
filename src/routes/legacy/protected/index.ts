// PROTECTED LEGACY ROUTERS

import consents from './consents';
import exchange from './exchange';

const routers = [
    {
        prefix: '/consents',
        router: consents,
    },
    {
        prefix: '/exchange',
        router: exchange,
    },
];

export default {
    prefix: '',
    routers,
};
