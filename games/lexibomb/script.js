// Configuração das Dificuldades (Básico facilitado: mais tempo e menor meta)
const DIFFICULTIES = {
    basico: { name: "Básico", time: 20, target: 3, next: 'medio' },
    medio: { name: "Médio", time: 10, target: 6, next: 'dificil' },
    dificil: { name: "Difícil", time: 7, target: 10, next: 'impossivel' },
    impossivel: { name: "Impossível", time: 4.5, target: 15, next: null }
};

let gameState = {
    currentDiff: null,
    maxTime: 0,
    targetScore: 0,
    score: 0,
    currentSyllable: "",
    usedWords: [],
    timerInterval: null,
    dictionary: new Set(),       // Dicionário original (com acentos)
    normalizedDict: new Set(),   // Dicionário limpo (sem acentos para busca flexível)
    dynamicSyllables: []
};

let unlockedLevels = JSON.parse(localStorage.getItem('lexibomb_unlocked')) || {
    basico: true,
    medio: false,
    dificil: false,
    impossivel: false
};

const elements = {
    introScreen: document.getElementById('intro-screen'),
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    goToDiffBtn: document.getElementById('goToDiffBtn'),
    backToIntroBtn: document.getElementById('backToIntroBtn'),
    backToMenuBtn: document.getElementById('backToMenuBtn'),
    syllableDisplay: document.getElementById('syllableDisplay'),
    timerBar: document.getElementById('timerBar'),
    wordInput: document.getElementById('wordInput'),
    scoreCount: document.getElementById('scoreCount'),
    targetCount: document.getElementById('targetCount'),
    currentLevelName: document.getElementById('currentLevelName'),
    historyTags: document.getElementById('historyTags'),
    levelCards: document.querySelectorAll('.level-card')
};

document.addEventListener('DOMContentLoaded', async () => {
    updateDashboardUI();
    initEventListeners();
    await loadDictionaryAndGenerateSyllables();
});

// Função mágica para remover acentos de qualquer palavra
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function loadDictionaryAndGenerateSyllables() {
    try {
        let response = await fetch('palavras.txt');
        if (!response.ok) throw new Error("Arquivo não encontrado");
        
        let text = await response.text();
        let wordsArray = text.split('\n').map(w => w.trim().toUpperCase());
        
        let syllablesSet = new Set();

        wordsArray.forEach(word => {
            if (word.length >= 3) {
                gameState.dictionary.add(word);
                
                // Cria também a versão sem acento para validação flexível
                let cleanWord = removeAccents(word);
                gameState.normalizedDict.add(cleanWord);

                // Gera fragmentos dinâmicos baseados nas palavras reais (sem acento para facilitar)
                for (let i = 0; i <= cleanWord.length - 2; i++) {
                    let chunk = cleanWord.substring(i, i + 2);
                    if (chunk.length === 2 && /^[A-Z]+$/.test(chunk)) {
                        syllablesSet.add(chunk);
                    }
                }
                for (let i = 0; i <= cleanWord.length - 3; i++) {
                    let chunk3 = cleanWord.substring(i, i + 3);
                    if (chunk3.length === 3 && /^[A-Z]+$/.test(chunk3)) {
                        syllablesSet.add(chunk3);
                    }
                }
            }
        });

        gameState.dynamicSyllables = Array.from(syllablesSet);
        console.log(`Dicionário carregado! ${gameState.dictionary.size} palavras e ${gameState.dynamicSyllables.length} sílabas geradas.`);
    } catch (error) {
        console.warn("Erro ao carregar o 'palavras.txt'. Usando fallback de segurança.");
        gameState.dynamicSyllables = ["AR", "TO", "IN", "AS", "ES", "RA", "TA"];
    }
}

function initEventListeners() {
    elements.goToDiffBtn.addEventListener('click', () => switchScreen(elements.introScreen, elements.menuScreen));
    elements.backToIntroBtn.addEventListener('click', () => switchScreen(elements.menuScreen, elements.introScreen));
    elements.backToMenuBtn.addEventListener('click', () => quitToDashboard());

    elements.levelCards.forEach(card => {
        card.addEventListener('click', () => {
            const diff = card.getAttribute('data-diff');
            if (unlockedLevels[diff]) {
                startSession(diff);
            }
        });
    });

    elements.wordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            processWordSubmission();
        }
    });
}

function switchScreen(from, to) {
    from.classList.remove('active');
    to.classList.add('active');
}

