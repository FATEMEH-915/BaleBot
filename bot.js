const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================ تنظیمات اصلی ================
const TOKEN = '1960491677:N1YOKDBmMPox-rlbb6AAgDTEYgCFlLI35Tg';
const API_URL = 'https://tapi.bale.ai/bot';
const BOT_USERNAME = 'MyTestBot';
// ==============================================

console.log('🚀 ربات ارسال فایل‌های درسی - راه‌اندازی...\n');

// ================ مسیر فایل‌های PDF ================
const PDF_FILES = {
    'تفسیر قرآن': './pdf_files/تفسیر قرآن.pdf',
    'نوشتن رزومه': './pdf_files/موارد مهم در نوشتن رزومه.pdf'
};

// ================ توابع کمکی ================

function log(message, type = 'INFO') {
    const timestamp = new Date().toLocaleString('fa-IR');
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    console.log(logMessage);
}

async function sendMessage(chatId, text, options = {}) {
    try {
        const messageData = {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        };
        
        if (options.replyMarkup) {
            messageData.reply_markup = options.replyMarkup;
        }
        
        console.log('📤 ارسال پیام با داده:', JSON.stringify(messageData, null, 2));
        
        const response = await axios.post(`${API_URL}${TOKEN}/sendMessage`, messageData, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.ok) {
            log(`پیام ارسال شد به ${chatId}`, 'SEND');
            console.log('✅ پاسخ API:', JSON.stringify(response.data.result, null, 2));
            return response.data;
        } else {
            log(`خطای API: ${JSON.stringify(response.data)}`, 'ERROR');
        }
        
    } catch (error) {
        log(`خطا در ارسال پیام: ${error.message}`, 'ERROR');
        console.log('❌ جزئیات خطا:', error.response?.data || error.message);
    }
    return null;
}

async function sendPDFFile(chatId, pdfPath, caption = "") {
    try {
        if (!fs.existsSync(pdfPath)) {
            log(`فایل ${pdfPath} پیدا نشد`, 'ERROR');
            await sendMessage(chatId, 
                `❌ فایل مورد نظر یافت نشد.\n\n` +
                `📁 نام فایل: ${path.basename(pdfPath)}\n` +
                `📍 مسیر: ${pdfPath}\n\n` +
                `لطفاً فایل را در پوشه pdf_files قرار دهید.`
            );
            return null;
        }

        log(`ارسال فایل: ${pdfPath}`, 'FILE');
        
        await sendMessage(chatId, `📥 در حال آماده‌سازی فایل "${path.basename(pdfPath)}"...`);
        
        const fileContent = fs.readFileSync(pdfPath);
        
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('document', fileContent, {
            filename: path.basename(pdfPath),
            contentType: 'application/pdf'
        });
        
        form.append('chat_id', chatId);
        if (caption) {
            form.append('caption', caption);
        }
        
        const response = await axios.post(`${API_URL}${TOKEN}/sendDocument`, form, {
            headers: {
                ...form.getHeaders(),
            },
            timeout: 30000
        });

        if (response.data.ok) {
            log(`✅ فایل PDF ارسال شد به ${chatId}`, 'SEND');
            return response.data;
        } else {
            log(`❌ خطا در ارسال فایل: ${JSON.stringify(response.data)}`, 'ERROR');
        }
        
    } catch (error) {
        log(`خطا در ارسال PDF: ${error.message}`, 'ERROR');
        console.log('❌ جزئیات خطای فایل:', error.response?.data || error.message);
        
        await sendMessage(chatId, 
            `📁 نام فایل: ${path.basename(pdfPath)}\n\n` +
            `❌ متأسفانه در ارسال فایل مشکلی پیش آمده.\n\n` +
            `⚠️ ممکن است حجم فایل زیاد باشد یا فرمت آن پشتیبانی نشود.`
        );
    }
    return null;
}

