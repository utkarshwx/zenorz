const { Events } = require('discord.js');
const Guild = require('../models/Guild');

const defaultWelcomeMessages = [
  "Welcome to the server, {user} 🎉!",
  "Glad to have you here, {user}! 😊",
  "Hey {user}, welcome aboard! 🚀",
  "Yo {user}, glad you joined us! 🔥",
  "Make yourself at home, {user} 🏠",
];

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const guildId = member.guild.id;

    const guildConfig = await Guild.findOne({ guildId });
    if (!guildConfig) return;

    const welcomeChannelId = guildConfig.channels?.welcomeChannel;
    if (!welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel || !channel.isTextBased()) return;

    const messagesFromDB = guildConfig.welcomeMessages?.filter(msg => !!msg);
    const messagesPool = messagesFromDB?.length ? messagesFromDB : defaultWelcomeMessages;

    const randomMsg = messagesPool[Math.floor(Math.random() * messagesPool.length)];
    const welcomeText = randomMsg
      .replace('{user}', `<@${member.id}>`)
      .replace('{server}', `${member.guild.name}`);

    try {
      const sentMessage = await channel.send(welcomeText);
      setTimeout(() => {
        sentMessage.delete().catch(() => {});
      }, 30_000);
    } catch (error) {
      console.error('Failed to send or delete welcome message:', error);
    }
  },
};
