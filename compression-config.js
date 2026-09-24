import compression from 'compression';

export function getCompressionConfig() {
    return compression({
        level: 6, // مستوى ضغط متوازن بين السرعة وحجم البيانات
        threshold: 1024 // ضغط الملفات أكبر من 1 كيلو بايت فقط
    });
}
