import crypto from 'crypto';

export function verifySignature(req, secretKey) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', secretKey);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
