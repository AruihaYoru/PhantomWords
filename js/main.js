// js/main.js

import { CharMarkovGenerator, WordMarkovGenerator } from './markov.js';
import { addShareButton } from './share.js';  

const GAS_TRANSLATE_URL = 'https://script.google.com/macros/s/AKfycbwWfi0AHnbu3El2UCejFLYbPqyl-gUThcKevKOvO2dN20wG4YTAs-F6CnJqiZZbl4POtQ/exec';
// 勝手に使ったら怒っちゃうぞ！！

// --- DOM Elements ---
const wordListContainer = document.getElementById('word-list-container');
const loader = document.getElementById('loader');
const infiniteLoader = document.getElementById('infinite-loader');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const scrollTrigger = document.getElementById('scroll-trigger');
const suggestionsList = document.getElementById('suggestions-list');

// --- Global Variables ---
let wordGenerator;
let globalDefinitionGenerator;
let database;
let isLoading = false;
let generatedQueue = [];
const QUEUE_TARGET_SIZE = 15;
let debounceTimer;
let currentSearchPrefix = '';

// 整形用データ
let nameList = [];
let labelList = [];

// =================================================================
//  メインロジック (Entry Point)
// =================================================================
if (wordListContainer) {
    initialize();
}
async function initialize() {
    try {
        if (loader) loader.style.display = 'block';

        await loadFormattingData(); 
        console.log("Formatting data loaded:", {names: nameList.length, labels: labelList.length});
		
        const lite_response = await fetch('./db/markov_db_lite.json');
        if (!lite_response.ok) throw new Error('Lite database could not be loaded.');
        const lite_database = await lite_response.json();
        
        const lite_allWords = lite_database.map(entry => entry.word.toLowerCase());
        wordGenerator = new CharMarkovGenerator(lite_allWords, 3);

        const lite_allDefinitions = lite_database.map(entry => entry.definition);
        globalDefinitionGenerator = new WordMarkovGenerator(lite_allDefinitions, 2);

        addEventListeners();
        initializePullToRefresh();
        
        await generateAndDisplayInitialWords(5);

        upgradeModelsInBackground();

    } catch (error) {
        if (wordListContainer) wordListContainer.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
        console.error("Initialization failed:", error);
    }
}

/**
 * 外部の整形ルールファイルを読み込む
 */
async function loadFormattingData() {
    try {
        const [namesText, labelsText] = await Promise.all([
            fetch('./db/beautify/name.txt').then(res => res.text()),
            fetch('./db/beautify/label.txt').then(res => res.text())
        ]);
        nameList = namesText.split(/\r?\n/).map(s => s.trim()).filter(s => s);
        labelList = labelsText.split(/\r?\n/).map(s => s.trim()).filter(s => s);
    } catch (e) {
        console.error("Formatting files load failed", e);
    }
}

/**
 * 辞書風整形アルゴリズム
 */
function beautify(text) {
    if (!text) return "";
    let html = text;

    // ★ 改行を <br> に変換（最重要）
    html = html.replace(/\r?\n/g, '<br>');

    // A. 【改行】 (a) や i, ii などの前で改行
    html = html.replace(/(\([a-z]\)|\bi+\b)/gi, '<br>$1');

    // B. 【イニシャル・名前】 指定の5パターンを透明度 0.2 に
    // 正規表現で一気に処理（長いパターンから順にマッチさせる）
    const nameRegex = /([Ss]ir\s[A-Z]\.\s[A-Z][a-z]+|Sir\s[A-Z]\.\s[A-Z]\.|Sir\s[A-Z]\.|[A-Z]\.\s[A-Z]\.|\b[A-Z][A-Z]\.|\b[A-Z]\.)/g;
    html = html.replace(nameRegex, '<span style="opacity: 0.2;">$1</span>');

    // C. 【ラベル】 label.txt の中身があれば bold + italic
    // 翻訳されてカッコが全角「（）」になっていても反応するように対応
    labelList.forEach(label => {
        // label.txt の内容をエスケープ
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 半角・全角両方のカッコに対応する正規表現
        const labelPattern = escaped.replace('\\(', '[\\(（]').replace('\\)', '[\\)）]');
        const regex = new RegExp(`(${labelPattern})`, 'g');
        
        html = html.replace(regex, '<i><b>$1</b></i>');
    });

    return html;
}

// =================================================================
//  データフェッチ & 表示
// =================================================================

