export function firewallMiddleware(req, res, next) {
    const userAgent = req.headers['user-agent'] || '';
    // حظر الروبوتات الوهمية أو محاولات الاختراق المعروفة
    if (userAgent.includes('sqlmap') || userAgent.includes('nikto') || userAgent === '') {
        return res.status(403).json({ error: 'تم حظر الطلب لأسباب تتعلق بأمان المنصة.' });
    }
    next();
}
