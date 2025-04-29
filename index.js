const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const express = require('express');
const app = express();
const port = 1000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

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
  
  // Store message content before attempting to delete
  const ticketContent = message.content;
  const ticketAuthor = message.author;
  const ticketGuild = message.guild;
  
  try {
    // Try to delete the original message to keep the channel clean
    // But wrap in try/catch to prevent errors if message is already gone
    try {
      if (message.deletable) {
        await message.delete();
      }
    } catch (deleteError) {
      console.log('Could not delete message, continuing with ticket creation:', deleteError.message);
      // Continue with ticket creation even if message deletion fails
    }
    
    // Check if user already has an open ticket
    if (activeTickets.has(ticketAuthor.id)) {
      const ticketChannelId = activeTickets.get(ticketAuthor.id);
      const ticketChannel = ticketGuild.channels.cache.get(ticketChannelId);
      
      if (ticketChannel) {
        try {
          await ticketAuthor.send({
            content: `You already have an open ticket at <#${ticketChannelId}>. Please use that channel instead.`
          });
        } catch (dmError) {
          // If DM fails, send message in ticket channel
          const channel = client.channels.cache.get(config.ticketChannelId);
          if (channel) {
            channel.send({
              content: `<@${ticketAuthor.id}>, you already have an open ticket at <#${ticketChannelId}>. Please use that channel instead.`,
            }).then(msg => {
              setTimeout(() => msg.delete().catch(() => {}), 5000);
            }).catch(err => console.error('Failed to send notification:', err));
          }
        }
        return;
      } else {
        // If the ticket channel no longer exists, remove from activeTickets
        activeTickets.delete(ticketAuthor.id);
      }
    }
    
    // Create new ticket channel with the stored content and author
    const ticketChannel = await createTicketChannel({
      content: ticketContent,
      author: ticketAuthor,
      guild: ticketGuild
    });
    
    // Store the ticket
    if (ticketChannel) {
      activeTickets.set(ticketAuthor.id, ticketChannel.id);
    }
  } catch (error) {
    console.error('Error handling ticket creation:', error);
    // Try to notify the user if an error occurs
    try {
      const channel = client.channels.cache.get(config.ticketChannelId);
      if (channel) {
        channel.send({
          content: `<@${ticketAuthor.id}>, there was an error creating your ticket. Please try again later or contact an administrator.`,
        }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 10000);
        }).catch(err => console.error('Failed to send error notification:', err));
      }
    } catch (notifyError) {
      console.error('Failed to notify user of error:', notifyError);
    }
  }
});

// Create a new ticket channel
async function createTicketChannel(ticketData) {
  try {
    const ticketId = Date.now().toString().slice(-4);
    const authorUsername = ticketData.author?.username || 
                         ticketData.author?.user?.username || 
                         'user';
    const channelName = `ticket-${authorUsername}-${ticketId}`;
    
    // Get author ID from the appropriate field based on the structure of ticketData
    const authorId = ticketData.author?.id || ticketData.author?.user?.id;
    const guildObj = ticketData.guild || ticketData.author?.guild;
    
    if (!guildObj) {
      console.error('Guild object is missing in ticket data');
      return null;
    }
    
    if (!authorId) {
      console.error('Author ID is missing in ticket data');
      return null;
    }
    
    // Create the channel
    const ticketChannel = await guildObj.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      permissionOverwrites: [
        {
          id: guildObj.id, // @everyone role
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: authorId,
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
    
    // Extract content from the appropriate field
    const ticketContent = ticketData.content || 'No description provided.';
    
    // Create welcome embed with ticket info
    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${ticketId}`)
      .setDescription(`Thank you for creating a ticket, <@${authorId}>! A staff member will assist you shortly.`)
      .addFields(
        { name: 'Issue', value: ticketContent },
        { name: 'Created by', value: `<@${authorId}>` },
        { name: 'Created at', value: new Date().toLocaleString() }
      )
      .setColor(config.embedColor)
      .setFooter({ text: 'Please be patient while we review your ticket.' });
    
    // Send the embed with buttons
    await ticketChannel.send({ 
      content: `<@&${config.staffRoleId}> - New ticket from <@${authorId}>`, 
      embeds: [embed], 
      components: [row] 
    });
    
    // Send confirmation to user
    try {
      const user = client.users.cache.get(authorId);
      if (user) {
        await user.send({
          content: `Your ticket has been created at <#${ticketChannel.id}>. Please wait for a staff member to assist you.`
        });
      }
    } catch (dmError) {
      console.log('Failed to send DM to user:', dmError.message);
      // If DM fails, send message in ticket channel instead
      const channel = client.channels.cache.get(config.ticketChannelId);
      if (channel) {
        channel.send({
          content: `<@${authorId}>, your ticket has been created at <#${ticketChannel.id}>. Please wait for a staff member to assist you.`,
        }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 5000);
        }).catch(err => console.error('Failed to send confirmation in channel:', err));
      }
    }
    
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

    case 'add':
      // Check if the command is used in a ticket channel
      if (!message.channel.name.startsWith('ticket-')) {
        message.reply('This command can only be used in a ticket channel.');
        return;
      }
      
      // Check if the user has staff permissions
      if (!message.member.roles.cache.has(config.staffRoleId)) {
        message.reply('You do not have permission to add users to tickets.');
        return;
      }
      
      // Get the mentioned user
      const user = message.mentions.users.first();
      if (!user) {
        message.reply('Please mention a user to add to this ticket. Usage: `!add @user`');
        return;
      }
      
      try {
        // Add the user to the ticket channel
        await message.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
        
        // Send confirmation message
        const embed = new EmbedBuilder()
          .setTitle('User Added')
          .setDescription(`<@${user.id}> has been added to the ticket by <@${message.author.id}>.`)
          .setColor(config.embedColor)
          .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error adding user to ticket:', error);
        message.reply('An error occurred while trying to add the user to this ticket.');
      }
      break;
      
    case 'remove':
      // Check if the command is used in a ticket channel
      if (!message.channel.name.startsWith('ticket-')) {
        message.reply('This command can only be used in a ticket channel.');
        return;
      }
      
      // Check if the user has staff permissions
      if (!message.member.roles.cache.has(config.staffRoleId)) {
        message.reply('You do not have permission to remove users from tickets.');
        return;
      }
      
      // Get the mentioned user
      const userToRemove = message.mentions.users.first();
      if (!userToRemove) {
        message.reply('Please mention a user to remove from this ticket. Usage: `!remove @user`');
        return;
      }
      
      // Don't allow removing the ticket creator
      for (const [userId, channelId] of activeTickets.entries()) {
        if (channelId === message.channel.id && userId === userToRemove.id) {
          message.reply('You cannot remove the ticket creator from their own ticket.');
          return;
        }
      }
      
      try {
        // Remove the user from the ticket channel
        await message.channel.permissionOverwrites.edit(userToRemove.id, {
          ViewChannel: false
        });
        
        // Send confirmation message
        const embed = new EmbedBuilder()
          .setTitle('User Removed')
          .setDescription(`<@${userToRemove.id}> has been removed from the ticket by <@${message.author.id}>.`)
          .setColor(config.embedColor)
          .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error removing user from ticket:', error);
        message.reply('An error occurred while trying to remove the user from this ticket.');
      }
      break;
  }
});

// Login to Discord with your token
client.login(process.env.TOKEN);

