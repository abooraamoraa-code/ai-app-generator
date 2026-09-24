export function sanitizeRepoName(name) {
    if (!name) return 'default-app';
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-') // استبدال الرموز الخاصة بشرطة
        .replace(/-+/g, '-');        // دمج الشرطات المتعددة
}
