

export const resetPasswordTemplate = (otp:string):string => {
    return `
        <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>Reset Your Password</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #0D1321; font-family: Arial, sans-serif; color: #ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: auto;">
                <tr>
                    <td style="padding: 40px 20px; text-align: center;">
                    <h2 style="color: #3B82F6;">CertiRide</h2>
                    <div style="background-color: #1F2937; border-radius: 10px; padding: 30px; text-align: left;">
                        <h3 style="margin-top: 0;">Reset Your Password</h3>
                        <p>Hi there,</p>
                        <p>We received a request to reset your password. Use the OTP below to complete the process. This code will expire in 1 hour.</p>
                        
                        <div style="text-align: center; margin: 20px 0;">
                        <span style="display: inline-block; background-color: #3B82F6; color: #ffffff; font-size: 24px; padding: 12px 24px; border-radius: 8px; letter-spacing: 2px;">
                            ${otp}
                        </span>
                        </div>

                        <p>If you didn’t request a password reset, you can safely ignore this email.</p>
                        <p style="margin-bottom: 0;">Thanks,<br />The CertiRide Team</p>
                    </div>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px; text-align: center; font-size: 12px; color: #aaa;">
                    © 2025 CertiRide. All rights reserved.
                    </td>
                </tr>
                </table>
            </body>
        </html>
    `
}