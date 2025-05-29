// main.js - Main logic for The Realm text-based RPG

// --- Global Game State Variables ---
let gameData = {
    player: {
        level: 1,
        exp: 0,
        gender: '?', // Player chooses gender
        lastOnline: Date.now(), // Timestamp of last online activity
        offlineExpRate: 0.1 // EXP per second while offline
    },
    currentLocation: 'starting_village',
    inventory: [],
    gameStarted: false,
    // Static game data will be loaded from JSON files
    locations: {},
    creatures: {},
    quests: {}
};

// --- Gemini API Configuration ---
const API_KEY = ""; // Leave empty, Canvas will provide it at runtime
const GEMINI_FLASH_MODEL = "gemini-2.0-flash";

// --- DOM Elements ---
const gameOutput = document.getElementById('game-output');
const commandInput = document.getElementById('command-input');
const submitButton = document.getElementById('submit-command');
const statLevel = document.getElementById('stat-level');
const statExp = document.getElementById('stat-exp');
const statGender = document.getElementById('stat-gender');

// LLM feature buttons
const suggestQuestButton = document.getElementById('suggest-quest-button');
const talkNpcButton = document.getElementById('talk-npc-button');
const imagineButton = document.getElementById('imagine-button');

// --- Utility Functions ---

// Adds text to the game output area
function addOutput(text, colorClass = 'text-stone-100') {
    const p = document.createElement('p');
    p.classList.add(colorClass, 'mb-2');
    p.textContent = text;
    gameOutput.appendChild(p);
    gameOutput.scrollTop = gameOutput.scrollHeight; // Scroll to bottom
}

// Updates player stats display
function updateStatsDisplay() {
    statLevel.textContent = gameData.player.level;
    statExp.textContent = gameData.player.exp.toFixed(0);
    statGender.textContent = gameData.player.gender;
}

// Loads game data from JSON files
async function loadGameData() {
    try {
        const [locationsRes, creaturesRes, questsRes] = await Promise.all([
            fetch('./data/locations.json'),
            fetch('./data/creatures.json'),
            fetch('./data/quests.json')
        ]);

        gameData.locations = await locationsRes.json();
        gameData.creatures = await creaturesRes.json();
        gameData.quests = await questsRes.json();

        addOutput('Game data loaded successfully. Ready for adventure!', 'text-green-400');
        // After data is loaded, display the starting location description
        displayLocation();
    } catch (error) {
        addOutput(`Failed to load game data: ${error.message}. Please try again later.`, 'text-red-400');
        console.error('Error loading game data:', error);
    }
}

// --- Game Mechanics ---

// Displays the description of the current location
function displayLocation() {
    const loc = gameData.locations[gameData.currentLocation];
    if (loc) {
        addOutput(`You are in: ${loc.name}`, 'text-orange-400');
        addOutput(loc.description);
        if (loc.exits && Object.keys(loc.exits).length > 0) {
            addOutput(`Exits: ${Object.keys(loc.exits).join(', ')}`);
        }
        if (loc.items && loc.items.length > 0) {
            addOutput(`You see: ${loc.items.join(', ')}`);
        }
        if (loc.creatures && loc.creatures.length > 0) {
            addOutput(`You see creatures: ${loc.creatures.map(c => gameData.creatures[c]?.name || c).join(', ')}`);
        }
    } else {
        addOutput('You are lost in an unknown place.', 'text-red-400');
    }
}

// Calculates and applies offline EXP
function calculateOfflineExp() {
    const now = Date.now();
    const timeElapsedSeconds = (now - gameData.player.lastOnline) / 1000;
    const gainedExp = timeElapsedSeconds * gameData.player.offlineExpRate;

    if (gainedExp > 0) {
        const percentageOfMax = Math.min(100, (gainedExp / (gameData.player.offlineExpRate * 3600)) * 100).toFixed(0); // Example: 1 hour offline = 100%
        gameData.player.exp += gainedExp;
        addOutput(`While you were away, you gained ${gainedExp.toFixed(2)} EXP (${percentageOfMax}% of max offline potential).`, 'text-yellow-400');
        checkLevelUp();
    }
    gameData.player.lastOnline = now; // Update timestamp
    updateStatsDisplay();
}

