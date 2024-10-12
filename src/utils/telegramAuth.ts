import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not set in environment variables');
}

export function validateTelegramWebAppData(initData: string): any {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  if (!hash) {
    return null;
  }

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Correct implementation of secret key generation
  const secretKey = crypto.createHmac('sha256', BOT_TOKEN!).update('WebAppData').digest();
  
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return null;
  }

  const user = JSON.parse(urlParams.get('user') || '{}');
  return { user };
}