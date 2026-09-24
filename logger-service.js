export function logAction(actionType, details) {
    const timestamp = new Date().toISOString();
    console.log(`[LOG ${timestamp}] [${actionType.toUpperCase()}] -> ${details}`);
}