// Checks and levels up the player
function checkLevelUp() {
    const expNeededForNextLevel = 25 * gameData.player.level * (1 + gameData.player.level);
    if (gameData.player.exp >= expNeededForNextLevel) {
        gameData.player.level++;
        addOutput(`Congratulations! You leveled up to Level ${gameData.player.level}!`, 'text-green-400');
        // At Level 5, offer job path choice
        if (gameData.player.level === 5) {
            addOutput('You have reached Level 5! You can now choose your job path. Type "choose job" to see options.', 'text-cyan-400');
        }
        updateStatsDisplay();
        // Recursively check if enough EXP for multiple levels at once
        checkLevelUp();
    }
}

// --- Gemini API Integration ---

// Generic function to call Gemini API
async function callGeminiAPI(prompt, model = GEMINI_FLASH_MODEL) {
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.error('Gemini API returned unexpected structure:', result);
            return 'Sorry, I could not generate a response. Unexpected API structure.';
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return `Sorry, an error occurred while contacting the otherworld: ${error.message}`;
    }
}

// Handles "Suggest Quest" command
async function handleSuggestQuest() {
    if (!gameData.gameStarted) {
        addOutput('Game has not started. Type "start" to begin.', 'text-red-400');
        return;
    }

    addOutput('Loading quest suggestion from the otherworld... ✨', 'text-gray-500');
    const prompt = `As a Game Master for a text-based RPG inspired by Shan Hai Jing, suggest a brief quest idea for the player. The player is currently at ${gameData.locations[gameData.currentLocation]?.name || 'an unknown location'}, level ${gameData.player.level}, and has items: ${gameData.inventory.length > 0 ? gameData.inventory.join(', ') : 'none'}. Focus on creatures or concepts from Shan Hai Jing.`;

    const response = await callGeminiAPI(prompt);
    addOutput(`\n✨ Quest Suggestion from the Myth Keeper:\n${response}`, 'text-purple-400');
}

// Handles "Talk to NPC" command
async function handleTalkNpc() {
    if (!gameData.gameStarted) {
        addOutput('Game has not started. Type "start" to begin.', 'text-red-400');
        return;
    }

    // For demo, assume there's an NPC in the current location
    const npcName = "Old Village Elder"; // Example NPC
    addOutput(`You approach the ${npcName}. Loading response... ✨`, 'text-gray-500');

    const prompt = `As the ${npcName} in an ancient Shan Hai Jing-inspired village, greet an adventurer of level ${gameData.player.level} who is currently in ${gameData.locations[gameData.currentLocation]?.name || 'an unknown location'}. Provide a brief greeting and perhaps a vague hint about the world or a quest.`;

    const response = await callGeminiAPI(prompt);
    addOutput(`\n✨ ${npcName} says:\n"${response}"`, 'text-indigo-400');
}

// Handles "Imagine Description" command
async function handleImagineCommand(target) {
    if (!gameData.gameStarted) {
        addOutput('Game has not started. Type "start" to begin.', 'text-red-400');
        return;
    }
    if (!target) {
        addOutput('You must specify what you want to imagine a description for. Example: "imagine dragon" or "imagine ancient sword".', 'text-red-400');
        return;
    }

    addOutput(`Imagining a description for ${target}... ✨`, 'text-gray-500');
    const prompt = `Imagine and describe in detail a ${target} in the narrative style of 'Classic of the Mountain and Seas' (Shan Hai Jing). Include details about its appearance, aura, or potential mythological powers.`;

    const response = await callGeminiAPI(prompt);
    addOutput(`\n✨ Imaginative Description for ${target}:\n${response}`, 'text-pink-400');
}


