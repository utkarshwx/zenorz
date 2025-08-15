const fetch = require('node-fetch');

async function oauthRoutes(fastify) {
  // Redirect user to Discord OAuth
  fastify.get('/login', async (req, reply) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.APPLICATION_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email+identify+guilds+applications.commands.permissions.update`;
    reply.redirect(url);
  });

  // Handle Discord callback
  fastify.get('/callback', async (req, reply) => {
    const code = req.query.code;
    if (!code) {
      return reply.code(400).send({ error: 'No code provided' });
    }

    // Exchange code for access token
    const params = new URLSearchParams();
    params.append('client_id', process.env.APPLICATION_ID);
    params.append('client_secret', process.env.CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', process.env.REDIRECT_URI);
    params.append('scope', 'identify guilds');

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return reply.code(400).send(tokenData);
    }

    // Get user data
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();

    return { user: userData, token: tokenData };
  });
}

module.exports = oauthRoutes;
