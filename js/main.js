// js/main.js

import { CharMarkovGenerator, WordMarkovGenerator } from './markov.js';
import { addShareButton } from './share.js'; 

// 翻訳用
const GAS_TRANSLATE_URL = 'https://script.google.com/macros/s/AKfycbxT28JWhJC3tuNzJeQz8M2pBUhI-f18hwwX2x8oDyDm0JNWNUD7VzWsIUpMJmCDcMmupA/exec';
// 勝手に使ったら怒っちゃうぞ！

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

// =================================================================
//  メインロジック (Entry Point)
// =================================================================
if (wordListContainer) {
    initialize();
}

/**
 * アプリケーションの初期化 (二段階読み込み)
 */
async function initialize() {
    try {
        if (loader) loader.style.display = 'block';

        console.log("Phase 1: Starting with lite database...");
        const lite_response = await fetch('./db/markov_db_lite.json');
        if (!lite_response.ok) throw new Error('Lite database could not be loaded.');
        const lite_database = await lite_response.json();
        
        const lite_allWords = lite_database.map(entry => entry.word.toLowerCase());
        wordGenerator = new CharMarkovGenerator(lite_allWords, 3);

        const lite_allDefinitions = lite_database.map(entry => entry.definition);
        globalDefinitionGenerator = new WordMarkovGenerator(lite_allDefinitions, 2);

        console.log("Main: Lite generators are ready!");
        addEventListeners();
        initializePullToRefresh();
        
        await generateAndDisplayInitialWords(5);
        console.log("Phase 1: Initial words displayed.");

        console.log("Phase 2: Starting background upgrade to full models...");
        upgradeModelsInBackground();

    } catch (error) {
        if (wordListContainer) wordListContainer.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
        console.error("Initialization failed:", error);
    }
}

/**
 * バックグラウンドで完全版のモデルを構築し、準備ができたら差し替える
 */
async function upgradeModelsInBackground() {
    try {
        const full_response = await fetch('./db/markov_db.json');
        database = await full_response.json();

        const worker = new Worker('./js/worker.js');
        const full_allWords = database.map(entry => entry.word.toLowerCase());
        worker.postMessage(full_allWords);

        worker.onmessage = (e) => {
            const fullWordGenerator = new CharMarkovGenerator([], 3);
            fullWordGenerator.transitions = e.data.transitions;
            fullWordGenerator.startStates = e.data.startStates;
            wordGenerator = fullWordGenerator;
            console.log("Background Upgrade: Full Word Generator is ready!");
        };
        
        const full_allDefinitions = database.map(entry => entry.definition);
        globalDefinitionGenerator = new WordMarkovGenerator(full_allDefinitions, 2);
        console.log("Background Upgrade: Full Definition Generator is ready!");

    } catch (error) {
        console.error("Background model upgrade failed:", error);
    }
}


// =================================================================
//  イベントリスナー設定
// =================================================================
function addEventListeners() {
    if (searchButton) searchButton.addEventListener('click', handleSearch);
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
        searchInput.addEventListener('input', handleSuggest);
        searchInput.addEventListener('blur', () => { setTimeout(() => { if (suggestionsList) suggestionsList.style.display = 'none' }, 150); });
    }
    if (scrollTrigger) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading) {
                handleInfiniteScroll();
            }
        });
        observer.observe(scrollTrigger);
    }
}

function initializePullToRefresh() {
    if (window.PullToRefresh) {
        PullToRefresh.init({
            mainElement: 'body',
            onRefresh: () => {
                wordListContainer.innerHTML = '';
                generatedQueue = [];
                initialize();
            }
        });
    }
}

// =================================================================
//  単語生成 & 表示ロジック
// =================================================================
async function generateAndDisplayInitialWords(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12 });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        
        const promise = fetchTranslation(newDef).then(translatedDef => {
            if (translatedDef) return { word: newWord, definition: newDef, translated: translatedDef };
            return null;
        });
        promises.push(promise);
    }
    const initialWords = await Promise.all(promises);
    
    initialWords.forEach(item => {
        if (item) {
            const wordCard = createWordCard(item.word, item.definition);
            wordListContainer.appendChild(wordCard);
            const translatedElement = wordCard.querySelector('.translated-def');
            translatedElement.textContent = item.translated;
            translatedElement.classList.remove('loading');
			
            addShareButton(wordCard, item.word, item.definition, item.translated);
        }
    });
    if (loader) loader.style.display = 'none';
    fillQueueIfNeeded();
}

