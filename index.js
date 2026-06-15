const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Token bot Telegram của bạn
const token = '8878323011:AAGkV9WU9rQB-7OeGwdWg0bjQV0lnE129Aw'; 
// Token API Link4M (Lấy từ ảnh bạn gửi)
const link4mApiToken = '6a182340f97aed248b6eb29b';

const botName = 'Link4M_Credit_Bot';
const bot = new TelegramBot(token, { polling: true });

// Lưu trữ dữ liệu người dùng tạm thời
const usersData = {};

const getTodayStr = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

const initUser = (chatId) => {
    if (!usersData[chatId]) {
        usersData[chatId] = { credits: 0, today: getTodayStr(), dailyEarned: 0 };
    }
    if (usersData[chatId].today !== getTodayStr()) {
        usersData[chatId].today = getTodayStr();
        usersData[chatId].dailyEarned = 0;
    }
};

// Xử lý lệnh /start và hệ thống Deep Link
bot.onText(/\/start(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const payload = match[1].trim(); 
    
    initUser(chatId);

    // Xác nhận khi user quay về từ link4m với mã success_ChatID
    if (payload.startsWith('success_')) {
        const targetId = payload.split('_')[1];
        
        // Chống gian lận: Kiểm tra xem link này có đúng của user này không
        if (targetId !== chatId.toString()) {
            bot.sendMessage(chatId, '❌ Lỗi: Đây không phải link xác nhận của bạn hoặc link đã hết hạn!');
            return;
        }

        if (usersData[chatId].dailyEarned < 2) {
            usersData[chatId].credits += 1;
            usersData[chatId].dailyEarned += 1;
            bot.sendMessage(chatId, `✅ **Xác nhận vượt link thành công!**\nBạn được cộng 1 Credit.\n(Hôm nay đã nhận: ${usersData[chatId].dailyEarned}/2)`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ Bạn đã đạt giới hạn nhận 2 credits trong hôm nay. Hẹn gặp lại vào ngày mai!');
        }
    } 
    // Mở Menu
    else {
        const options = {
            reply_markup: {
                keyboard: [
                    [{ text: '🔗 Lấy Link Vượt (Kiếm Credit)' }],
                    [{ text: '💳 Dùng Credit' }],
                    [{ text: '👤 Thông tin' }]
                ],
                resize_keyboard: true
            }
        };
        bot.sendMessage(chatId, `Chào mừng bạn đến với hệ thống **${botName}**!\nVui lòng chọn menu bên dưới:`, { parse_mode: 'Markdown', ...options });
    }
});

// Xử lý logic các nút bấm
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return; 

    initUser(chatId);

    // Tự động gọi API Link4M để tạo link
    if (text === '🔗 Lấy Link Vượt (Kiếm Credit)') {
        if (usersData[chatId].dailyEarned >= 2) {
            bot.sendMessage(chatId, '❌ Bạn đã hết lượt kiếm credit hôm nay (Tối đa 2/ngày).');
            return;
        }

        bot.sendMessage(chatId, '⏳ Đang tạo link vượt, vui lòng chờ...');

        try {
            // URL đích trỏ về con bot kèm mã xác nhận riêng của user này
            const destUrl = `https://t.me/xoaquanao_bot?start=success_${chatId}`;
            const apiUrl = `https://link4m.co/api-shorten/v2?api=${link4mApiToken}&url=${encodeURIComponent(destUrl)}`;
            
            const response = await axios.get(apiUrl);

            if (response.data && response.data.status === 'success') {
                const shortUrl = response.data.shortenedUrl;
                bot.sendMessage(chatId, `Vui lòng vượt link sau để nhận 1 Credit:\n\n👉 ${shortUrl}`);
            } else {
                bot.sendMessage(chatId, '❌ Hệ thống rút gọn link đang bảo trì, vui lòng thử lại sau.');
                console.error('API Error:', response.data);
            }
        } catch (error) {
            bot.sendMessage(chatId, '❌ Có lỗi kết nối đến Link4M.');
            console.error('Network Error:', error.message);
        }
    } 
    
    // Logic tiêu thụ credit
    else if (text === '💳 Dùng Credit') {
        if (usersData[chatId].credits > 0) {
            usersData[chatId].credits -= 1;
            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🤝 Chuyển tới kênh đích', url: 'https://t.me/KhP19xx' }]
                    ]
                }
            };
            bot.sendMessage(chatId, '✅ Đã dùng 1 Credit!\n\nNhấn vào nút bên dưới để tiếp tục:', opts);
        } else {
            bot.sendMessage(chatId, '❌ Số dư Credit của bạn không đủ. Vui lòng kiếm thêm!');
        }
    }

    else if (text === '👤 Thông tin') {
        bot.sendMessage(chatId, `👤 **Thông tin tài khoản:**\n- Credit hiện có: ${usersData[chatId].credits}\n- Đã nhận hôm nay: ${usersData[chatId].dailyEarned}/2`, { parse_mode: 'Markdown' });
    }
});

console.log(`[Khởi động] Hệ thống API tự động đang chạy...`);