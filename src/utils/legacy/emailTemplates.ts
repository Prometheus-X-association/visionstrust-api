export function getEmailTemplate(
    link: string,
    fromService: string,
    toService: string
) {
    const template = `
  <!DOCTYPE html>
<html>

<head>
    <title></title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <style type="text/css">
        @media screen {
            @font-face {
                font-family: 'Lato';
                font-style: normal;
                font-weight: 400;
                src: local('Lato Regular'), local('Lato-Regular'), url(https://fonts.gstatic.com/s/lato/v11/qIIYRU-oROkIk8vfvxw6QvesZW2xOQ-xsNqO47m55DA.woff) format('woff');
            }

            @font-face {
                font-family: 'Lato';
                font-style: normal;
                font-weight: 700;
                src: local('Lato Bold'), local('Lato-Bold'), url(https://fonts.gstatic.com/s/lato/v11/qdgUG4U09HnJwhYI-uK18wLUuEpTyoUstqEm5AMlJo4.woff) format('woff');
            }

            @font-face {
                font-family: 'Lato';
                font-style: italic;
                font-weight: 400;
                src: local('Lato Italic'), local('Lato-Italic'), url(https://fonts.gstatic.com/s/lato/v11/RYyZNoeFgb0l7W3Vu1aSWOvvDin1pK8aKteLpeZ5c0A.woff) format('woff');
            }

            @font-face {
                font-family: 'Lato';
                font-style: italic;
                font-weight: 700;
                src: local('Lato Bold Italic'), local('Lato-BoldItalic'), url(https://fonts.gstatic.com/s/lato/v11/HkF_qI1x_noxlxhrhMQYELO3LdcAZYWl9Si6vvxL-qU.woff) format('woff');
            }
        }

        /* CLIENT-SPECIFIC STYLES */
        body,
        table,
        td,
        a {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table,
        td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            -ms-interpolation-mode: bicubic;
        }

        /* RESET STYLES */
        img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }

        table {
            border-collapse: collapse !important;
        }

        body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
        }

        /* iOS BLUE LINKS */
        a[x-apple-data-detectors] {
            color: inherit !important;
            text-decoration: none !important;
            font-size: inherit !important;
            font-family: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
        }

        /* MOBILE STYLES */
        @media screen and (max-width:600px) {
            h1 {
                font-size: 32px !important;
                line-height: 32px !important;
            }
        }

        /* ANDROID CENTER FIX */
        div[style*="margin: 16px 0;"] {
            margin: 0 !important;
        }
    </style>
</head>

<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">
    <!-- HIDDEN PREHEADER TEXT -->
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: 'Lato', Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;"> Nous sommes ravis de vous avoir ici!  </div>
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <!-- LOGO -->
        <tr>
            <td bgcolor="#ffc107" align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td align="center" valign="top" style="padding: 40px 10px 40px 10px;"> </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td bgcolor="#ffc107" align="center" style="padding: 0px 10px 0px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td bgcolor="#ffffff" align="center" valign="top" style="padding: 40px 20px 20px 20px; border-radius: 4px 4px 0px 0px; color: #111111; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 48px; font-weight: 400; letter-spacing: 4px; line-height: 48px;">
                            <h1 style="font-size: 48px; font-weight: 500; margin: 2;">Bienvenue Chez <strong style="color: #ffd700;font-size: 50px;">VISIONS</strong></h1> 
                            <div ><?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg  width="125" height="120" viewBox="0 0 44 37" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><g id="Visions-logo" serif:id="Visions logo"><path d="M21.486,21.132l-8.418,-16.042l16.836,-0l-8.418,16.042Z" style="fill:#e5f3f5;"/><path d="M21.542,36.13l-0.056,-0.103l0.114,-0.002l-0.058,0.105Zm2.361,-4.311l-4.721,-0l-17.424,-31.819l39.569,0l-17.424,31.819Zm-8.66,-23.829l6.299,11.504l6.3,-11.504l-12.599,0Z" style="fill:#e5f3f5;"/><path d="M13.068,5.09l16.836,-0l1.402,-2.346l-19.396,-0l1.158,2.346Z" style="fill:#123657;"/><g id="TEXT"><path d="M7.672,10.48l-3.039,7.358l-1.604,0l-3.029,-7.358l1.755,-0l2.136,5.256l2.167,-5.256l1.614,-0Z" style="fill:#143556;fill-rule:nonzero;"/><rect x="8.254" y="10.48" width="1.625" height="7.359" style="fill:#143556;fill-rule:nonzero;"/><path d="M13.85,17.965c-0.555,-0 -1.091,-0.079 -1.61,-0.237c-0.518,-0.158 -0.934,-0.363 -1.248,-0.615l0.551,-1.282c0.301,0.231 0.659,0.417 1.074,0.557c0.414,0.14 0.829,0.21 1.243,0.21c0.461,0 0.802,-0.072 1.023,-0.215c0.221,-0.144 0.331,-0.335 0.331,-0.573c0,-0.176 -0.065,-0.321 -0.196,-0.437c-0.13,-0.115 -0.297,-0.208 -0.501,-0.278c-0.204,-0.07 -0.48,-0.147 -0.827,-0.232c-0.535,-0.133 -0.973,-0.266 -1.314,-0.399c-0.341,-0.133 -0.634,-0.347 -0.878,-0.641c-0.244,-0.295 -0.366,-0.687 -0.366,-1.178c0,-0.427 0.111,-0.814 0.331,-1.161c0.221,-0.347 0.553,-0.622 0.998,-0.826c0.445,-0.203 0.988,-0.304 1.63,-0.304c0.448,-0 0.886,0.056 1.314,0.168c0.427,0.112 0.802,0.273 1.123,0.483l-0.502,1.293c-0.648,-0.385 -1.297,-0.578 -1.945,-0.578c-0.455,0 -0.791,0.077 -1.008,0.231c-0.217,0.155 -0.326,0.358 -0.326,0.61c-0,0.253 0.125,0.44 0.376,0.563c0.251,0.122 0.633,0.243 1.148,0.362c0.535,0.133 0.973,0.267 1.314,0.4c0.341,0.133 0.634,0.343 0.878,0.631c0.244,0.287 0.366,0.676 0.366,1.166c-0,0.421 -0.112,0.805 -0.336,1.152c-0.224,0.346 -0.56,0.622 -1.008,0.825c-0.448,0.203 -0.993,0.305 -1.635,0.305Z" style="fill:#143556;fill-rule:nonzero;"/><rect x="17.942" y="10.48" width="1.625" height="7.359" style="fill:#143556;fill-rule:nonzero;"/><path d="M24.631,17.965c-0.728,-0 -1.385,-0.165 -1.97,-0.494c-0.585,-0.33 -1.043,-0.784 -1.374,-1.362c-0.331,-0.578 -0.497,-1.228 -0.497,-1.95c0,-0.722 0.166,-1.372 0.497,-1.95c0.331,-0.578 0.789,-1.032 1.374,-1.361c0.585,-0.33 1.242,-0.494 1.97,-0.494c0.729,-0 1.384,0.164 1.966,0.494c0.582,0.329 1.04,0.783 1.374,1.361c0.334,0.578 0.501,1.228 0.501,1.95c0,0.722 -0.167,1.372 -0.501,1.95c-0.334,0.578 -0.792,1.032 -1.374,1.362c-0.582,0.329 -1.237,0.494 -1.966,0.494Zm0,-1.451c0.415,-0 0.789,-0.1 1.124,-0.3c0.334,-0.199 0.596,-0.478 0.787,-0.835c0.19,-0.358 0.286,-0.764 0.286,-1.22c-0,-0.455 -0.096,-0.862 -0.286,-1.219c-0.191,-0.358 -0.453,-0.636 -0.787,-0.836c-0.335,-0.2 -0.709,-0.3 -1.124,-0.3c-0.414,0 -0.789,0.1 -1.123,0.3c-0.334,0.2 -0.597,0.478 -0.787,0.836c-0.191,0.357 -0.286,0.764 -0.286,1.219c-0,0.456 0.095,0.862 0.286,1.22c0.19,0.357 0.453,0.636 0.787,0.835c0.334,0.2 0.709,0.3 1.123,0.3Z" style="fill:#143556;fill-rule:nonzero;"/><path d="M36.135,10.48l-0,7.358l-1.334,0l-3.5,-4.467l-0,4.467l-1.605,0l-0,-7.358l1.344,-0l3.49,4.468l-0,-4.468l1.605,-0Z" style="fill:#143556;fill-rule:nonzero;"/><path d="M40.106,17.965c-0.555,-0 -1.091,-0.079 -1.61,-0.237c-0.518,-0.158 -0.934,-0.363 -1.248,-0.615l0.551,-1.282c0.301,0.231 0.659,0.417 1.074,0.557c0.414,0.14 0.829,0.21 1.243,0.21c0.461,0 0.802,-0.072 1.023,-0.215c0.221,-0.144 0.331,-0.335 0.331,-0.573c0,-0.176 -0.065,-0.321 -0.196,-0.437c-0.13,-0.115 -0.297,-0.208 -0.501,-0.278c-0.204,-0.07 -0.48,-0.147 -0.827,-0.232c-0.535,-0.133 -0.973,-0.266 -1.314,-0.399c-0.341,-0.133 -0.634,-0.347 -0.878,-0.641c-0.244,-0.295 -0.366,-0.687 -0.366,-1.178c0,-0.427 0.111,-0.814 0.331,-1.161c0.221,-0.347 0.553,-0.622 0.998,-0.826c0.445,-0.203 0.988,-0.304 1.63,-0.304c0.448,-0 0.886,0.056 1.314,0.168c0.427,0.112 0.802,0.273 1.123,0.483l-0.502,1.293c-0.648,-0.385 -1.297,-0.578 -1.945,-0.578c-0.455,0 -0.791,0.077 -1.008,0.231c-0.217,0.155 -0.326,0.358 -0.326,0.61c-0,0.253 0.125,0.44 0.376,0.563c0.251,0.122 0.633,0.243 1.148,0.362c0.535,0.133 0.973,0.267 1.314,0.4c0.341,0.133 0.634,0.343 0.878,0.631c0.244,0.287 0.366,0.676 0.366,1.166c-0,0.421 -0.112,0.805 -0.336,1.152c-0.224,0.346 -0.56,0.622 -1.008,0.825c-0.448,0.203 -0.993,0.305 -1.635,0.305Z" style="fill:#143556;fill-rule:nonzero;"/></g></g></svg></div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td bgcolor="#f4f4f4" align="center" style="padding: 0px 10px 0px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td bgcolor="#ffffff" align="left" style="padding: 20px 30px 40px 30px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
                            <p style="margin: 0;font-size:18px;letter-spacing:1px;">Nous sommes ravis de votre premier echange de données. Tout d'abord, vous devez confirmer votre compte chez <strong style="color: #ffd700;font-size: 20px;">${fromService}</strong> afin d'effectuer l'échange de données avec <strong style="color: #ffd700;font-size: 20px;">${toService}</strong>. Appuyez simplement sur le bouton ci-dessous.</p>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" align="left">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td bgcolor="#ffffff" align="center" style="padding: 20px 30px 60px 30px;">
                                        <table border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="center" style="border-radius: 3px;" bgcolor="#ffd700"><a href="${link}" target="_blank" style="font-size: 20px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; color: #ffffff; text-decoration: none; padding: 15px 25px; border-radius: 10px; border: 1px solid #ffd700; display: inline-block;">Je confirme mon compte </a></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr> <!-- COPY -->
                    <tr>
                        <td bgcolor="#ffffff" align="left" style="padding: 0px 30px 0px 30px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
                            <p style="margin: 0;">Si cela ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur:</p>
                        </td>
                    </tr> <!-- COPY -->
                    <tr>
                        <td bgcolor="#ffffff" align="left" style="padding: 20px 30px 20px 30px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
                            <p style="margin: 0;"><a href="#" target="_blank" style="color: #ffd700;">${link}</a></p>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" align="left" style="padding: 0px 30px 20px 30px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
                            <p style="margin: 0;">
                                Si vous avez des questions,  nous sommes toujours ravis de vous aider.</p>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" align="left" style="padding: 0px 30px 40px 30px; border-radius: 0px 0px 4px 4px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
                            <p style="margin: 0;">Bien à vous,<br>L'equipe Visions</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td bgcolor="#f4f4f4" align="center" style="padding: 30px 10px 0px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td bgcolor="#FFECD1" align="center" style="padding: 30px 30px 30px 30px; border-radius: 4px 4px 4px 4px; color: #666666; font-family: 'Lato', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 400; line-height: 25px;">
                            <h2 style="font-size: 20px; font-weight: 400; color: #111111; margin: 0;">Besoin d'aide ?</h2>
                            <p style="margin: 0;"><a href="https://visionstrust.com/" target="_blank" style="color: #ffd700;">Nous sommes la</a></p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        
    </table>
</body>

</html>
  `;

    return template;
}
