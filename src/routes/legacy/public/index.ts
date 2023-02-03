// PUBLIC LEGACY ROUTERS

import consents from './consents';
import helper from './helper';

const routers = [
    {
        prefix: '/consents',
        router: consents,
    },
    {
        prefix: '/helper',
        router: helper,
    },
];

export default {
    prefix: '',
    routers,
};
