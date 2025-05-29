// main.js - Logika utama game RPG berbasis teks Shan Hai Jing

// --- Variabel Global Game State ---
let gameData = {
    player: {
        level: 1,
        exp: 0,
        gender: '?', // Akan dipilih pemain
        lastOnline: Date.now(), // Timestamp terakhir online
        offlineExpRate: 0.1 // EXP per detik saat offline
    },
    currentLocation: 'starting_village',
    inventory: [],
    gameStarted: false,
    // Data game statis akan dimuat dari file JSON
    locations: {},
    creatures: {},
    quests: {}
};

// --- Konfigurasi Gemini API ---
const API_KEY = ""; // Biarkan kosong, Canvas akan menyediakannya saat runtime
const GEMINI_FLASH_MODEL = "gemini-2.0-flash";

// --- Elemen DOM ---
const gameOutput = document.getElementById('game-output');
const commandInput = document.getElementById('command-input');
const submitButton = document.getElementById('submit-command');
const statLevel = document.getElementById('stat-level');
const statExp = document.getElementById('stat-exp');
const statGender = document.getElementById('stat-gender');

// Tombol LLM
const suggestQuestButton = document.getElementById('suggest-quest-button');
const talkNpcButton = document.getElementById('talk-npc-button');
const imagineButton = document.getElementById('imagine-button');

// --- Fungsi Utilitas ---

// Menambahkan teks ke output game
function addOutput(text, colorClass = 'text-stone-100') {
    const p = document.createElement('p');
    p.classList.add(colorClass, 'mb-2');
    p.textContent = text;
    gameOutput.appendChild(p);
    gameOutput.scrollTop = gameOutput.scrollHeight; // Gulir ke bawah
}

// Memperbarui tampilan statistik pemain
function updateStatsDisplay() {
    statLevel.textContent = gameData.player.level;
    statExp.textContent = gameData.player.exp.toFixed(0);
    statGender.textContent = gameData.player.gender;
}

// Memuat data game dari file JSON
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

        addOutput('Data game berhasil dimuat. Siap bertualang!', 'text-green-400');
        // Setelah data dimuat, tampilkan deskripsi lokasi awal
        displayLocation();
    } catch (error) {
        addOutput(`Gagal memuat data game: ${error.message}. Coba lagi nanti.`, 'text-red-400');
        console.error('Error loading game data:', error);
    }
}

// --- Mekanika Game ---

// Menampilkan deskripsi lokasi saat ini
function displayLocation() {
    const loc = gameData.locations[gameData.currentLocation];
    if (loc) {
        addOutput(`Anda berada di: ${loc.name}`, 'text-orange-400');
        addOutput(loc.description);
        if (loc.exits && Object.keys(loc.exits).length > 0) {
            addOutput(`Jalan keluar: ${Object.keys(loc.exits).join(', ')}`);
        }
        if (loc.items && loc.items.length > 0) {
            addOutput(`Anda melihat: ${loc.items.join(', ')}`);
        }
        if (loc.creatures && loc.creatures.length > 0) {
            addOutput(`Anda melihat makhluk: ${loc.creatures.map(c => gameData.creatures[c]?.name || c).join(', ')}`);
        }
    } else {
        addOutput('Anda tersesat di suatu tempat yang tidak dikenal.', 'text-red-400');
    }
}

// Menghitung dan menerapkan EXP luring
function calculateOfflineExp() {
    const now = Date.now();
    const timeElapsedSeconds = (now - gameData.player.lastOnline) / 1000;
    const gainedExp = timeElapsedSeconds * gameData.player.offlineExpRate;

    if (gainedExp > 0) {
        const percentageOfMax = Math.min(100, (gainedExp / (gameData.player.offlineExpRate * 3600)) * 100).toFixed(0); // Contoh: 1 jam offline = 100%
        gameData.player.exp += gainedExp;
        addOutput(`Saat Anda pergi, Anda mendapatkan ${gainedExp.toFixed(2)} EXP (${percentageOfMax}% dari potensi maksimal luring).`, 'text-yellow-400');
        checkLevelUp();
    }
    gameData.player.lastOnline = now; // Perbarui timestamp
    updateStatsDisplay();
}

// Mengecek dan menaikkan level pemain
function checkLevelUp() {
    const expNeededForNextLevel = 25 * gameData.player.level * (1 + gameData.player.level);
    if (gameData.player.exp >= expNeededForNextLevel) {
        gameData.player.level++;
        addOutput(`Selamat! Anda naik ke Level ${gameData.player.level}!`, 'text-green-400');
        // Pada Level 5, tawarkan pilihan pekerjaan
        if (gameData.player.level === 5) {
            addOutput('Anda telah mencapai Level 5! Sekarang Anda dapat memilih jalur pekerjaan Anda. Ketik "pilih pekerjaan" untuk melihat opsi.', 'text-cyan-400');
        }
        updateStatsDisplay();
        // Rekursif check jika EXP cukup untuk beberapa level sekaligus
        checkLevelUp();
    }
}

