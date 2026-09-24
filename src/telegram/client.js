/**
 * @typedef {object} TelegramClient
 * @property {(chatId: string, text: string) => Promise<void>} sendMessage
 */

/**
 * Stub until roadmap stage 3.
 *
 * @param {{ botToken: string }} _options
 * @returns {TelegramClient}
 */
export function createTelegramClient(_options) {
  return {
    async sendMessage() {
      throw new Error('Telegram client is not implemented yet (roadmap stage 3)');
    },
  };
}