async function getUpdates() {
    try {
        const response = await axios.post(`${API_URL}${TOKEN}/getUpdates`, {
            offset: lastUpdateId + 1,
            timeout: 30,
            limit: 100
        }, {
            timeout: 35000
        });
        
        return response.data;
    } catch (error) {
        log(`خطا در دریافت آپدیت: ${error.message}`, 'ERROR');
        return { ok: false, result: [] };
    }
}

// ================ حالت‌های کاربران ================
const userStates = {};

const UserState = {
    START: 'start',
    MAIN_MENU: 'main_menu',
    SELECT_COURSE: 'select_course'
};

// ================ فقط دکمه‌های شیشه‌ای (Inline Keyboard) ================

// منوی اصلی با دکمه‌های شیشه‌ای
const mainMenuInlineKeyboard = {
    inline_keyboard: [
        [
            {
                text: '📚 دریافت سوالات درسی',
                callback_data: 'get_courses'
            }
        ],
        [
            {
                text: 'ℹ️ درباره ربات',
                callback_data: 'about_bot'
            },
            {
                text: '🆘 راهنما',
                callback_data: 'help_guide'
            }
        ]
    ]
};

// منوی انتخاب درس با دکمه‌های شیشه‌ای
const courseMenuInlineKeyboard = {
    inline_keyboard: [
        [
            {
                text: '📐 ریاضی 1',
                callback_data: 'course_math'
            },
            {
                text: '⚛️ فیزیک 1',
                callback_data: 'course_physics'
            }
        ],
        [
            {
                text: '📖 تفسیر قرآن',
                callback_data: 'course_tafsir'
            },
            {
                text: '📝 نوشتن رزومه',
                callback_data: 'course_resume'
            }
        ],
        [
            {
                text: '🔙 بازگشت به منوی اصلی',
                callback_data: 'back_to_main'
            }
        ]
    ]
};

// ================ توابع پردازش پیام و Callback ================

async function processMessage(message) {
    const chatId = message.chat.id;
    const user = message.from;
    const text = message.text || '';
    
    log(`📩 پیام از ${user.first_name} (${user.id}): "${text}"`, 'RECEIVE');
    
    const currentState = userStates[chatId] || UserState.START;
    
    // ========== دستور /start ==========
    if (text === '/start' || text === `/start@${BOT_USERNAME}`) {
        const welcomeMessage = `
*سلام ${user.first_name} عزیز! 👋*

🎉 به *ربات بانک سوالات درسی* خوش آمدید!

📚 این ربات به شما کمک می‌کند تا به فایل‌های PDF درسی دسترسی داشته باشید

👇 *لطفاً از دکمه‌های زیر انتخاب کنید:*
        `;
        
        userStates[chatId] = UserState.MAIN_MENU;
        await sendMessage(chatId, welcomeMessage, { replyMarkup: mainMenuInlineKeyboard });
        return;
    }
    
    // ========== دستورات عمومی ==========
    if (text === '/help') {
        await sendMessage(chatId,
            `*📋 راهنمای دستورات*\n\n` +
            `*/start* - شروع ربات\n` +
            `*/help* - این راهنما\n` +
            `*/files* - لیست فایل‌ها\n\n` +
            `📞 برای پشتیبانی پیام دهید.`,
            { replyMarkup: mainMenuInlineKeyboard }
        );
        return;
    }
    
    if (text === '/files') {
        let filesList = `*📂 لیست فایل‌ها*\n\n`;
        for (const [name, path] of Object.entries(PDF_FILES)) {
            const exists = fs.existsSync(path) ? '✅' : '❌';
            filesList += `${exists} ${name}\n`;
        }
        await sendMessage(chatId, filesList, { replyMarkup: mainMenuInlineKeyboard });
        return;
    }
    
    // پاسخ پیش‌فرض
    userStates[chatId] = UserState.MAIN_MENU;
    await sendMessage(chatId, 
        "👋 سلام! برای شروع روی /start کلیک کنید.",
        { replyMarkup: mainMenuInlineKeyboard }
    );
}

