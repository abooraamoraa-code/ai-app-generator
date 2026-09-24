import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. نظام حماية السيرفر المتقدم (Rate Limiting)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 50,
    message: { error: 'لقد تجاوزت الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.' }
});
app.use('/generate-and-deploy', limiter);

// التحقق من المفاتيح
if (!process.env.GEMINI_API_KEY || !process.env.GITHUB_TOKEN) {
    console.error('خطأ فادح: مفاتيح البيئة الأساسية غير متوفرة!');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// 2. تفعيل قراءة صفحات الواجهة الثابتة بأمان تام من الجذر
app.use(express.static(__dirname, {
    index: ['index.html'],
    // منع المستخدمين من قراءة الملفات الحساسة مثل .env أو package.json لأسباب أمنية
    dotfiles: 'ignore',
    filter: (filePath) => {
        if (filePath.endsWith('.env') || filePath.endsWith('package.json') || filePath.endsWith('server.js')) {
            return false;
        }
        return true;
    }
}));

// 3. المحرك الرئيسي لتوليد التطبيقات ورفعها للإنتاج
app.post('/generate-and-deploy', async (req, res) => {
    try {
        const { prompt, repoName } = req.body;
        
        if (!prompt || !repoName) {
            return res.status(400).json({ error: 'الرجاء إدخال وصف التطبيق واسم المستودع المطلوب.' });
        }

        const sanitizedRepoName = repoName.trim().toLowerCase().replace(/\s+/g, '-');

        console.log(`[AI Engine] جاري توليد التطبيق للطلب: "${prompt}"...`);

        const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `أنت مطور برمجيات محترف. بناءً على طلب المستخدم: "${prompt}".
            قم بإنشاء هيكل ملفات متكامل للتطبيق (مثل index.html, style.css, script.js وغيرها).
            يجب أن يكون ردك بصيغة كائن JSON خالص فقط بدون أي نص إضافي، بحيث يكون المفتاح هو اسم الملف والقيمة هي الكود البرمجي الكامل.`
        });

        let rawText = aiResponse.text.trim();
        if (rawText.startsWith('```json')) {
            rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const filesData = JSON.parse(rawText);

        const { data: user } = await octokit.rest.users.getAuthenticated();
        const owner = user.login;

        console.log(`[GitHub API] جاري إنتاج المستودع: ${sanitizedRepoName}...`);

        await octokit.rest.repos.createForAuthenticatedUser({
            name: sanitizedRepoName,
            description: 'تم تطويره وإنشاؤه تلقائياً عبر منصة أبو حازم العمري الذكية',
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
