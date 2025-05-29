// workers/src/index.js - Cloudflare Worker for The Realm RPG backend

// Bindings for D1 (SQL) and KV (Key-Value) databases
// These are defined in wrangler.toml
// declare const DB: D1Database;
// declare const KV_DATA: KVNamespace;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // CORS headers to allow requests from your frontend
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // Replace with your frontend domain in production
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        // Handle OPTIONS requests (CORS preflight)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        try {
            // --- Example API Endpoints ---
            if (path === '/api/game/save' && method === 'POST') {
                const { userId, gameState } = await request.json();
                // Save game state to D1 (e.g., 'player_states' table)
                // Ensure 'player_states' table is created in D1
                // CREATE TABLE player_states (userId TEXT PRIMARY KEY, gameState TEXT, lastUpdated INTEGER);
                await env.DB.prepare(
                    `INSERT INTO player_states (userId, gameState, lastUpdated) VALUES (?, ?, ?)
                     ON CONFLICT(userId) DO UPDATE SET gameState=excluded.gameState, lastUpdated=excluded.lastUpdated;`
                )
                    .bind(userId, JSON.stringify(gameState), Date.now())
                    .run();
                return new Response(JSON.stringify({ message: 'Game state saved.' }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    status: 200,
                });
            }

            if (path === '/api/game/load' && method === 'POST') {
                const { userId } = await request.json();
                const { results } = await env.DB.prepare(
                    `SELECT gameState FROM player_states WHERE userId = ?`
                ).bind(userId).all();

                if (results.length > 0) {
                    const gameState = JSON.parse(results[0].gameState);
                    return new Response(JSON.stringify({ gameState }), {
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                        status: 200,
                    });
                } else {
                    return new Response(JSON.stringify({ message: 'No game state found.' }), {
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                        status: 404,
                    });
                }
            }

            if (path === '/api/exp/calculateOffline' && method === 'POST') {
                const { lastOnlineTimestamp, offlineExpRate } = await request.json();
                const now = Date.now();
                const timeElapsedSeconds = (now - lastOnlineTimestamp) / 1000;
                const gainedExp = timeElapsedSeconds * offlineExpRate; // Offline EXP calculation logic

                return new Response(JSON.stringify({ gainedExp: gainedExp.toFixed(2) }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    status: 200,
                });
            }

            // --- Endpoint for static data (optional, if not hosted by Pages) ---
            // If you want the Worker to serve static JSON data, here's an example:
            // if (path === '/api/data/creatures' && method === 'GET') {
            //     const creaturesData = await env.KV_DATA.get('creatures_data', { type: 'json' });
            //     if (creaturesData) {
            //         return new Response(JSON.stringify(creaturesData), {
            //             headers: { 'Content-Type': 'application/json', ...corsHeaders },
            //             status: 200,
            //         });
            //     } else {
            //         return new Response(JSON.stringify({ message: 'Creatures data not found in KV.' }), {
            //             headers: { 'Content-Type': 'application/json', ...corsHeaders },
            //             status: 404,
            //         });
            //     }
            // }


            // Handle not found routes
            return new Response(JSON.stringify({ message: 'Endpoint not found.' }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                status: 404,
            });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({ message: 'Internal Server Error', error: error.message }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                status: 500,
            });
        }
    },
};