// --- Gemini API Integration ---

// Fungsi generik untuk memanggil Gemini API
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
            return 'Maaf, saya tidak dapat menghasilkan respons. Struktur API tidak terduga.';
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return `Maaf, terjadi kesalahan saat menghubungi dunia lain: ${error.message}`;
    }
}

// Menangani perintah "Sarankan Misi"
async function handleSuggestQuest() {
    if (!gameData.gameStarted) {
        addOutput('Game belum dimulai. Ketik "mulai" untuk memulai.', 'text-red-400');
        return;
    }

    addOutput('Memuat saran misi dari dunia lain... ✨', 'text-gray-500');
    const prompt = `Sebagai Game Master untuk RPG berbasis teks yang terinspirasi dari Shan Hai Jing, sarankan ide misi singkat untuk pemain. Pemain saat ini berada di ${gameData.locations[gameData.currentLocation]?.name || 'lokasi yang tidak dikenal'}, level ${gameData.player.level}, dan memiliki item: ${gameData.inventory.length > 0 ? gameData.inventory.join(', ') : 'tidak ada'}. Fokus pada makhluk atau konsep dari Shan Hai Jing.`;

    const response = await callGeminiAPI(prompt);
    addOutput(`\n✨ Saran Misi dari Penjaga Mitos:\n${response}`, 'text-purple-400');
}

// Menangani perintah "Bicara dengan NPC"
async function handleTalkNpc() {
    if (!gameData.gameStarted) {
        addOutput('Game belum dimulai. Ketik "mulai" untuk memulai.', 'text-red-400');
        return;
    }

    // Untuk demo, asumsikan ada NPC di lokasi saat ini
    const npcName = "Penjaga Desa Tua"; // Contoh NPC
    addOutput(`Anda mendekati ${npcName}. Memuat respons... ✨`, 'text-gray-500');

    const prompt = `Sebagai ${npcName} di desa kuno yang terinspirasi dari Shan Hai Jing, sambut seorang petualang level ${gameData.player.level} yang berada di ${gameData.locations[gameData.currentLocation]?.name || 'lokasi yang tidak dikenal'}. Berikan salam singkat dan mungkin petunjuk samar tentang dunia atau misi.`;

    const response = await callGeminiAPI(prompt);
    addOutput(`\n✨ ${npcName} berkata:\n"${response}"`, 'text-indigo-400');
}

// Menangani perintah "Bayangkan Deskripsi"
async function handleImagineCommand(target) {
    if (!gameData.gameStarted) {
        addOutput('Game belum dimulai. Ketik "mulai" untuk memulai.', 'text-red-400');
        return;
    }
    if (!target) {
        addOutput('Anda harus menentukan apa yang ingin Anda bayangkan. Contoh: "bayangkan naga" atau "bayangkan pedang kuno".', 'text-red-400');
        return;
    }

    addOutput(`Membayangkan deskripsi untuk ${target}... ✨`, 'text-gray-500');
    const prompt = `Bayangkan dan deskripsikan secara rinci sebuah ${target} dalam gaya naratif 'Classic of the Mountain and Seas' (Shan Hai Jing). Sertakan detail tentang penampilannya, aura, atau potensi kekuatan mitologisnya.`;

    const response = await callGeminiAPI(prompt);
    addOutput(`\n✨ Deskripsi Imajinatif untuk ${target}:\n${response}`, 'text-pink-400');
}