async function processCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const user = callbackQuery.from;
    const data = callbackQuery.data;
    
    log(`🔘 Callback از ${user.first_name}: ${data}`, 'CALLBACK');
    
    try {
        // پاسخ به Callback
        await axios.post(`${API_URL}${TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackQuery.id
        });
        
        // پردازش بر اساس Callback Data
        switch(data) {
            case 'get_courses':
                const selectMessage = `
*📚 انتخاب درس*

لطفاً درس مورد نظر خود را انتخاب کنید:

📐 *ریاضی 1*
⚛️ *فیزیک 1* 
📖 *تفسیر قرآن*
📝 *نوشتن رزومه* 

👇*یکی را انتخاب کنید:*
                `;
                userStates[chatId] = UserState.SELECT_COURSE;
                await sendMessage(chatId, selectMessage, { replyMarkup: courseMenuInlineKeyboard });
                break;
                
            case 'about_bot':
                await sendMessage(chatId, 
                    `*🤖 درباره ربات*\n\n` +
                    `این ربات برای دسترسی آسان به سوالات و فایل‌های درسی طراحی شده.\n\n` +
                    `*توسعه‌دهنده:*\n` +
                    `*پلتفرم:* پیام‌رسان بله`,
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            case 'help_guide':
                await sendMessage(chatId,
                    `*📖 راهنمای استفاده*\n\n` +
                    `1. روی /start کلیک کنید\n` +
                    `2. "دریافت سوالات درسی" را انتخاب کنید\n` +
                    `3. درس مورد نظر را انتخاب کنید\n` +
                    `4. فایل PDF برای شما ارسال می‌شود\n\n` +
                    `📞 پشتیبانی: @Username`,
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            case 'course_tafsir':
                await sendPDFFile(chatId, PDF_FILES['تفسیر قرآن'],
                    `📖 *تفسیر قرآن*\n\n` +
                    `فایل آموزشی تفسیر قرآن\n` +
                    `درخواست شده توسط: ${user.first_name}\n` +
                    `🕐 ${new Date().toLocaleString('fa-IR')}`
                );
                userStates[chatId] = UserState.MAIN_MENU;
                await sendMessage(chatId, 
                    "✅ فایل تفسیر قرآن ارسال شد.\n\n" +
                    "👇 برای فایل‌های دیگر از منوی زیر انتخاب کنید:",
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            case 'course_resume':
                await sendPDFFile(chatId, PDF_FILES['نوشتن رزومه'],
                    `📝 *نوشتن رزومه*\n\n` +
                    `راهنمای کامل نوشتن رزومه حرفه‌ای\n` +
                    `درخواست شده توسط: ${user.first_name}\n` +
                    `🕐 ${new Date().toLocaleString('fa-IR')}`
                );
                userStates[chatId] = UserState.MAIN_MENU;
                await sendMessage(chatId, 
                    "✅ فایل آموزش رزومه نویسی ارسال شد.\n\n" +
                    "👇 برای فایل‌های دیگر از منوی زیر انتخاب کنید:",
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            case 'course_math':
                await sendMessage(chatId, 
                    "*📐 ریاضی 1*\n\n" +
                    "⏳ به زودی فایل ریاضی 1 اضافه خواهد شد.\n\n" +
                    "*📌 در حال حاضر فایل‌های زیر موجود است:*\n" +
                    "• تفسیر قرآن 📖\n" +
                    "• آموزش رزومه نویسی 📝",
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            case 'course_physics':
                await sendMessage(chatId, 
                    "*⚛️ فیزیک 1*\n\n" +
                    "⏳ به زودی فایل فیزیک 1 اضافه خواهد شد.\n\n" +
                    "*📌 در حال حاضر فایل‌های زیر موجود است:*\n" +
                    "• تفسیر قرآن 📖\n" +
                    "• آموزش رزومه نویسی 📝",
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            case 'back_to_main':
                userStates[chatId] = UserState.MAIN_MENU;
                await sendMessage(chatId, 
                    "🔙 به منوی اصلی بازگشتید.\n\n" +
                    "👇 لطفاً انتخاب کنید:",
                    { replyMarkup: mainMenuInlineKeyboard }
                );
                break;
                
            default:
                userStates[chatId] = UserState.MAIN_MENU;
                await sendMessage(chatId, 
                    "👋 سلام! برای شروع روی /start کلیک کنید.",
                    { replyMarkup: mainMenuInlineKeyboard }
                );
        }
        
    } catch (error) {
        log(`خطا در پردازش Callback: ${error.message}`, 'ERROR');
    }
}

// ================ متغیرهای اصلی ================
let lastUpdateId = 0;

// ================ تابع بررسی فایل‌ها ================
function checkPDFFiles() {
    console.log('\n🔍 بررسی فایل‌های PDF...');
    console.log('='.repeat(50));
    
    for (const [fileName, filePath] of Object.entries(PDF_FILES)) {
        const exists = fs.existsSync(filePath);
        const status = exists ? '✅ موجود' : '❌ یافت نشد';
        console.log(`${fileName.padEnd(20)}: ${status}`);
    }
    
    console.log('='.repeat(50));
}

// ================ تابع اصلی polling ================
async function startPolling() {
    log('✅ شروع دریافت پیام‌ها...', 'SYSTEM');
    
    while (true) {
        try {
            const updates = await getUpdates();
            
            if (updates.ok && updates.result.length > 0) {
                for (const update of updates.result) {
                    lastUpdateId = update.update_id;
                    
                    if (update.message && update.message.text) {
                        await processMessage(update.message);
                    }
                    
                    if (update.callback_query) {
                        await processCallbackQuery(update.callback_query);
                    }
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            log(`خطا در polling: ${error.message}`, 'ERROR');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// ================ تابع تست اتصال ================
async function testConnection() {
    log('🔍 تست اتصال به API...', 'SYSTEM');
    
    try {
        const response = await axios.get(`${API_URL}${TOKEN}/getMe`, {
            timeout: 10000
        });
        
        if (response.data.ok) {
            const bot = response.data.result;
            log(`✅ ربات: ${bot.first_name} (@${bot.username})`, 'SYSTEM');
            return true;
        }
    } catch (error) {
        log(`❌ خطا: ${error.message}`, 'ERROR');
    }
    return false;
}

// ================ تابع اصلی ================
async function main() {
    console.log('='.repeat(50));
    console.log('🤖 ربات آموزشی Bale');
    console.log(`🔗 @${BOT_USERNAME}`);
    console.log('='.repeat(50) + '\n');
    
    // بررسی فایل‌ها
    checkPDFFiles();
    
    // تست اتصال
    const connected = await testConnection();
    
    if (connected) {
        console.log('\n🎯 ربات آماده است!');
        console.log('📱 در بله جستجو کنید:');
        console.log(`   @${BOT_USERNAME}`);
        console.log('\n📂 فایل‌های موجود:');
        Object.keys(PDF_FILES).forEach(file => {
            const exists = fs.existsSync(PDF_FILES[file]) ? '✅' : '❌';
            console.log(`   ${exists} ${file}`);
        });
        console.log('\n✨ دکمه‌های شیشه‌ای فعال شدند');
        console.log('\n⏹️  برای توقف: Ctrl + C\n');
        
        // شروع ربات
        await startPolling();
    } else {
        console.log('\n❌ نتوانست به API متصل شود.');
        console.log('💡 بررسی کنید:');
        console.log('   1. توکن ربات درست است؟');
        console.log('   2. اینترنت وصل است؟');
        console.log('   3. ربات در @BotFather فعال است؟');
    }
}

// ================ مدیریت خروج ================
process.on('SIGINT', () => {
    console.log('\n\n🛑 در حال توقف ربات...');
    console.log('👋 خدانگهدار!\n');
    process.exit(0);
});

// ================ اجرای برنامه ================
main().catch(error => {
    log(`خطای غیرمنتظره: ${error.message}`, 'FATAL');
    console.error('🔥 خطا:', error);
    process.exit(1);
});