async function handleInfiniteScroll() {
    if (generatedQueue.length === 0) {
        if (infiniteLoader) infiniteLoader.style.display = 'block';
        await fillQueueIfNeeded();
        if (infiniteLoader) infiniteLoader.style.display = 'none';
    }
    displayWordsFromQueue(5);
}

async function fillQueueIfNeeded() {
    if (isLoading || generatedQueue.length >= QUEUE_TARGET_SIZE) return;
    isLoading = true;

    const promises = [];
    const itemsToGenerate = QUEUE_TARGET_SIZE - generatedQueue.length;
    for (let i = 0; i < itemsToGenerate; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12 });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        const promise = fetchTranslation(newDef).then(translatedDef => {
            if (translatedDef) return { word: newWord, definition: newDef, translated: translatedDef };
            return null;
        });
        promises.push(promise);
    }
    const results = await Promise.all(promises);
    results.forEach(item => { if (item) generatedQueue.push(item); });
    isLoading = false;
}

async function fetchTranslation(englishText) {
    const requestUrl = `${GAS_TRANSLATE_URL}?q=${encodeURIComponent(englishText)}`;
    try {
        const response = await fetch(requestUrl);
        if (!response.ok) return "Translation failed.";
        const data = await response.json();
        return data.translated;
    } catch (error) {
        console.error("Translation error:", error);
        return "Translation failed.";
    }
}

function displayWordsFromQueue(count) {
    const wordsToDisplay = generatedQueue.splice(0, count);
    for (const item of wordsToDisplay) {
        const wordCard = createWordCard(item.word, item.definition);
        wordListContainer.appendChild(wordCard);
        
        const translatedElement = wordCard.querySelector('.translated-def');
        translatedElement.textContent = item.translated;
        translatedElement.classList.remove('loading');

        addShareButton(wordCard, item.word, item.definition, item.translated);
    }
    if (generatedQueue.length < QUEUE_TARGET_SIZE) {
        fillQueueIfNeeded();
    }
}

function createWordCard(word, definition) {
    const card = document.createElement('article');
    card.className = 'word-card';
    card.innerHTML = `
        <div class="word-header">
            <h2 class="word">${word}</h2>
        </div>
        <div class="definition">
            <p class="original-def">${definition}</p>
            <p class="translated-def loading"></p> 
        </div>
    `;
    return card;
}

// =================================================================
//  検索 & サジェストロジック
// =================================================================
async function handleSearch() {
    const prefix = searchInput.value.trim().toLowerCase();
    if (prefix.length < 2 || !wordGenerator) return;

    wordListContainer.innerHTML = '';
    if (loader) loader.style.display = 'block';

    const promises = [];
    for (let i = 0; i < 5; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12, prefix });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        promises.push(fetchTranslation(newDef).then(translatedDef => ({ word: newWord, definition: newDef, translated: translatedDef })));
    }
    const results = await Promise.all(promises);
    results.forEach(item => {
        const wordCard = createWordCard(item.word, item.definition);
        wordListContainer.appendChild(wordCard);
        const translatedElement = wordCard.querySelector('.translated-def');
        translatedElement.textContent = item.translated;
        translatedElement.classList.remove('loading');
    });
    
    if (loader) loader.style.display = 'none';
    searchInput.value = '';
}

function handleSuggest(e) {
    const prefix = e.target.value.trim().toLowerCase();
    if (!suggestionsList || !database) return;
    suggestionsList.innerHTML = '';
    
    if (prefix.length < 2) {
        suggestionsList.style.display = 'none';
        return;
    }

    clearTimeout(debounceTimer);
    suggestionsList.innerHTML = '<li><i>Searching...</i></li>';
    suggestionsList.style.display = 'block';

    debounceTimer = setTimeout(() => {
        const matches = database.filter(entry => entry.word.toLowerCase().startsWith(prefix)).slice(0, 5);
        suggestionsList.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(match => {
                const li = document.createElement('li');
                li.textContent = match.word;
                li.addEventListener('click', () => {
                    searchInput.value = match.word;
                    suggestionsList.style.display = 'none';
                    handleSearch();
                });
                suggestionsList.appendChild(li);
            });
        } else {
            suggestionsList.innerHTML = '<li>No matches found.</li>';
        }
    }, 300);
}