const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================ تنظیمات اصلی ================
const TOKEN = '1960491677:N1YOKDBmMPox-rlbb6AAgDTEYgCFlLI35Tg';
const API_URL = 'https://tapi.bale.ai/bot';
const BOT_USERNAME = 'MyTestBot';
// ================ تنظیمات ادمین ================
const ADMIN_ID = '829971148'; 
// ==============================================

console.log('🚀 ربات ارسال فایل‌های درسی - راه‌اندازی...\n');

// ================ مسیر فایل‌های PDF ================
const PDF_FILES = {
    'تفسیر قرآن': './pdf_files/تفسیر قرآن.pdf',
    'نوشتن رزومه': './pdf_files/موارد مهم در نوشتن رزومه.pdf'
};

// ================ مسیر فایل‌های آپلود شده ================
const UPLOADED_FILES_FILE = './uploaded_files.json';
const PDF_FILES_DIR = './pdf_files';

// ================ توابع کمکی ================

function log(message, type = 'INFO') {
    const timestamp = new Date().toLocaleString('fa-IR');
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    console.log(logMessage);
}

// تابع بررسی ادمین بودن
function isAdmin(userId) {
    return userId.toString() === ADMIN_ID.toString();
}

// ایجاد پوشه pdf_files اگر وجود ندارد
function ensurePdfFilesDir() {
    if (!fs.existsSync(PDF_FILES_DIR)) {
        fs.mkdirSync(PDF_FILES_DIR, { recursive: true });
        log(`پوشه ${PDF_FILES_DIR} ایجاد شد`, 'SYSTEM');
    }
}

// خواندن فایل‌های آپلود شده
function readUploadedFiles() {
    try {
        if (fs.existsSync(UPLOADED_FILES_FILE)) {
            const data = fs.readFileSync(UPLOADED_FILES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`خطا در خواندن فایل آپلود شده: ${error.message}`, 'ERROR');
    }
    return {};
}

// ذخیره فایل آپلود شده
function saveUploadedFile(courseName, fileName) {
    try {
        let uploadedFiles = readUploadedFiles();
        uploadedFiles[courseName] = fileName;
        fs.writeFileSync(UPLOADED_FILES_FILE, JSON.stringify(uploadedFiles, null, 2), 'utf8');
        log(`فایل آپلود شده ذخیره شد: ${courseName} => ${fileName}`, 'UPLOAD');
        return true;
    } catch (error) {
        log(`خطا در ذخیره فایل آپلود شده: ${error.message}`, 'ERROR');
        return false;
    }
}

// دریافت لیست همه فایل‌ها (اصلی + آپلود شده)
function getAllFiles() {
    const uploadedFiles = readUploadedFiles();
    const allFiles = { ...PDF_FILES };
    
    // اضافه کردن فایل‌های آپلود شده به مسیر pdf_files
    Object.keys(uploadedFiles).forEach(courseName => {
        allFiles[courseName] = path.join(PDF_FILES_DIR, uploadedFiles[courseName]);
    });
    
    return allFiles;
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
        
        const response = await axios.post(`${API_URL}${TOKEN}/sendMessage`, messageData, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.ok) {
            log(`پیام ارسال شد به ${chatId}`, 'SEND');
            return response.data;
        } else {
            log(`خطای API: ${JSON.stringify(response.data)}`, 'ERROR');
        }
        
    } catch (error) {
        log(`خطا در ارسال پیام: ${error.message}`, 'ERROR');
    }
    return null;
}

