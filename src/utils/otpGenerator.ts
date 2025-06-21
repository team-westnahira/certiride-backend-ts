import crypto from 'crypto';

export const generateOtp = (length: number = 6): string => {
    let otp = '';

    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10);
    }

    return otp;
}


export const generateSecureOtp = (length: number = 6): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let otp = '';
    const bytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
        const randomIndex = bytes[i] % characters.length;
        otp += characters[randomIndex];
    }

    return otp;
};