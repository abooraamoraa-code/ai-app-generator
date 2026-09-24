import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// استيراد وحدات النظام الـ 10 الاحترافية التي أنشأناها
import { firewallMiddleware } from './security-firewall.js';
import { cacheMiddleware } from './cache-engine.js';
import { getCompressionConfig } from './compression-config.js';
import { cleanAndValidateAIResponse } from './ai-validator.js';
import { sanitizeRepoName } from './sanitizer.js';
import { globalErrorHandler } from './error-handler.js';
import { healthCheckRoute } from './health-check.js';
import { logAction } from './logger-service.js';
import { SYSTEM_CONFIG } from './config.js';

dotenv.config();

const app = express();

// 1. تفعيل ضغط البيانات والسرعة العالية
app.use(getCompressionConfig());

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. تفعيل جدار الحماية الأمني
app.use(firewallMiddleware);

// 3. نظام الحد من الطلبات (Rate Limiting) بناءً على إعدادات النظام
const limiter = rateLimit({
    windowMs: SYSTEM_CONFIG.windowMsTime,
    max: SYSTEM_CONFIG.maxRequestLimit,
    message: { error: 'لقد تجاوزت الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.' }
});
app.use('/generate-and-deploy', limiter);

// التحقق من مفاتيح البيئة الأساسية
if (!process.env.GEMINI_API_KEY || !process.env.GITHUB_TOKEN) {
    console.error('خطأ فادح: مفاتيح البيئة الأساسية غير متوفرة!');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// 4. مسار فحص صحة النظام (Health Check Route)
app.get('/health', healthCheckRoute);

// 5. قراءة صفحات الواجهة الثابتة بأمان مع تفعيل الذاكرة المؤقتة لزيادة السرعة
app.use(express.static(__dirname, {
    index: ['index.html'],
    dotfiles: 'ignore',
    filter: (filePath) => {
        if (filePath.endsWith('.env') || filePath.endsWith('package.json') || filePath.endsWith('server.js') || filePath.endsWith('.js')) {
            return false;
        }
        return true;
    }
}));

// 6. المحرك الرئيسي لتوليد التطبيقات ورفعها للإنتاج (مدعوم بالمدققات والمعالجات)
app.post('/generate-and-deploy', async (req, res, next) => {
    try {
        const { prompt, repoName } = req.body;
        
        if (!prompt || !repoName) {
            return res.status(400).json({ error: 'الرجاء إدخال وصف التطبيق واسم المستودع المطلوب.' });
        }

        // استخدام معالج ومصفي الأسماء
        const sanitizedRepoName = sanitizeRepoName(repoName);

        logAction('generation_start', `بدء توليد التطبيق للمستودع: ${sanitizedRepoName}`);

        const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `أنت مطور برمجيات محترف. بناءً على طلب المستخدم: "${prompt}".
            قم بإنشاء هيكل ملفات متكامل للتطبيق (مثل index.html, style.css, script.js وغيرها).
            يجب أن يكون ردك بصيغة كائن JSON خالص فقط بدون أي نص إضافي، بحيث يكون المفتاح هو اسم الملف والقيمة هي الكود البرمجي الكامل.`
        });

        // استخدام المدقق المركزي لتنظيف وفحص مخرجات الـ AI
        const filesData = cleanAndValidateAIResponse(aiResponse.text);

        const { data: user } = await octokit.rest.users.getAuthenticated();
        const owner = user.login;

        logAction('github_create', `إنشاء المستودع على جيت هاب: ${sanitizedRepoName}`);

        await octokit.rest.repos.createForAuthenticatedUser({
            name: sanitizedRepoName,
            description: `تم التطوير عبر ${SYSTEM_CONFIG.appName} - إدارة وتطوير أبو حازم العمري`,
            auto_init: true
        });

        for (const [filename, content] of Object.entries(filesData)) {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo: sanitizedRepoName,
                path: filename,
                message: `إضافة هيكل ملف ${filename} بواسطة محرك الذكاء الاصطناعي`,
                content: Buffer.from(content).toString('base64'),
            });
        }

        logAction('success', `تم نشر التطبيق بنجاح تام للمستودع: ${sanitizedRepoName}`);

        res.status(200).json({ 
            success: true, 
            message: 'تم بناء التطبيق ورفع ملفاته إلى جيت هاب بنجاح احترافي تام!',
            repoUrl: `https://github.com/${owner}/${sanitizedRepoName}`
        });

    } catch (error) {
        next(error); // توجيه الخطأ لمعالج الأخطاء المركزي
    }
});

// 7. تفعيل معالج الأخطاء المركزي النهائي
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[${SYSTEM_CONFIG.appName}] يعمل بكفاءة تامة وأمان مطلق على المنفذ ${PORT} - ${SYSTEM_CONFIG.manager}`);
});