// --- Pengurai Perintah ---
function parseCommand(command) {
    const parts = command.toLowerCase().trim().split(' ');
    const verb = parts[0];
    const noun = parts.slice(1).join(' ');

    if (!gameData.gameStarted && verb !== 'mulai' && verb !== 'bantu') {
        addOutput('Ketik "mulai" untuk memulai petualangan Anda.', 'text-red-400');
        return;
    }

    switch (verb) {
        case 'mulai':
            if (!gameData.gameStarted) {
                gameData.gameStarted = true;
                addOutput('Petualangan Anda dimulai! Anda terbangun di sebuah desa kecil yang dikelilingi oleh hutan lebat. Udara terasa lembab dan Anda mendengar suara-suara aneh dari kejauhan.', 'text-green-400');
                addOutput('Anda adalah seorang bayi yang baru lahir. Apa jenis kelamin Anda? (pria/wanita/tidak_teridentifikasi)', 'text-yellow-400');
            } else {
                addOutput('Game sudah dimulai.', 'text-yellow-400');
            }
            break;
        case 'pria':
        case 'wanita':
        case 'tidak_teridentifikasi':
            if (gameData.player.gender === '?' && gameData.gameStarted) {
                gameData.player.gender = verb;
                addOutput(`Anda memilih jenis kelamin: ${verb}. Perjalanan Anda akan dimulai!`, 'text-green-400');
                updateStatsDisplay();
                displayLocation();
                calculateOfflineExp(); // Hitung EXP luring setelah game dimulai
            } else {
                addOutput('Jenis kelamin sudah dipilih atau game belum dimulai.', 'text-yellow-400');
            }
            break;
        case 'bantu':
            addOutput('Perintah yang tersedia:');
            addOutput('- mulai: Memulai permainan.');
            addOutput('- pria/wanita/tidak_teridentifikasi: Pilih jenis kelamin Anda di awal game.');
            addOutput('- pergi <arah>: Bergerak ke arah (utara, selatan, timur, barat).');
            addOutput('- lihat: Melihat sekeliling Anda.');
            addOutput('- ambil <item>: Mengambil item.');
            addOutput('- inventaris: Melihat item di inventaris Anda.');
            addOutput('- statistik: Melihat statistik karakter Anda.');
            addOutput('- pilih pekerjaan: Memilih jalur pekerjaan Anda di Level 5.');
            addOutput('- periksa <makhluk/item>: Memeriksa detail makhluk atau item.');
            addOutput('- sarankan misi: Mendapatkan ide misi baru dari AI. ✨');
            addOutput('- bicara <npc_nama>: Berbicara dengan NPC (saat ini hanya NPC umum). ✨');
            addOutput('- bayangkan <target>: Mendapatkan deskripsi imajinatif dari AI. ✨');
            break;
        case 'pergi':
            handleGoCommand(noun);
            break;
        case 'lihat':
            displayLocation();
            break;
        case 'ambil':
            handleTakeCommand(noun);
            break;
        case 'inventaris':
            if (gameData.inventory.length > 0) {
                addOutput(`Inventaris Anda: ${gameData.inventory.join(', ')}`);
            } else {
                addOutput('Inventaris Anda kosong.');
            }
            break;
        case 'statistik':
            updateStatsDisplay();
            addOutput(`Level: ${gameData.player.level}, EXP: ${gameData.player.exp.toFixed(0)}, Gender: ${gameData.player.gender}`);
            break;
        case 'pilih':
            if (noun.startsWith('pekerjaan')) {
                handleJobSelection();
            } else {
                addOutput('Perintah tidak dikenal. Ketik "bantu" untuk daftar perintah.', 'text-red-400');
            }
            break;
        case 'periksa':
            handleExamineCommand(noun);
            break;
        case 'sarankan':
            if (noun === 'misi') {
                handleSuggestQuest();
            } else {
                addOutput('Perintah tidak dikenal. Ketik "bantu" untuk daftar perintah.', 'text-red-400');
            }
            break;
        case 'bicara':
            // Untuk demo, kita langsung panggil handleTalkNpc tanpa nama spesifik
            handleTalkNpc();
            break;
        case 'bayangkan':
            handleImagineCommand(noun);
            break;
        default:
            addOutput('Perintah tidak dikenal. Ketik "bantu" untuk daftar perintah.', 'text-red-400');
            break;
    }
    // Tambahkan EXP kecil untuk setiap perintah yang berhasil (simulasi aktivitas)
    if (gameData.gameStarted && verb !== 'bantu') {
        gameData.player.exp += 1;
        checkLevelUp();
    }
}

function handleGoCommand(direction) {
    const currentLoc = gameData.locations[gameData.currentLocation];
    if (currentLoc && currentLoc.exits && currentLoc.exits[direction]) {
        gameData.currentLocation = currentLoc.exits[direction];
        addOutput(`Anda berjalan ke ${direction}.`, 'text-green-400');
        displayLocation();
    } else {
        addOutput(`Anda tidak bisa pergi ke ${direction} dari sini.`, 'text-red-400');
    }
}

function handleTakeCommand(item) {
    const currentLoc = gameData.locations[gameData.currentLocation];
    if (currentLoc && currentLoc.items) {
        const itemIndex = currentLoc.items.indexOf(item);
        if (itemIndex > -1) {
            gameData.inventory.push(item);
            currentLoc.items.splice(itemIndex, 1); // Hapus item dari lokasi
            addOutput(`Anda mengambil ${item}.`, 'text-green-400');
            addOutput(`Inventaris Anda sekarang: ${gameData.inventory.join(', ')}`);
        } else {
            addOutput(`Tidak ada ${item} di sini.`, 'text-red-400');
        }
    } else {
        addOutput(`Tidak ada ${item} di sini.`, 'text-red-400');
    }
}