async function fetchTranslation(englishText) {
    const requestUrl = `${GAS_TRANSLATE_URL}?q=${encodeURIComponent(englishText)}&_=${Date.now()}`;
    try {
        const response = await fetch(requestUrl);
        if (!response.ok) return null;
        return await response.json(); 
    } catch (error) {
        console.error("Translation error:", error);
        return null;
    }
}

function createWordCard(word, definitionEn, definitionJa) {
    const card = document.createElement('article');
    card.className = 'word-card';
    
    const beautifulEn = beautify(definitionEn);
    const beautifulJa = beautify(definitionJa);

    card.innerHTML = `
        <div class="word-header">
            <h2 class="word">${word}</h2>
        </div>
        <div class="definition">
            <p class="original-def">${beautifulEn}</p>
            <p class="translated-def">${beautifulJa}</p> 
        </div>
    `;
    return card;
}

async function generateAndDisplayInitialWords(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12 });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        promises.push(fetchTranslation(newDef).then(res => res ? { word: newWord, en: res.original, ja: res.translated } : null));
    }
    const results = await Promise.all(promises);
    results.forEach(item => {
        if (item) {
            const card = createWordCard(item.word, item.en, item.ja);
            wordListContainer.appendChild(card);
            addShareButton(card, item.word, item.en, item.ja);
        }
    });
    if (loader) loader.style.display = 'none';
    fillQueueIfNeeded();
}

function displayWordsFromQueue(count) {
    const items = generatedQueue.splice(0, count);
    items.forEach(item => {
        const card = createWordCard(item.word, item.en, item.ja);
        wordListContainer.appendChild(card);
        addShareButton(card, item.word, item.en, item.ja);
    });
    fillQueueIfNeeded();
}

async function fillQueueIfNeeded() {
    if (isLoading || generatedQueue.length >= QUEUE_TARGET_SIZE) return;
    isLoading = true;
    const promises = [];
    for (let i = 0; i < QUEUE_TARGET_SIZE - generatedQueue.length; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12, prefix: currentSearchPrefix });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        promises.push(fetchTranslation(newDef).then(res => res ? { word: newWord, en: res.original, ja: res.translated } : null));
    }
    const results = await Promise.all(promises);
    results.forEach(item => { if (item) generatedQueue.push(item); });
    isLoading = false;
}

// =================================================================
//  その他のユーティリティ (検索・無限スクロール等)
// =================================================================

async function handleSearch() {
    const prefix = searchInput.value.trim().toLowerCase();
    currentSearchPrefix = prefix;
    generatedQueue = [];
    wordListContainer.innerHTML = '';
    if (loader) loader.style.display = 'block';

    const promises = [];
    for (let i = 0; i < 5; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12, prefix });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        promises.push(fetchTranslation(newDef).then(res => res ? { word: newWord, en: res.original, ja: res.translated } : null));
    }
    const results = await Promise.all(promises);
    results.forEach(item => {
        if (item) {
            const card = createWordCard(item.word, item.en, item.ja);
            wordListContainer.appendChild(card);
            addShareButton(card, item.word, item.en, item.ja);
        }
    });
    if (loader) loader.style.display = 'none';
}

function addEventListeners() {
    if (searchButton) searchButton.addEventListener('click', handleSearch);
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
    }
    if (scrollTrigger) {
        new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading) handleInfiniteScroll();
        }).observe(scrollTrigger);
    }
}

async function handleInfiniteScroll() {
    if (generatedQueue.length === 0) {
        if (infiniteLoader) infiniteLoader.style.display = 'block';
        await fillQueueIfNeeded();
        if (infiniteLoader) infiniteLoader.style.display = 'none';
    }
    displayWordsFromQueue(5);
}

function initializePullToRefresh() {
    if (window.PullToRefresh) {
        PullToRefresh.init({ mainElement: 'body', onRefresh: () => location.reload() });
    }
}

async function upgradeModelsInBackground() {
    try {
        const full_response = await fetch('./db/markov_db.json');
        database = await full_response.json();
        const worker = new Worker('./js/worker.js');
        worker.postMessage(database.map(entry => entry.word.toLowerCase()));
        worker.onmessage = (e) => {
            const fullWordGenerator = new CharMarkovGenerator([], 3);
            fullWordGenerator.transitions = e.data.transitions;
            fullWordGenerator.startStates = e.data.startStates;
            wordGenerator = fullWordGenerator;
        };
        globalDefinitionGenerator = new WordMarkovGenerator(database.map(entry => entry.definition), 2);
    } catch (error) {
        console.error("Background upgrade failed:", error);
    }
}