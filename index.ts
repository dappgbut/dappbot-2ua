import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        // can provide additional config here
        browser: Browsers.windows("Google Chrome"),
        auth: state
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if(qr) {
            console.log('QR code received, please scan:');
            qrcode.generate(qr, { small: true });
        }
        
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') {
            console.log('Ignoring old messages...');
            return;
        }

        const msg = m.messages[0];
        if (!msg.message) return;

        if (msg.key.fromMe) return;

        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (messageText?.toLowerCase() === 'ping') {
            // Replying to the message
            await sock.sendMessage(msg.key.remoteJid!, { text: 'pong' }, {quoted: msg});
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// run the bot
connectToWhatsApp();