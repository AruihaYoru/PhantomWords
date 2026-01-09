// 分離作業というか共有機能の一部とかはAI

const GAS_TRANSLATE_URL = 'https://script.google.com/macros/s/AKfycbxpoeura1CPne7fCYABiNOPxKMIaB-eKbNKrsXHWuHSb8KdmHY0AYr7n_S_gshJpckhRg/exec';
// 勝手に使ったら怒っちゃうぞ！！

export function getTranslationConfig() {
    const defaultSettings = {
        remConj: true, addPer: true, repSemi: true, names: true, labels: true
    };
    return JSON.parse(localStorage.getItem('phantom_words_cfg')) || defaultSettings;
}

/**
 * テキスト内にリストの単語が含まれているかチェックし、含まれるものだけを抽出する
 */
function filterRelevantData(text, list) {
    if (!text || !list || list.length === 0) return [];
    
    return list.filter(item => {
        // 正規表現で単語境界を考慮して検索（エスケープ処理付き）
        const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        return regex.test(text);
    });
}

/**
 * GAS翻訳APIを呼び出す
 */
export async function fetchTranslation(englishText, nameList, labelList) {
    const cfg = getTranslationConfig();
    const params = new URLSearchParams();
    params.append('q', englishText);
    
    if (cfg.remConj) params.append('remConj', 'true');
    if (cfg.addPer) params.append('addPer', 'true');
    if (cfg.repSemi) params.append('repSemi', 'true');

    // ★ ここが重要！文中にある単語だけを抜き出す
    if (cfg.names) {
        const relevantNames = filterRelevantData(englishText, nameList);
        if (relevantNames.length > 0) params.append('names', relevantNames.join(','));
    }
    
    if (cfg.labels) {
        const relevantLabels = filterRelevantData(englishText, labelList);
        if (relevantLabels.length > 0) params.append('labels', relevantLabels.join(','));
    }

    const requestUrl = `${GAS_TRANSLATE_URL}?${params.toString()}&_=${Date.now()}`;
    
    try {
        // fetchの際、GASはリダイレクトが発生するため、mode: 'cors'（デフォルト）で問題ないが、
        // URLがあまりに長いと失敗する。フィルタリングにより正常化される。
        const response = await fetch(requestUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json(); 
    } catch (error) {
        console.error("Translation API error:", error);
        return null;
    }
}