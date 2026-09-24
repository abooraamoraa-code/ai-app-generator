import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// تهيئة محرك الذكاء الاصطناعي ومكتبة جيت هاب بالمفاتيح الحقيقية
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// نقطة النهاية (API) لتوليد التطبيق ورفعه مباشرة لجيت هاب
app.post('/generate-and-deploy', async (req, res) => {
    try {
        const { prompt, repoName } = req.body;
        
        if (!prompt || !repoName) {
            return res.status(400).json({ error: 'الرجاء إدخال وصف التطبيق ونام المستودع.' });
        }

        // 1. طلب توليد الملفات من الذكاء الاصطناعي بصيغة منظمة JSON
        const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `قم بتوليد تطبيق وبناء ملفات ويب كاملة بناءً على الطلب التالي: "${prompt}". 
            يجب أن يكون الرد عبارة عن كائن JSON فقط بدون أي نص إضافي، بحيث يحتوي على مفاتيح تمثل أسماء الملفات (مثل index.html, style.css, script.js) وقيمها هي محتوى الكود البرمجي لكل ملف.`
        });

        const filesData = JSON.parse(aiResponse.text);

        // 2. الحصول على اسم المستخدم الحالي في جيت هاب
        const { data: user } = await octokit.rest.users.getAuthenticated();
        const owner = user.login;

        // 3. إنشاء مستودع جديد على جيت هاب تلقائياً
        await octokit.rest.repos.createForAuthenticatedUser({
            name: repoName,
            description: 'تم إنشاؤه تلقائياً بواسطة منصة الذكاء الاصطناعي لـ أبو حازم العمري',
            auto_init: true
        });

        // 4. رفع الملفات المولدة إلى المستودع الجديد
        for (const [filename, content] of Object.entries(filesData)) {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo: repoName,
                path: filename,
                message: `إضافة ${filename} بواسطة الذكاء الاصطناعي`,
                content: Buffer.from(content).toString('base64'),
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'تم إنشاء التطبيق ورفعه إلى جيت هاب بنجاح!',
            repoUrl: `https://github.com/${owner}/${repoName}`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء المعالجة أو الرفع.', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم يعمل بنجاح على المنفذ ${PORT}`);
});
