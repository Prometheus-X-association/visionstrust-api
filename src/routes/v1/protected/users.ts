import { Router } from 'express';
import {
    createUser,
    getAllUsers,
    getUserByEmail,
    getUserById,
    updateUserIdentifier,
} from '../../../controllers/v1/protected/users';
const router = Router();

import { check, body } from 'express-validator';
import { validate } from '../../middleware/validator';
import { apiAuthenticate } from '../../middleware/auth';
import { findUserIdentifierForService } from '../../middleware/queries';

router.use(apiAuthenticate);

router.get('/', getAllUsers);
router.post(
    '/',
    [
        body('email', 'Missing or invalid email for the user.')
            .isEmail()
            .normalizeEmail(),

        body(
            'userServiceId',
            'Missing or empty value. This should match the ID of the user in your database.'
        )
            .not()
            .isEmpty()
            .trim()
            .escape(),
    ],
    validate,
    createUser
);

router.get(
    '/:email',
    [
        check('email', 'Missing or invalid user email.')
            .isEmail()
            .normalizeEmail(),
    ],
    validate,
    findUserIdentifierForService,
    getUserByEmail
);

router.get(
    '/id/:userId',
    [
        check('userId', 'Missing or invalid user id')
            .not()
            .isEmpty()
            .trim()
            .escape(),
    ],
    validate,
    getUserById
);

router.put(
    '/:userKey',
    [
        check('userKey', 'Missing or empty user key.')
            .not()
            .isEmpty()
            .trim()
            .escape(),

        body('email', 'Missing or invalid new user email.')
            .isEmail()
            .normalizeEmail(),
    ],
    validate,
    updateUserIdentifier
);

export default router;
