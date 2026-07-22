let players = [];
let roles = [];
let assignedRoles = [];
let currentRegisterIndex = 0;
let activeVideoStream = null;
let playerFaceSignatures = {}; // Üz imzalarını saxlamaq üçün
let verifyTimeout = null;

const roleEmojis = { 'Vətəndaş': '👤', 'Polis': '👮‍♂️', 'Oğru': '🥷' };

function playSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        if (type === 'sos') {
            for (let i = 0; i < 4; i++) {
                let osc = ctx.createOscillator();
                let gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(800, ctx.currentTime + i*0.4);
                osc.frequency.linearRampToValueAtTime(1300, ctx.currentTime + i*0.4 + 0.2);
                osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + i*0.4 + 0.4);
                gain.gain.setValueAtTime(0.4, ctx.currentTime + i*0.4);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i*0.4 + 0.4);
                osc.start(ctx.currentTime + i*0.4); osc.stop(ctx.currentTime + i*0.4 + 0.4);
            }
            return;
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(type === 'open' ? 600 : 400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(type === 'open' ? 150 : 100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
}

function generateRolesArray() {
    let generatedRoles = [];
    ['Vətəndaş', 'Polis', 'Oğru'].forEach(id => {
        const count = parseInt(document.getElementById('count-' + id).value) || 0;
        for (let i = 0; i < count; i++) generatedRoles.push(id);
    });
    return generatedRoles;
}

function startTheGame() {
    const namesText = document.getElementById('playerNamesInput').value;
    roles = generateRolesArray();

    if (!namesText.trim()) return alert("Oyunçu adlarını doldurun!");
    players = namesText.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (roles.length === 0) return alert("Ən azı bir rol dax il edin!");
    if (players.length !== roles.length) return alert("Oyunçu sayı ilə rolların cəmi bərabər olmalıdır!");

    document.getElementById('setupForm').style.display = 'none';
    
    currentRegisterIndex = 0;
    playerFaceSignatures = {};
    document.getElementById('faceRegisterSection').style.display = 'block';
    startCamera('registerVideo');
    updateRegisterUI();
}

function updateRegisterUI() {
    if (currentRegisterIndex < players.length) {
        document.getElementById('registerTitle').innerText = "Üz qeydiyyatı: " + players[currentRegisterIndex];
    } else {
        stopCamera();
        document.getElementById('faceRegisterSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        document.getElementById('endGameBtn').style.display = "block";
        mixAndAssignRoles();
    }
}

async function startCamera(videoId) {
    if (activeVideoStream) stopCamera();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
        const video = document.getElementById(videoId);
        if (video) {
            video.srcObject = stream;
            activeVideoStream = stream;
        }
    } catch (err) {
        console.log("Kamera icazəsi gözlənilir...");
    }
}

function stopCamera() {
    if (activeVideoStream) {
        activeVideoStream.getTracks().forEach(track => track.stop());
        activeVideoStream = null;
    }
}

// Kameradakı üz görüntüsünün riyazi hash dəyərini yadda saxlayır
function captureFaceRegistration() {
    const video = document.getElementById('registerVideo');
    const playerName = players[currentRegisterIndex];
    
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        // Sürətli və donmayan parlaqlıq xəritəsi (imza) yaradırıq
        let signature = [];
        for (let i = 0; i < imgData.length; i += 4) {
            let brightness = (imgData[i] + imgData[i+1] + imgData[i+2]) / 3;
            signature.push(Math.round(brightness / 10) * 10);
        }
        
        playerFaceSignatures[playerName] = signature;
        playSound('open');
        currentRegisterIndex++;
        updateRegisterUI();
    } catch(e) {
        // Əgər kamera tam hazır deyilsə asinxron olaraq 200ms gözləyib yenidən çəkir
        setTimeout(captureFaceRegistration, 200);
    }
}

