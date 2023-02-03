/// This file is old and methods should be placed
/// somewhere like in query helpers and should be reviewed
/// as it seems a little off and not relevant anymore

import {
    DataUseExchange,
    Identifier,
} from '@visionsofficial/visions-public-models';
import { IPurpose } from '@visionsofficial/visions-public-models/lib/types/purpose';
import { IService } from '@visionsofficial/visions-public-models/lib/types/service';
import { HydratedDocument, Types } from 'mongoose';

/**
 * @todo review this method, it seems a little off
 * @author Yanick Kifack
 */
export const getDataUseExchangeDetails = async (
    dataUseExchangeId: string | Types.ObjectId
) => {
    const dataUseExchange = await DataUseExchange.findById(dataUseExchangeId)
        .populate<{ purpose: HydratedDocument<IPurpose> }>('purpose', 'name')
        .populate<{ serviceImport: HydratedDocument<IService> }>(
            'serviceImport',
            'name'
        )
        .select('purpose serviceExport serviceImport');

    const obj = {
        purpose: dataUseExchange.purpose.name,
        purposeName: dataUseExchange.purpose.name,
        serviceImportName: dataUseExchange.serviceImport.name,
    };
    return obj;
};

/**
 * @todo review this method, it seems a little off
 * @author Yanick Kifack
 */
export const getUserDetails = async (userId: Types.ObjectId | string) => {
    const user = await Identifier.findById(userId)
        .select('email userServiceId service -_id')
        .populate<{ service: HydratedDocument<IService> }>('service');

    return {
        email: user.email,
        userServiceId: user.userServiceId,
        serviceName: user.service.name,
    };
};

/**
 * @todo review this method, it seems a little off
 * @author Yanick Kifack
 */
export const formatXml = (xml: string, tab = '\t') => {
    // tab = optional indent value, default is tab (\t)
    let formatted = '',
        indent = '';
    tab = tab || '\t';
    xml.split(/>\s*</).forEach(function (node) {
        if (node.match(/^\/\w/)) indent = indent.substring(tab.length); // decrease indent by one 'tab'
        formatted += indent + '<' + node + '>\r\n';
        if (node.match(/^<?\w[^>]*[^/]$/)) indent += tab; // increase indent
    });
    return formatted.substring(1, formatted.length - 3);
};

/**
 * @todo review this method, it seems a little off
 * @author Yanick Kifack
 */
export const updateUrlParameter = (uri: string, key: string, value: string) => {
    // If hash remove it before operations on the uri
    const i = uri.indexOf('#');
    const hash = i === -1 ? '' : uri.substring(i);
    uri = i === -1 ? uri : uri.substring(0, i);

    const re = new RegExp('([?&])' + key + '=.*?(&|$)', 'i');
    const separator = uri.indexOf('?') !== -1 ? '&' : '?';
    if (uri.match(re)) {
        uri = uri.replace(re, '$1' + key + '=' + value + '$2');
    } else {
        uri = uri + separator + key + '=' + value;
    }
    return uri + hash; // finally append the hash as well
};