function handleJobSelection() {
    if (gameData.player.level < 5) {
        addOutput('Anda harus mencapai Level 5 terlebih dahulu untuk memilih pekerjaan.', 'text-yellow-400');
        return;
    }
    if (gameData.player.job) {
        addOutput(`Anda sudah menjadi ${gameData.player.job}.`, 'text-yellow-400');
        return;
    }

    addOutput('Pilih pekerjaan Anda: Shaman, Prajurit, Cendekiawan, Penjelajah. (Ketik "pilih pekerjaan <nama_pekerjaan>")', 'text-cyan-400');
    // Ini hanya contoh, logika sebenarnya akan lebih kompleks dan mungkin melibatkan server
    commandInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const cmd = commandInput.value.toLowerCase().trim();
            if (cmd.startsWith('pilih pekerjaan ')) {
                const chosenJob = cmd.substring('pilih pekerjaan '.length);
                const validJobs = ['shaman', 'prajurit', 'cendekiawan', 'penjelajah'];
                if (validJobs.includes(chosenJob)) {
                    gameData.player.job = chosenJob;
                    addOutput(`Anda sekarang adalah seorang ${chosenJob}! Perjalanan Anda akan berubah.`, 'text-green-400');
                    commandInput.onkeydown = handleCommandInput; // Kembalikan event listener normal
                } else {
                    addOutput('Pekerjaan tidak valid. Pilih dari Shaman, Prajurit, Cendekiawan, Penjelajah.', 'text-red-400');
                }
            } else {
                addOutput('Perintah tidak valid untuk pemilihan pekerjaan.', 'text-red-400');
            }
            commandInput.value = '';
        }
    };
}

function handleExamineCommand(target) {
    const currentLoc = gameData.locations[gameData.currentLocation];
    // Periksa makhluk di lokasi
    const creature = Object.values(gameData.creatures).find(c => c.name.toLowerCase() === target);
    if (creature && currentLoc.creatures.includes(creature.id)) {
        addOutput(`--- ${creature.name} ---`, 'text-purple-400');
        addOutput(`Deskripsi: ${creature.description}`);
        addOutput(`Makna: ${creature.symbolicMeaning}`);
        addOutput(`Kemampuan: ${creature.abilities}`);
        return;
    }

    // Periksa item di lokasi atau inventaris
    const itemInLoc = currentLoc.items && currentLoc.items.includes(target);
    const itemInInv = gameData.inventory.includes(target);
    if (itemInLoc || itemInInv) {
        // Contoh deskripsi item sederhana, bisa diperluas
        addOutput(`--- ${target.charAt(0).toUpperCase() + target.slice(1)} ---`, 'text-purple-400');
        addOutput(`Ini adalah ${target}. Tampaknya berguna.`);
        return;
    }

    addOutput(`Tidak dapat menemukan atau memeriksa ${target}.`, 'text-red-400');
}


// --- Event Listeners ---
function handleCommandInput(event) {
    if (event.key === 'Enter') {
        const command = commandInput.value.trim();
        if (command) {
            addOutput(`> ${command}`, 'text-blue-400'); // Tampilkan perintah pengguna
            parseCommand(command);
            commandInput.value = '';
        }
    }
}

submitButton.addEventListener('click', () => {
    const command = commandInput.value.trim();
    if (command) {
        addOutput(`> ${command}`, 'text-blue-400'); // Tampilkan perintah pengguna
        parseCommand(command);
        commandInput.value = '';
    }
});

commandInput.addEventListener('keydown', handleCommandInput);

// Event listeners for new LLM buttons
suggestQuestButton.addEventListener('click', handleSuggestQuest);
talkNpcButton.addEventListener('click', handleTalkNpc);
imagineButton.addEventListener('click', () => {
    const target = prompt("Apa yang ingin Anda bayangkan deskripsinya? (misal: naga, pedang kuno, kota tersembunyi)");
    if (target) {
        handleImagineCommand(target);
    }
});


// --- Inisialisasi Game ---
document.addEventListener('DOMContentLoaded', () => {
    addOutput('Memuat data game...', 'text-yellow-400');
    loadGameData();
    updateStatsDisplay();
    // Jika game sudah dimulai sebelumnya (misal dari localStorage), hitung EXP luring
    // Ini akan menjadi bagian dari integrasi backend yang sebenarnya
    // calculateOfflineExp(); // Akan dipanggil setelah pemain memilih gender
});

// Simpan status game (simulasi, sebenarnya akan ke backend)
window.addEventListener('beforeunload', () => {
    gameData.player.lastOnline = Date.now();
    // Di sini Anda akan mengirim gameData.player.lastOnline ke server
    // Untuk tujuan demo, tidak ada penyimpanan persisten di frontend
});