function updateDashboardUI() {
    elements.levelCards.forEach(card => {
        const diff = card.getAttribute('data-diff');
        const statusSpan = card.querySelector('.lvl-status');
        
        if (unlockedLevels[diff]) {
            card.removeAttribute('disabled');
            statusSpan.textContent = "Disponível ✓";
            statusSpan.style.color = "var(--success)";
        } else {
            card.setAttribute('disabled', 'true');
            statusSpan.textContent = "Bloqueado 🔒";
            statusSpan.style.color = "var(--text-muted)";
        }
    });
}

function startSession(diffKey) {
    const config = DIFFICULTIES[diffKey];
    
    gameState.currentDiff = diffKey;
    gameState.maxTime = config.time;
    gameState.targetScore = config.target;
    gameState.score = 0;
    gameState.usedWords = [];

    elements.currentLevelName.textContent = config.name;
    elements.scoreCount.textContent = gameState.score;
    elements.targetCount.textContent = gameState.targetScore;
    
    renderHistory();
    switchScreen(elements.menuScreen, elements.gameScreen);
    nextRound();
}

function nextRound() {
    const list = gameState.dynamicSyllables.length > 0 ? gameState.dynamicSyllables : ["AR", "TO", "IN"];
    const randomIndex = Math.floor(Math.random() * list.length);
    
    gameState.currentSyllable = list[randomIndex];
    elements.syllableDisplay.textContent = gameState.currentSyllable;
    
    elements.wordInput.value = '';
    elements.wordInput.focus();

    clearInterval(gameState.timerInterval);
    let startTime = Date.now();

    gameState.timerInterval = setInterval(() => {
        let elapsedTime = (Date.now() - startTime) / 1000;
        let timeLeft = gameState.maxTime - elapsedTime;
        let percentage = (timeLeft / gameState.maxTime) * 100;

        elements.timerBar.style.width = `${Math.max(percentage, 0)}%`;

        if (timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            alert("💥 Tempo esgotado! A bomba explodiu.");
            quitToDashboard();
        }
    }, 30);
}

function processWordSubmission() {
    let rawWord = elements.wordInput.value.trim().toUpperCase();

    if (rawWord === "") return;

    if (rawWord.length < 3) {
        triggerInputError("A palavra deve ter no mínimo 3 letras.");
        return;
    }

    if (rawWord === gameState.currentSyllable) {
        triggerInputError("Digite uma palavra real que contenha o trecho, não apenas as letras!");
        return;
    }

    if (!rawWord.includes(gameState.currentSyllable)) {
        triggerInputError(`A palavra precisa conter "${gameState.currentSyllable}"!`);
        return;
    }

    if (gameState.usedWords.includes(rawWord)) {
        triggerInputError(`A palavra "${rawWord}" já foi usada nesta partida!`);
        return;
    }

    // Normaliza a palavra digitada removendo acentos para checar no dicionário limpo
    let cleanInputWord = removeAccents(rawWord);

    if (gameState.normalizedDict.size > 0 && !gameState.normalizedDict.has(cleanInputWord)) {
        triggerInputError(`"${rawWord}" não foi encontrada no dicionário oficial!`);
        return;
    }

    // Sucesso! Registra a palavra original com acento (se houver) ou limpa
    gameState.usedWords.push(rawWord);
    gameState.score++;
    
    elements.scoreCount.textContent = gameState.score;
    renderHistory();

    if (gameState.score >= gameState.targetScore) {
        clearInterval(gameState.timerInterval);
        alert(`🏆 Incrível! Você completou o nível ${DIFFICULTIES[gameState.currentDiff].name}.`);
        unlockNextLevel();
        quitToDashboard();
    } else {
        nextRound();
    }
}

function renderHistory() {
    elements.historyTags.innerHTML = "";
    if (gameState.usedWords.length === 0) {
        elements.historyTags.innerHTML = `<span class="empty-history">Nenhuma palavra...</span>`;
        return;
    }
    gameState.usedWords.forEach(w => {
        const tag = document.createElement('span');
        tag.className = 'word-tag';
        tag.textContent = w;
        elements.historyTags.appendChild(tag);
    });
}

function triggerInputError(message) {
    alert(message);
    elements.wordInput.style.borderColor = "var(--danger)";
    setTimeout(() => { elements.wordInput.style.borderColor = "var(--border-color)"; }, 400);
    elements.wordInput.value = '';
    elements.wordInput.focus();
}

function unlockNextLevel() {
    let nextKey = DIFFICULTIES[gameState.currentDiff].next;
    if (nextKey && !unlockedLevels[nextKey]) {
        unlockedLevels[nextKey] = true;
        localStorage.setItem('lexibomb_unlocked', JSON.stringify(unlockedLevels));
    }
}

function quitToDashboard() {
    clearInterval(gameState.timerInterval);
    switchScreen(elements.gameScreen, elements.menuScreen);
    updateDashboardUI();
}