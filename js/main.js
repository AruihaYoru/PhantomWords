// js/main.js

import { CharMarkovGenerator, WordMarkovGenerator } from './markov.js';
import { addShareButton } from './share.js';  
import { fetchTranslation, getTranslationConfig } from './translate.js';

// --- Configuration (Config) ---
const CONFIG_KEY = 'phantom_words_cfg';

// --- DOM Elements ---
const wordListContainer = document.getElementById('word-list-container');
const loader = document.getElementById('loader');
const infiniteLoader = document.getElementById('infinite-loader');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const scrollTrigger = document.getElementById('scroll-trigger');

// --- Global Variables ---
let wordGenerator;
let globalDefinitionGenerator;
let database;
let isLoading = false;
let generatedQueue = [];
const QUEUE_TARGET_SIZE = 15;
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

        // 設定UIの初期化
        initConfigUI();

        // 人名・ラベルデータの読み込み
        await loadFormattingData(); 
        console.log("Formatting data loaded:", {names: nameList.length, labels: labelList.length});
		
        // 軽量データベースの読み込み
        const lite_response = await fetch('./db/markov_db_lite.json');
        if (!lite_response.ok) throw new Error('Lite database could not be loaded.');
        const lite_database = await lite_response.json();
        
        // マルコフ生成器の初期化
        const lite_allWords = lite_database.map(entry => entry.word.toLowerCase());
        wordGenerator = new CharMarkovGenerator(lite_allWords, 3);

        const lite_allDefinitions = lite_database.map(entry => entry.definition);
        globalDefinitionGenerator = new WordMarkovGenerator(lite_allDefinitions, 2);

        // イベント設定
        addEventListeners();
        initializePullToRefresh();
        
        // 共有された単語がある場合は、まずそれを最上位に表示する
        handleSharedWordFromUrl();

        // 初期ワードの生成と表示
        await generateAndDisplayInitialWords(5);

        // バックグラウンドでフルモデルにアップグレード
        upgradeModelsInBackground();

    } catch (error) {
        if (wordListContainer) wordListContainer.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
        console.error("Initialization failed:", error);
    }
}

/**
 * 外部の整形ルールファイルを読み込む
 * 空白行やトリミングを徹底し、置換優先順位のために「長い順」にソートしておく
 */
async function loadFormattingData() {
    try {
        const [namesText, labelsText] = await Promise.all([
            fetch('./db/beautify/name.txt').then(res => res.text()),
            fetch('./db/beautify/label.txt').then(res => res.text())
        ]);

        // 空行を除去し、長い文字列から順に並べる（部分一致による破壊を防ぐため）
        nameList = namesText.split(/\r?\n/)
            .map(s => s.trim())
            .filter(s => s !== "")
            .sort((a, b) => b.length - a.length);

        labelList = labelsText.split(/\r?\n/)
            .map(s => s.trim())
            .filter(s => s !== "")
            .sort((a, b) => b.length - a.length);

        console.log("Cleaned Formatting data:", { names: nameList.length, labels: labelList.length });
    } catch (e) {
        console.error("Formatting files load failed", e);
    }
}

/**
 * 設定UI（ドロワー内のチェックボックス）の初期化
 */
function initConfigUI() {
    const cfg = getTranslationConfig();
    const keys = ['remConj', 'addPer', 'repSemi', 'names', 'labels'];
    
    keys.forEach(key => {
        const el = document.getElementById(`cfg-${key}`);
        if (!el) return;
        el.checked = cfg[key];
        el.addEventListener('change', () => {
            const newCfg = getTranslationConfig();
            newCfg[key] = el.checked;
            localStorage.setItem(CONFIG_KEY, JSON.stringify(newCfg));
            console.log(`Config updated: ${key} = ${el.checked}`);
        });
    });
}


/**
 * 辞書風整形アルゴリズム
 */
function beautify(text) {
    if (!text) return "";
    let html = text;

    html = html.replace(/\r?\n/g, '<br>');

    labelList.forEach(label => {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
        html = html.replace(regex, `<span class="dict-marker">$&</span>`);
    });

    nameList.forEach(name => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu');
        html = html.replace(regex, `<span class="word-source">$&</span>`);
    });

    return html;
}
// =================================================================
//  データフェッチ & 表示
// =================================================================

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

/**
 * URLパラメータをチェックし、共有された単語があればリスト最上位に表示
 */
function handleSharedWordFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const word = urlParams.get('word');
    const define = urlParams.get('define');   // 日本語
    const english = urlParams.get('english'); // 英語

    if (word && define && english) {
        const card = createWordCard(word, english, define);
        if (wordListContainer) {
            wordListContainer.prepend(card); // リストの最上位に追加
            addShareButton(card, word, english, define);
            console.log("Shared word priority injection:", word);
        }
    }
}

async function generateAndDisplayInitialWords(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
        const newWord = wordGenerator.generate({ minLength: 5, maxLength: 12 });
        const newDef = globalDefinitionGenerator.generate({ maxWords: 20 });
        promises.push(fetchTranslation(newDef, nameList, labelList).then(res => res ? { word: newWord, en: res.original, ja: res.translated } : null));
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
        promises.push(fetchTranslation(newDef, nameList, labelList).then(res => res ? { word: newWord, en: res.original, ja: res.translated } : null));
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
        promises.push(fetchTranslation(newDef, nameList, labelList).then(res => res ? { word: newWord, en: res.original, ja: res.translated } : null));
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

// -------------------------------------------------------------------------------

/* ちょーちょーちょーじゅうよう！！！

cd "C:\Users\Mecat\Documents\github\PhantomWords"
git add .
git commit -m "ここに詳細を入力"
git push

*/

// -------------------------------------------------------------------------------