// --- Command Parser ---
function parseCommand(command) {
    const parts = command.toLowerCase().trim().split(' ');
    const verb = parts[0];
    const noun = parts.slice(1).join(' ');

    if (!gameData.gameStarted && verb !== 'start' && verb !== 'help') {
        addOutput('Type "start" to begin your adventure.', 'text-red-400');
        return;
    }

    switch (verb) {
        case 'start':
            if (!gameData.gameStarted) {
                gameData.gameStarted = true;
                addOutput('Your adventure begins! You awaken in a small village surrounded by dense forests. The air feels humid and you hear strange sounds from afar.', 'text-green-400');
                addOutput('You are a newborn infant. What is your gender? (male/female/unidentified)', 'text-yellow-400');
            } else {
                addOutput('Game has already started.', 'text-yellow-400');
            }
            break;
        case 'male':
        case 'female':
        case 'unidentified':
            if (gameData.player.gender === '?' && gameData.gameStarted) {
                gameData.player.gender = verb;
                addOutput(`You chose gender: ${verb}. Your journey will begin!`, 'text-green-400');
                updateStatsDisplay();
                displayLocation();
                calculateOfflineExp(); // Calculate offline EXP after game starts
            } else {
                addOutput('Gender already chosen or game not started.', 'text-yellow-400');
            }
            break;
        case 'help':
            addOutput('Available commands:');
            addOutput('- start: Begin the game.');
            addOutput('- male/female/unidentified: Choose your gender at the start of the game.');
            addOutput('- go <direction>: Move in a direction (north, south, east, west).');
            addOutput('- look: Look around your current location.');
            addOutput('- take <item>: Pick up an item.');
            addOutput('- inventory: View items in your inventory.');
            addOutput('- stats: View your character statistics.');
            addOutput('- choose job: Choose your job path at Level 5.');
            addOutput('- examine <creature/item>: Examine details of a creature or item.');
            addOutput('- suggest quest: Get a new quest idea from the AI. ✨');
            addOutput('- talk <npc_name>: Talk to an NPC (currently a generic NPC). ✨');
            addOutput('- imagine <target>: Get an imaginative description from the AI. ✨');
            break;
        case 'go':
            handleGoCommand(noun);
            break;
        case 'look':
            displayLocation();
            break;
        case 'take':
            handleTakeCommand(noun);
            break;
        case 'inventory':
            if (gameData.inventory.length > 0) {
                addOutput(`Your inventory: ${gameData.inventory.join(', ')}`);
            } else {
                addOutput('Your inventory is empty.');
            }
            break;
        case 'stats':
            updateStatsDisplay();
            addOutput(`Level: ${gameData.player.level}, EXP: ${gameData.player.exp.toFixed(0)}, Gender: ${gameData.player.gender}`);
            break;
        case 'choose':
            if (noun.startsWith('job')) {
                handleJobSelection();
            } else {
                addOutput('Unknown command. Type "help" for a list of commands.', 'text-red-400');
            }
            break;
        case 'examine':
            handleExamineCommand(noun);
            break;
        case 'suggest':
            if (noun === 'quest') {
                handleSuggestQuest();
            } else {
                addOutput('Unknown command. Type "help" for a list of commands.', 'text-red-400');
            }
            break;
        case 'talk':
            // For demo, we directly call handleTalkNpc without a specific name
            handleTalkNpc();
            break;
        case 'imagine':
            handleImagineCommand(noun);
            break;
        default:
            addOutput('Unknown command. Type "help" for a list of commands.', 'text-red-400');
            break;
    }
    // Add a small amount of EXP for each successful command (simulating activity)
    if (gameData.gameStarted && verb !== 'help') {
        gameData.player.exp += 1;
        checkLevelUp();
    }
}

function handleGoCommand(direction) {
    const currentLoc = gameData.locations[gameData.currentLocation];
    if (currentLoc && currentLoc.exits && currentLoc.exits[direction]) {
        gameData.currentLocation = currentLoc.exits[direction];
        addOutput(`You walk ${direction}.`, 'text-green-400');
        displayLocation();
    } else {
        addOutput(`You cannot go ${direction} from here.`, 'text-red-400');
    }
}

function handleTakeCommand(item) {
    const currentLoc = gameData.locations[gameData.currentLocation];
    if (currentLoc && currentLoc.items) {
        const itemIndex = currentLoc.items.indexOf(item);
        if (itemIndex > -1) {
            gameData.inventory.push(item);
            currentLoc.items.splice(itemIndex, 1); // Remove item from location
            addOutput(`You picked up the ${item}.`, 'text-green-400');
            addOutput(`Your inventory now contains: ${gameData.inventory.join(', ')}`);
        } else {
            addOutput(`There is no ${item} here.`, 'text-red-400');
        }
    } else {
        addOutput(`There is no ${item} here.`, 'text-red-400');
    }
}

