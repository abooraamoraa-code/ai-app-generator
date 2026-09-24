export function healthCheckRoute(req, res) {
    const healthData = {
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        environment: 'Enterprise Production'
    };
    res.status(200).json(healthData);
}     
