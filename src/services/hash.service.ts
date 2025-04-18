import crypto from 'crypto';

export const getDocumentHash = (invoiceData: string): string => {
    return crypto.createHash('sha256').update(invoiceData).digest('hex');
}



