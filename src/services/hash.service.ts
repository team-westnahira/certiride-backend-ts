import crypto from 'crypto';

export const getDocumentHash = (invoiceData: any): string => {
    const cleanJson = JSON.stringify(invoiceData);
    return crypto.createHash('sha256').update(cleanJson).digest('hex');
}



