const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

// Configuration
const config = {
  ticketChannelId: '1366577493976551545', // Channel ID where users can create tickets
  ticketCategoryId: '1119589526738837608', // Category ID where ticket channels will be created
  staffRoleId: '1139165711009325147', // Role ID for staff who can manage tickets
  prefix: '!', // Command prefix
  embedColor: '#0099ff', // Color for embeds
};

// Map to store open tickets
const activeTickets = new Map();

// When the client is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  setupTicketChannel();
});

// Set up the ticket channel with instructions
async function setupTicketChannel() {
  const channel = client.channels.cache.get(config.ticketChannelId);
  if (!channel) return console.error('Ticket channel not found!');
  
  try {
    // Clear previous messages
    const messages = await channel.messages.fetch({ limit: 10 });
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
    }
    
    // Create ticket instruction embed
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Ticket System')
      .setDescription('Need help? Create a ticket and our team will assist you.')
      .setColor(config.embedColor)
      .addFields(
        { name: 'How to create a ticket', value: 'Type your issue in this channel to create a new support ticket.' },
        { name: 'Please include', value: 'A clear description of your issue so we can help you faster.' }
      )
      .setFooter({ text: 'Your ticket will be created in a private channel.' });
    
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error setting up ticket channel:', error);
  }
}

// Handle messages to create tickets
client.on('messageCreate', async (message) => {
  // Ignore bot messages and messages not in the ticket channel
  if (message.author.bot || message.channel.id !== config.ticketChannelId) return;
  
  try {
    // Delete the original message to keep the channel clean
    await message.delete();
    
    // Check if user already has an open ticket
    if (activeTickets.has(message.author.id)) {
      const ticketChannelId = activeTickets.get(message.author.id);
      const ticketChannel = message.guild.channels.cache.get(ticketChannelId);
      
      if (ticketChannel) {
        const reply = await message.author.send({
          content: `You already have an open ticket at <#${ticketChannelId}>. Please use that channel instead.`
        }).catch(() => {
          // If DM fails, send message in ticket channel
          message.channel.send({
            content: `<@${message.author.id}>, you already have an open ticket at <#${ticketChannelId}>. Please use that channel instead.`,
          }).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
          });
        });
        return;
      } else {
        // If the ticket channel no longer exists, remove from activeTickets
        activeTickets.delete(message.author.id);
      }
    }
    
    // Create new ticket channel
    const ticketChannel = await createTicketChannel(message);
    
    // Store the ticket
    if (ticketChannel) {
      activeTickets.set(message.author.id, ticketChannel.id);
    }
  } catch (error) {
    console.error('Error handling ticket creation:', error);
  }
});

// Create a new ticket channel
async function createTicketChannel(message) {
  try {
    const ticketId = Date.now().toString().slice(-4);
    const channelName = `ticket-${message.author.username}-${ticketId}`;
    
    // Create the channel
    const ticketChannel = await message.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      permissionOverwrites: [
        {
          id: message.guild.id, // @everyone role
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: message.author.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
          id: config.staffRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });
    
    // Create buttons for ticket management
    const acceptButton = new ButtonBuilder()
      .setCustomId('accept_ticket')
      .setLabel('Accept Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅');
    
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');
    
    const row = new ActionRowBuilder().addComponents(acceptButton, closeButton);
    
    // Create welcome embed with ticket info
    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${ticketId}`)
      .setDescription(`Thank you for creating a ticket, <@${message.author.id}>! A staff member will assist you shortly.`)
      .addFields(
        { name: 'Issue', value: message.content || 'No description provided.' },
        { name: 'Created by', value: `<@${message.author.id}>` },
        { name: 'Created at', value: new Date().toLocaleString() }
      )
      .setColor(config.embedColor)
      .setFooter({ text: 'Please be patient while we review your ticket.' });
    
    // Send the embed with buttons
    await ticketChannel.send({ content: `<@&${config.staffRoleId}> - New ticket from <@${message.author.id}>`, embeds: [embed], components: [row] });
    
    // Send confirmation to user
    await message.author.send({
      content: `Your ticket has been created at <#${ticketChannel.id}>. Please wait for a staff member to assist you.`
    }).catch(() => {
      // If DM fails, send message in ticket channel
      message.channel.send({
        content: `<@${message.author.id}>, your ticket has been created at <#${ticketChannel.id}>. Please wait for a staff member to assist you.`,
      }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
    });
    
    return ticketChannel;
  } catch (error) {
    console.error('Error creating ticket channel:', error);
    return null;
  }
}

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  try {
    switch (interaction.customId) {
      case 'accept_ticket':
        await handleAcceptTicket(interaction);
        break;
      case 'close_ticket':
        await handleCloseTicket(interaction);
        break;
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    await interaction.reply({
      content: 'An error occurred while processing this action.',
      ephemeral: true
    }).catch(() => {});
  }
});