function handleJobSelection() {
    if (gameData.player.level < 5) {
        addOutput('You must reach Level 5 first to choose a job.', 'text-yellow-400');
        return;
    }
    if (gameData.player.job) {
        addOutput(`You are already a ${gameData.player.job}.`, 'text-yellow-400');
        return;
    }

    addOutput('Choose your job: Shaman, Warrior, Scholar, Explorer. (Type "choose job <job_name>")', 'text-cyan-400');
    // This is just an example, actual logic would be more complex and likely involve the server
    commandInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const cmd = commandInput.value.toLowerCase().trim();
            if (cmd.startsWith('choose job ')) {
                const chosenJob = cmd.substring('choose job '.length);
                const validJobs = ['shaman', 'warrior', 'scholar', 'explorer'];
                if (validJobs.includes(chosenJob)) {
                    gameData.player.job = chosenJob;
                    addOutput(`You are now a ${chosenJob}! Your journey will change.`, 'text-green-400');
                    commandInput.onkeydown = handleCommandInput; // Restore normal event listener
                } else {
                    addOutput('Invalid job. Choose from Shaman, Warrior, Scholar, Explorer.', 'text-red-400');
                }
            } else {
                addOutput('Invalid command for job selection.', 'text-red-400');
            }
            commandInput.value = '';
        }
    };
}

function handleExamineCommand(target) {
    const currentLoc = gameData.locations[gameData.currentLocation];
    // Check creatures in location
    const creature = Object.values(gameData.creatures).find(c => c.name.toLowerCase() === target);
    if (creature && currentLoc.creatures.includes(creature.id)) {
        addOutput(`--- ${creature.name} ---`, 'text-purple-400');
        addOutput(`Description: ${creature.description}`);
        addOutput(`Meaning: ${creature.symbolicMeaning}`);
        addOutput(`Abilities: ${creature.abilities}`);
        return;
    }

    // Check items in location or inventory
    const itemInLoc = currentLoc.items && currentLoc.items.includes(target);
    const itemInInv = gameData.inventory.includes(target);
    if (itemInLoc || itemInInv) {
        // Example simple item description, can be expanded
        addOutput(`--- ${target.charAt(0).toUpperCase() + target.slice(1)} ---`, 'text-purple-400');
        addOutput(`This is a ${target}. It seems useful.`);
        return;
    }

    addOutput(`Cannot find or examine ${target}.`, 'text-red-400');
}


// --- Event Listeners ---
function handleCommandInput(event) {
    if (event.key === 'Enter') {
        const command = commandInput.value.trim();
        if (command) {
            addOutput(`> ${command}`, 'text-blue-400'); // Display user command
            parseCommand(command);
            commandInput.value = '';
        }
    }
}

submitButton.addEventListener('click', () => {
    const command = commandInput.value.trim();
    if (command) {
        addOutput(`> ${command}`, 'text-blue-400'); // Display user command
        parseCommand(command);
        commandInput.value = '';
    }
});

commandInput.addEventListener('keydown', handleCommandInput);

// Event listeners for new LLM buttons
suggestQuestButton.addEventListener('click', handleSuggestQuest);
talkNpcButton.addEventListener('click', handleTalkNpc);
imagineButton.addEventListener('click', () => {
    const target = prompt("What do you want to imagine a description for? (e.g., dragon, ancient sword, hidden city)");
    if (target) {
        handleImagineCommand(target);
    }
});


// --- Game Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    addOutput('Loading game data...', 'text-yellow-400');
    loadGameData();
    updateStatsDisplay();
    // If the game was previously started (e.g., from localStorage), calculate offline EXP
    // This would be part of the actual backend integration
    // calculateOfflineExp(); // Will be called after player chooses gender
});

// Save game state (simulation, would actually go to backend)
window.addEventListener('beforeunload', () => {
    gameData.player.lastOnline = Date.now();
    // Here you would send gameData.player.lastOnline to the server
    // For demo purposes, no persistent storage on frontend
});
