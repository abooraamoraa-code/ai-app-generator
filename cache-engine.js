const memoryCache = new Map();

export const cacheMiddleware = (durationInSeconds) => {
    return (req, res, next) => {
        const key = req.originalUrl || req.url;
        const cachedResponse = memoryCache.get(key);
        if (cachedResponse) {
            return res.json(cachedResponse);
        }
        res.sendResponse = res.json;
        res.json = (body) => {
            memoryCache.set(key, body);
            setTimeout(() => memoryCache.delete(key), durationInSeconds * 1000);
            res.sendResponse(body);
        };
        next();
    };
};
