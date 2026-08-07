// Vercel Serverless Function for Shared Multi-PC Mechanic State Persistence
let memoryState = {};

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (req.method === 'GET') {
        if (kvUrl && kvToken) {
            try {
                const response = await fetch(`${kvUrl}/get/mechanic_state`, {
                    headers: { Authorization: `Bearer ${kvToken}` }
                });
                const data = await response.json();
                const state = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : {};
                return res.status(200).json(state);
            } catch (e) {
                console.error('Error reading from Vercel KV:', e);
            }
        }
        return res.status(200).json(memoryState);
    }

    if (req.method === 'POST') {
        let bodyData = req.body || {};
        if (typeof bodyData === 'string') {
            try {
                bodyData = JSON.parse(bodyData);
            } catch (e) {}
        }
        
        memoryState = bodyData;

        if (kvUrl && kvToken) {
            try {
                await fetch(`${kvUrl}/set/mechanic_state`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${kvToken}` },
                    body: JSON.stringify(JSON.stringify(bodyData))
                });
            } catch (e) {
                console.error('Error writing to Vercel KV:', e);
            }
        }

        return res.status(200).json({ status: 'ok', message: 'State saved successfully on Vercel' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