function mixAndAssignRoles() {
    let newAssignedRoles = new Array(players.length).fill(null);
    let rolePool = [...roles];

    if (assignedRoles && assignedRoles.length === players.length) {
        players.forEach((player, index) => {
            const prevRole = assignedRoles[index];
            let retentionChance = prevRole === 'Vətəndaş' ? 0.45 : 0.20;

            if (Math.random() < retentionChance) {
                const poolIndex = rolePool.indexOf(prevRole);
                if (poolIndex !== -1) {
                    newAssignedRoles[index] = prevRole;
                    rolePool.splice(poolIndex, 1);
                }
            }
        });
    }

    for (let i = rolePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = rolePool[i]; rolePool[i] = rolePool[j]; rolePool[j] = temp;
    }

    players.forEach((player, index) => {
        if (newAssignedRoles[index] === null) newAssignedRoles[index] = rolePool.pop();
    });

    assignedRoles = newAssignedRoles;
    renderGameBoard();
}

function renderGameBoard() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = "";
    
    players.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'player-row';
        row.innerHTML = '<span class="player-name">' + (index + 1) + '. ' + player + '</span>' +
                        '<button class="reveal-btn" id="btn-' + index + '" data-state="hidden">Rolumu Göstər</button>';
        
        row.querySelector('.reveal-btn').addEventListener('click', () => handleRoleToggle(index, player));
        board.appendChild(row);
    });
}

async function handleRoleToggle(index, playerName) {
    const btn = document.getElementById('btn-' + index);
    const currentState = btn.getAttribute('data-state');
    
    if (currentState === "hidden") {
        const scanner = document.getElementById('verificationScanner');
        document.getElementById('scannerTitle').innerText = playerName + " üçün Face ID...";
        scanner.style.display = 'block';
        await startCamera('verifyVideo');

        if (verifyTimeout) clearTimeout(verifyTimeout);

        // Kamera tam açıldıqdan 1.5 saniyə sonra real üz müqayisəsi aparır
        verifyTimeout = setTimeout(() => {
            const verifyVideo = document.getElementById('verifyVideo');
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            
            try {
                ctx.drawImage(verifyVideo, 0, 0, canvas.width, canvas.height);
                const currentImgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                
                stopCamera();
                scanner.style.display = 'none';

                let currentSignature = [];
                for (let i = 0; i < currentImgData.length; i += 4) {
                    let brightness = (currentImgData[i] + currentImgData[i+1] + currentImgData[i+2]) / 3;
                    currentSignature.push(Math.round(brightness / 10) * 10);
                }

                // Köhnə və yeni üz imzalarını müqayisə edirik
                const originalSignature = playerFaceSignatures[playerName];
                let matches = 0;
                for (let i = 0; i < currentSignature.length; i++) {
                    if (Math.abs(currentSignature[i] - originalSignature[i]) <= 20) matches++;
                }
                
                let matchRatio = matches / currentSignature.length;

                // Əgər baxan adam eyni adamdırsa rolu müvafiq rənglərlə açır
                if (matchRatio > 0.40) { 
                    playSound('open');
                    const currentRole = assignedRoles[index];
                    const emoji = roleEmojis[currentRole] || '👁️';
                    btn.innerText = emoji + " " + currentRole;
                    
                    if (currentRole === 'Polis') btn.style.background = "#2980b9";
                    else if (currentRole === 'Oğru') btn.style.background = "#c0392b";
                    else if (currentRole === 'Vətəndaş') btn.style.background = "#27ae60";
                    
                    btn.setAttribute('data-state', 'visible');
                } else {
                    // ƏGƏR ÜZ SƏHVDİRSƏ ROLU ASLA AÇMIR VƏ GÜCLÜ SOS VERİR
                    playSound('sos');
                    alert("🚨 FACE ID XƏTASI: Səhv Üz Tesbit Edildi! Rolunuz Kilidləndi! 🚨");
                }
            } catch(e) {
                stopCamera();
                scanner.style.display = 'none';
                alert("Skaner xətası baş verdi, yenidən klikləyin!");
            }
        }, 1500);

    } else {
