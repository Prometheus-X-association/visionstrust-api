import path from 'path';
import fs from 'fs';

export const keys = {
    privateRSAEncrypt: fs
        .readFileSync(
            path.join(__dirname, '..', '..', 'keys', 'rsa-encrypt-private.pem')
        )
        .toString(),
    publicRSAEncrypt: fs
        .readFileSync(
            path.join(__dirname, '..', '..', 'keys', 'rsa-encrypt-public.pem')
        )
        .toString(),
};
