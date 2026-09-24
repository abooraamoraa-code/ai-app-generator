export function cleanAndValidateAIResponse(rawText) {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
            throw new Error('الهيكل البرمجي الناتج فارغ أو غير صالح.');
        }
        return parsed;
    } catch (e) {
        throw new Error('فشل تحليل مخرجات الذكاء الاصطناعي كـ JSON سليم: ' + e.message);
    }
}