async function sendPDFFile(chatId, pdfPath, caption = "") {
    try {
        if (!fs.existsSync(pdfPath)) {
            log(`فایل ${pdfPath} پیدا نشد`, 'ERROR');
            await sendMessage(chatId, 
                `❌ فایل مورد نظر یافت نشد.\n\n` +
                `📁 نام فایل: ${path.basename(pdfPath)}\n\n` +
                `لطفاً با پشتیبانی تماس بگیرید.`
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
        
        await sendMessage(chatId, 
            `❌ متأسفانه در ارسال فایل مشکلی پیش آمده.\n\n` +
            `⚠️ ممکن است حجم فایل زیاد باشد یا فرمت آن پشتیبانی نشود.`
        );
    }
    return null;
}

// دریافت اطلاعات فایل از تلگرام
async function getFile(fileId) {
    try {
        const response = await axios.post(`${API_URL}${TOKEN}/getFile`, {
            file_id: fileId
        }, {
            timeout: 10000
        });
        
        if (response.data.ok) {
            return response.data.result;
        }
    } catch (error) {
        log(`خطا در دریافت اطلاعات فایل: ${error.message}`, 'ERROR');
    }
    return null;
}

// دانلود فایل از تلگرام
async function downloadFile(filePath, destination) {
    try {
        const response = await axios({
            url: `https://tapi.bale.ai/file/bot${TOKEN}/${filePath}`,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000
        });
        
        const writer = fs.createWriteStream(destination);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                log(`فایل دانلود شد: ${destination}`, 'DOWNLOAD');
                resolve(true);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        log(`خطا در دانلود فایل: ${error.message}`, 'ERROR');
        return false;
    }
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
    SELECT_COURSE: 'select_course',
    UPLOAD_COURSE_NAME: 'upload_course_name',
    UPLOAD_COURSE_FILE: 'upload_course_file'
};

// ================ فقط دکمه‌های شیشه‌ای (Inline Keyboard) ================

// منوی اصلی با دکمه‌های شیشه‌ای - نمایش بر اساس ادمین بودن
function getMainMenuInlineKeyboard(userId) {
    const keyboard = [
        [
            {
                text: '📚 دریافت سوالات درسی',
                callback_data: 'get_courses'
            }
        ]
    ];
    
    // فقط اگر کاربر ادمین است، دکمه آپلود رو نشون بده
    if (isAdmin(userId)) {
        keyboard.push([
            {
                text: '📤 آپلود سوالات',
                callback_data: 'upload_course'
            }
        ]);
    }
    
    // دکمه‌های عمومی که برای همه نمایش داده میشه
    keyboard.push([
        {
            text: 'ℹ️ درباره ربات',
            callback_data: 'about_bot'
        },
        {
            text: '🆘 راهنما',
            callback_data: 'help_guide'
        }
    ]);
    
    return {
        inline_keyboard: keyboard
    };
}

// منوی انتخاب درس با دکمه‌های شیشه‌ای
function getCourseMenuInlineKeyboard() {
    const allFiles = getAllFiles();
    const keyboard = [];
    
    // فایل‌های اصلی
    keyboard.push([
        {
            text: '📖 تفسیر قرآن',
            callback_data: 'course_tafsir'
        },
        {
            text: '📝 نوشتن رزومه',
            callback_data: 'course_resume'
        }
    ]);
    
    // فایل‌های آپلود شده
    const uploadedFiles = readUploadedFiles();
    const uploadedCourseNames = Object.keys(uploadedFiles);
    
    if (uploadedCourseNames.length > 0) {
        // هر دو تا فایل در یک ردیف
        for (let i = 0; i < uploadedCourseNames.length; i += 2) {
            const row = [];
            
            // فایل اول
            const courseName1 = uploadedCourseNames[i];
            row.push({
                text: `📄 ${courseName1.substring(0, 15)}${courseName1.length > 15 ? '...' : ''}`,
                callback_data: `uploaded_${courseName1}`
            });
            
            // فایل دوم (اگر وجود دارد)
            if (i + 1 < uploadedCourseNames.length) {
                const courseName2 = uploadedCourseNames[i + 1];
                row.push({
                    text: `📄 ${courseName2.substring(0, 15)}${courseName2.length > 15 ? '...' : ''}`,
                    callback_data: `uploaded_${courseName2}`
                });
            }
            
            keyboard.push(row);
        }
    }
    
    // دکمه بازگشت
    keyboard.push([
        {
            text: '🔙 بازگشت به منوی اصلی',
            callback_data: 'back_to_main'
        }
    ]);
    
    return {
        inline_keyboard: keyboard
    };
}

// ================ توابع پردازش پیام و Callback ================

async function processMessage(message) {
    const chatId = message.chat.id;
    const user = message.from;
    const userId = user.id;
    const text = message.text || '';
    const document = message.document;
    
    log(`📩 پیام از ${user.first_name} (${userId}): "${text}"`, 'RECEIVE');
    
    const currentState = userStates[chatId] || UserState.START;
    
    // ========== پردازش حالت آپلود (فقط برای ادمین) ==========
    if (currentState === UserState.UPLOAD_COURSE_NAME) {
        // بررسی ادمین بودن
        if (!isAdmin(userId)) {
            userStates[chatId] = UserState.MAIN_MENU;
            await sendMessage(chatId,
                '⛔ شما اجازه آپلود فایل ندارید!',
                { replyMarkup: getMainMenuInlineKeyboard(userId) }
            );
            return;
        }
        
        // کاربر نام درس را وارد کرده
        if (text && text.trim().length > 0) {
            const courseName = text.trim();
            userStates[chatId] = {
                state: UserState.UPLOAD_COURSE_FILE,
                courseName: courseName
            };
            
            await sendMessage(chatId,
                `✅ نام درس "${courseName}" ثبت شد.\n\n` +
                `📤 حالا لطفاً فایل PDF سوالات را ارسال کنید:\n\n` +
                `⚠️ فقط فایل PDF قابل قبول است`
            );
        }
        return;
    }
    
    if (currentState.state === UserState.UPLOAD_COURSE_FILE) {
        // بررسی ادمین بودن
        if (!isAdmin(userId)) {
            userStates[chatId] = UserState.MAIN_MENU;
            await sendMessage(chatId,
                '⛔ شما اجازه آپلود فایل ندارید!',
                { replyMarkup: getMainMenuInlineKeyboard(userId) }
            );
            return;
        }
        
        // کاربر فایل را ارسال کرده
        if (document && document.mime_type === 'application/pdf') {
            try {
                await sendMessage(chatId, '⏳ در حال دریافت فایل... لطفاً صبر کنید...');
                
                // دریافت اطلاعات فایل
                const fileInfo = await getFile(document.file_id);
                if (!fileInfo) {
                    throw new Error('دریافت اطلاعات فایل ناموفق بود');
                }
                
                // ایجاد پوشه pdf_files اگر وجود ندارد
                ensurePdfFilesDir();
                
                // نام فایل (با حروف انگلیسی و ایمن)
                const timestamp = Date.now();
                const safeFileName = `${currentState.courseName.replace(/[^\w\u0600-\u06FF]/g, '_')}_${timestamp}.pdf`;
                const destination = path.join(PDF_FILES_DIR, safeFileName);
                
                // دانلود فایل
                const downloaded = await downloadFile(fileInfo.file_path, destination);
                if (!downloaded) {
                    throw new Error('دانلود فایل ناموفق بود');
                }
                
                // ذخیره اطلاعات فایل
                const saved = saveUploadedFile(currentState.courseName, safeFileName);
                
                if (saved) {
                    await sendMessage(chatId,
                        `🎉 *آپلود فایل سوالات با موفقیت انجام شد!*\n\n` +
                        `📚 درس: ${currentState.courseName}\n` +
                        `📁 نام فایل: ${safeFileName}\n` +
                        `✅ فایل با موفقیت آپلود شد و اکنون در بخش "دریافت سوالات درسی" قابل دسترسی است.\n\n` +
                        `برای مشاهده فایل، از منوی اصلی "دریافت سوالات درسی" را انتخاب کنید.`,
                        { replyMarkup: getMainMenuInlineKeyboard(userId) }
                    );
                    
                    log(`آپلود موفق: ${currentState.courseName} توسط ${user.first_name}`, 'UPLOAD_SUCCESS');
                }
                
                // بازگشت به حالت اصلی
                userStates[chatId] = UserState.MAIN_MENU;
                
            } catch (error) {
                log(`خطا در آپلود فایل: ${error.message}`, 'ERROR');
                await sendMessage(chatId,
                    `❌ خطا در آپلود فایل:\n${error.message}\n\n` +
                    `لطفاً دوباره تلاش کنید.`,
                    { replyMarkup: getMainMenuInlineKeyboard(userId) }
                );
                userStates[chatId] = UserState.MAIN_MENU;
            }
        } else if (document) {
            // فایل غیر PDF
            await sendMessage(chatId,
                '❌ فقط فایل‌های PDF قابل قبول هستند.\n\n' +
                'لطفاً یک فایل PDF ارسال کنید.',
                { replyMarkup: getMainMenuInlineKeyboard(userId) }
            );
        } else {
            await sendMessage(chatId,
                'لطفاً یک فایل PDF ارسال کنید.'
            );
        }
        return;
    }
    
    // ========== دستور /start ==========
    if (text === '/start' || text === `/start@${BOT_USERNAME}`) {
        const welcomeMessage = `
*سلام ${user.first_name} عزیز! 👋*

🎉 به *ربات بانک سوالات درسی* خوش آمدید!

📚 این ربات به شما کمک می‌کند تا به فایل‌های PDF درسی دسترسی داشته باشید

👇 *لطفاً از دکمه‌های زیر انتخاب کنید:*
        `;
        
        userStates[chatId] = UserState.MAIN_MENU;
        await sendMessage(chatId, welcomeMessage, { replyMarkup: getMainMenuInlineKeyboard(userId) });
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
            { replyMarkup: getMainMenuInlineKeyboard(userId) }
        );
        return;
    }
    
    if (text === '/files') {
        const allFiles = getAllFiles();
        let filesList = `*📂 لیست فایل‌ها*\n\n`;
        
        // فایل‌های اصلی
        filesList += `*فایل‌های اصلی:*\n`;
        for (const [name, filePath] of Object.entries(PDF_FILES)) {
            const exists = fs.existsSync(filePath) ? '✅' : '❌';
            filesList += `${exists} ${name}\n`;
        }
        
        // فایل‌های آپلود شده
        const uploadedFiles = readUploadedFiles();
        const uploadedCourseNames = Object.keys(uploadedFiles);
        if (uploadedCourseNames.length > 0) {
            filesList += `\n*فایل‌های آپلود شده:*\n`;
            uploadedCourseNames.forEach(name => {
                const filePath = path.join(PDF_FILES_DIR, uploadedFiles[name]);
                const exists = fs.existsSync(filePath) ? '✅' : '❌';
                filesList += `${exists} ${name}\n`;
            });
        }
        
        await sendMessage(chatId, filesList, { replyMarkup: getMainMenuInlineKeyboard(userId) });
        return;
    }
    
    // پاسخ پیش‌فرض
    userStates[chatId] = UserState.MAIN_MENU;
    await sendMessage(chatId, 
        "👋 سلام! برای شروع روی /start کلیک کنید.",
        { replyMarkup: getMainMenuInlineKeyboard(userId) }
    );
}

async function processCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const user = callbackQuery.from;
    const userId = user.id;
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

👇 *یکی را انتخاب کنید:*
                `;
                userStates[chatId] = UserState.SELECT_COURSE;
                await sendMessage(chatId, selectMessage, { replyMarkup: getCourseMenuInlineKeyboard() });
                break;
                
            case 'upload_course':
                // بررسی ادمین بودن قبل از اجازه آپلود
                if (isAdmin(userId)) {
                    userStates[chatId] = UserState.UPLOAD_COURSE_NAME;
                    await sendMessage(chatId,
                        `📤 *آپلود سوالات درسی*\n\n` +
                        `لطفاً نام درس را وارد کنید:\n\n`
                    );
                } else {
                    // اگر ادمین نیست، پیام خطا بده
                    await sendMessage(chatId,
                        `⛔ *دسترسی محدود*\n\n` +
                        `متأسفانه فقط مدیر ربات (ادمین) می‌تواند فایل آپلود کند.\n\n` +
                        `شما می‌توانید از بخش "دریافت سوالات درسی" فایل‌های موجود را دریافت کنید.`,
                        { replyMarkup: getMainMenuInlineKeyboard(userId) }
                    );
                }
                break;
                
            case 'about_bot':
                await sendMessage(chatId, 
                    `*🤖 درباره ربات*\n\n` +
                    `این ربات برای دسترسی آسان به سوالات و فایل‌های درسی طراحی شده.\n\n` +
                    `*پلتفرم:* پیام‌رسان بله`,
                    { replyMarkup: getMainMenuInlineKeyboard(userId) }
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
                    { replyMarkup: getMainMenuInlineKeyboard(userId) }
                );
                break;
                
            case 'course_tafsir':
                await sendPDFFile(chatId, PDF_FILES['تفسیر قرآن'],
                    `📖 *تفسیر قرآن*\n\n` +
                    `فایل آموزشی تفسیر قرآن\n` +
                    `درخواست شده توسط: ${user.first_name}\n` +
                    `🕐 ${new Date().toLocaleString('fa-IR')}`
                );
                await sendMessage(chatId, 
                    "✅ فایل تفسیر قرآن ارسال شد.\n\n" +
                    "👇 برای فایل‌های دیگر از منوی زیر انتخاب کنید:",
                    { replyMarkup: getCourseMenuInlineKeyboard() }
                );
                break;
                
            case 'course_resume':
                await sendPDFFile(chatId, PDF_FILES['نوشتن رزومه'],
                    `📝 *نوشتن رزومه*\n\n` +
                    `راهنمای کامل نوشتن رزومه حرفه‌ای\n` +
                    `درخواست شده توسط: ${user.first_name}\n` +
                    `🕐 ${new Date().toLocaleString('fa-IR')}`
                );
                await sendMessage(chatId, 
                    "✅ فایل آموزش رزومه نویسی ارسال شد.\n\n" +
                    "👇 برای فایل‌های دیگر از منوی زیر انتخاب کنید:",
                    { replyMarkup: getCourseMenuInlineKeyboard() }
                );
                break;
                
            // پردازش فایل‌های آپلود شده
            default:
                if (data.startsWith('uploaded_')) {
                    const courseName = data.replace('uploaded_', '');
                    const uploadedFiles = readUploadedFiles();
                    const fileName = uploadedFiles[courseName];
                    
                    if (fileName) {
                        const filePath = path.join(PDF_FILES_DIR, fileName);
                        
                        if (fs.existsSync(filePath)) {
                            // ارسال فایل PDF
                            await sendPDFFile(chatId, filePath,
                                `📚 *${courseName}*\n\n` +
                                `فایل آپلود شده توسط کاربران\n` +
                                `درخواست شده توسط: ${user.first_name}\n` +
                                `🕐 ${new Date().toLocaleString('fa-IR')}`
                            );
                            
                            // ارسال پیام تأیید
                            await sendMessage(chatId, 
                                `✅ فایل "${courseName}" ارسال شد.\n\n` +
                                "👇 برای فایل‌های دیگر از منوی زیر انتخاب کنید:",
                                { replyMarkup: getCourseMenuInlineKeyboard() }
                            );
                        } else {
                            log(`فایل یافت نشد: ${filePath}`, 'ERROR');
                            await sendMessage(chatId,
                                `❌ فایل "${courseName}" یافت نشد.\n\n` +
                                `لطفاً دوباره از منوی اصلی شروع کنید.`,
                                { replyMarkup: getMainMenuInlineKeyboard(userId) }
                            );
                        }
                    } else {
                        await sendMessage(chatId,
                            `❌ فایل "${courseName}" یافت نشد.\n\n` +
                            `لطفاً دوباره از منوی اصلی شروع کنید.`,
                            { replyMarkup: getMainMenuInlineKeyboard(userId) }
                        );
                    }
                    break;
                } else if (data === 'back_to_main') {
                    userStates[chatId] = UserState.MAIN_MENU;
                    await sendMessage(chatId, 
                        "🔙 به منوی اصلی بازگشتید.\n\n" +
                        "👇 لطفاً انتخاب کنید:",
                        { replyMarkup: getMainMenuInlineKeyboard(userId) }
                    );
                    break;
                } else {
                    userStates[chatId] = UserState.MAIN_MENU;
                    await sendMessage(chatId, 
                        "👋 سلام! برای شروع روی /start کلیک کنید.",
                        { replyMarkup: getMainMenuInlineKeyboard(userId) }
                    );
                }
        }
        
    } catch (error) {
        log(`خطا در پردازش Callback: ${error.message}`, 'ERROR');
        await sendMessage(chatId,
            `❌ خطا در پردازش درخواست:\n${error.message}\n\n` +
            `لطفاً دوباره تلاش کنید.`,
            { replyMarkup: getMainMenuInlineKeyboard(userId) }
        );
    }
}

// ================ متغیرهای اصلی ================
let lastUpdateId = 0;

// ================ تابع بررسی فایل‌ها ================
function checkPDFFiles() {
    console.log('\n🔍 بررسی فایل‌های PDF...');
    console.log('='.repeat(50));
    
    // ایجاد پوشه pdf_files
    ensurePdfFilesDir();
    
    // فایل‌های اصلی
    console.log('فایل‌های اصلی:');
    for (const [fileName, filePath] of Object.entries(PDF_FILES)) {
        const exists = fs.existsSync(filePath);
        const status = exists ? '✅ موجود' : '❌ یافت نشد';
        console.log(`${fileName.padEnd(20)}: ${status}`);
    }
    
    // فایل‌های آپلود شده
    const uploadedFiles = readUploadedFiles();
    const uploadedCourseNames = Object.keys(uploadedFiles);
    
    if (uploadedCourseNames.length > 0) {
        console.log('\nفایل‌های آپلود شده توسط کاربران:');
        uploadedCourseNames.forEach(name => {
            const fileName = uploadedFiles[name];
            const filePath = path.join(PDF_FILES_DIR, fileName);
            const exists = fs.existsSync(filePath) ? '✅ موجود' : '❌ یافت نشد';
            console.log(`${name.padEnd(20)}: ${exists} (${fileName})`);
        });
    } else {
        console.log('\n📭 هیچ فایلی توسط کاربران آپلود نشده است');
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
                    
                    if (update.message && (update.message.text || update.message.document)) {
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
        
        const allFiles = getAllFiles();
        Object.keys(allFiles).forEach(file => {
            const exists = fs.existsSync(allFiles[file]) ? '✅' : '❌';
            console.log(`   ${exists} ${file}`);
        });
        
        console.log('\n✨ ویژگی‌های جدید:');
        console.log('   📤 آپلود فایل توسط کاربران فعال شد');
        console.log('   📁 فایل‌ها در پوشه pdf_files ذخیره می‌شوند');
        console.log(`   👤 فقط ادمین (${ADMIN_ID}) می‌تواند آپلود کند`);
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