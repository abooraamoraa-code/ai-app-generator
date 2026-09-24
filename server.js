import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app.use(express.json());

// 1. نظام حماية السيرفر المتقدم (Rate Limiting) بمستوى الشركات الكبرى
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 50, // أقصى عدد طلبات مسموح به لكل آيباد/مستخدم
    message: { error: 'لقد تجاوزت الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.' }
});
app.use('/generate-and-deploy', limiter);

// التحقق من وجود المفاتيح الحقيقية عند الإقلاع
if (!process.env.GEMINI_API_KEY || !process.env.GITHUB_TOKEN) {
    console.error('خطأ فادح: مفاتيح البيئة الأساسية غير متوفرة!');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// 2. المحرك الرئيسي لتوليد التطبيقات ورفعها للإنتاج
app.post('/generate-and-deploy', async (req, res) => {
    try {
        const { prompt, repoName } = req.body;
        
        if (!prompt || !repoName) {
            return res.status(400).json({ error: 'الرجاء إدخال وصف التطبيق واسم المستودع المطلوب.' });
        }

        // تنظيف اسم المستودع ليكون صالحاً برمجياً
        const sanitizedRepoName = repoName.trim().toLowerCase().replace(/\s+/g, '-');

        console.log(`[AI Engine] جاري توليد التطبيق للطلب: "${prompt}"...`);

        // طلب التوليد من نموذج Gemini مع إجبار المخرج على صيغة JSON حقيقية نظيفة
        const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `أنت مطور برمجيات محترف ومختص ببناء تطبيقات الويب. بناءً على طلب المستخدم التالي: "${prompt}".
            قم بإنشاء هيكل ملفات متكامل للتطبيق (مثل index.html, style.css, script.js وغيرها حسب الحاجة).
            يجب أن يكون ردك بصيغة كائن JSON خالص فقط دون أي نص إضافي خارجه، بحيث يكون المفتاح هو اسم الملف والقيمة هي الكود البرمجي الكامل غير المختصر.`
        });

        let rawText = aiResponse.text.trim();
        // تنظيف مخرجات الذكاء الاصطناعي لضمان قراءة JSON سليمة 100%
        if (rawText.startsWith('```json')) {
            rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const filesData = JSON.parse(rawText);

        // جلب معلومات المستخدم على جيت هاب
        const { data: user } = await octokit.rest.users.getAuthenticated();
        const owner = user.login;

        console.log(`[GitHub API] جاري إنتاج المستودع: ${sanitizedRepoName}...`);

        // إنشاء المستودع الجديد
        await octokit.rest.repos.createForAuthenticatedUser({
            name: sanitizedRepoName,
            description: 'تم تطويره وإنشاؤه تلقائياً عبر منصة أبو حازم العمري الذكية',
            auto_init: true
        });

        // رفع الملفات دفعة واحدة للمستودع
        for (const [filename, content] of Object.entries(filesData)) {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo: sanitizedRepoName,
                path: filename,
                message: `إضافة هيكل ملف ${filename} بواسطة محرك الذكاء الاصطناعي`,
                content: Buffer.from(content).toString('base64'),
            });
        }

        console.log(`[Success] تمت العملية بنجاح تام وتم النشر على جيت هاب!`);

        res.status(200).json({ 
            success: true, 
            message: 'تم بناء التطبيق ورفع ملفاته إلى جيت هاب بنجاح احترافي تام!',
            repoUrl: `https://github.com/${owner}/${sanitizedRepoName}`
        });

    } catch (error) {
        console.error('[Error Details]:', error);
        res.status(500).json({ 
            error: 'فشلت عملية التوليد أو النشر.', 
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم الاحترافي يعمل بكفاءة تامة على المنفذ ${PORT}`);
});