// Handle accepting a ticket
async function handleAcceptTicket(interaction) {
  if (!interaction.member.roles.cache.has(config.staffRoleId)) {
    return await interaction.reply({
      content: 'You do not have permission to accept tickets.',
      ephemeral: true
    });
  }
  
  await interaction.reply({
    content: `Ticket accepted by <@${interaction.user.id}>. They will be handling this ticket.`,
  });
  
  // Update the ticket embed
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor('#00ff00')
    .addFields({ name: 'Status', value: `Accepted by <@${interaction.user.id}>` });
  
  // Update buttons - remove accept button
  const closeButton = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔒');
  
  const row = new ActionRowBuilder().addComponents(closeButton);
  
  await interaction.message.edit({
    embeds: [embed],
    components: [row]
  });
}

// Handle closing a ticket
async function handleCloseTicket(interaction) {
  // Check if the user is either a staff member or the ticket creator
  const hasPermission = interaction.member.roles.cache.has(config.staffRoleId);
  
  if (!hasPermission) {
    return await interaction.reply({
      content: 'You do not have permission to close this ticket.',
      ephemeral: true
    });
  }
  
  // Find the ticket creator from the active tickets
  let ticketCreatorId = null;
  for (const [userId, channelId] of activeTickets.entries()) {
    if (channelId === interaction.channel.id) {
      ticketCreatorId = userId;
      break;
    }
  }
  
  await interaction.reply({
    content: `Ticket will be closed in 5 seconds. Thank you for using our support system.`,
  });
  
  // Remove from active tickets
  if (ticketCreatorId) {
    activeTickets.delete(ticketCreatorId);
  }
  
  // Wait 5 seconds before deleting the channel
  setTimeout(async () => {
    try {
      await interaction.channel.delete();
    } catch (error) {
      console.error('Error deleting ticket channel:', error);
    }
  }, 5000);
}

// Handle a few basic utility commands
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;
  
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  switch (command) {
    case 'ping':
      message.reply(`Pong! Bot latency: ${client.ws.ping}ms`);
      break;
    
    case 'tickets':
      if (!message.member.roles.cache.has(config.staffRoleId)) {
        message.reply('You do not have permission to use this command.');
        return;
      }
      
      if (activeTickets.size === 0) {
        message.reply('There are no active tickets at the moment.');
        return;
      }
      
      const ticketList = [];
      for (const [userId, channelId] of activeTickets.entries()) {
        ticketList.push(`<@${userId}>: <#${channelId}>`);
      }
      
      const embed = new EmbedBuilder()
        .setTitle('Active Tickets')
        .setDescription(ticketList.join('\n'))
        .setColor(config.embedColor)
        .setFooter({ text: `Total: ${activeTickets.size} tickets` });
      
      message.reply({ embeds: [embed] });
      break;
  }
});

// Login to Discord with your token
client.login(process.env.TOKEN);