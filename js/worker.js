// このファイルはバックグラウンドで重い処理を行うためのものです。

// CharMarkovGeneratorのロジックをこちらにもコピーします。
class CharMarkovGenerator {
    constructor(words, order = 3) {
        this.order = order;
        this.transitions = {};
        this.startStates = [];
        this._train(words);
    }
    _train(words) {
        words.forEach(word => {
            if (word.length >= this.order) {
                this.startStates.push(word.substring(0, this.order));
                for (let i = 0; i < word.length - this.order; i++) {
                    const state = word.substring(i, i + this.order);
                    const nextChar = word.charAt(i + this.order);
                    if (!this.transitions[state]) this.transitions[state] = [];
                    this.transitions[state].push(nextChar);
                }
            }
        });
    }
}

// メインスレッドからメッセージを受け取ったときの処理
self.onmessage = function(e) {
    const allWords = e.data;
    console.log('Worker: Received word list, starting to build model...');
    
    // 重いモデル構築処理を実行
    const generator = new CharMarkovGenerator(allWords, 3);
    
    // 結果（モデルの内部データ）をメインスレッドに送り返す
    self.postMessage({
        transitions: generator.transitions,
        startStates: generator.startStates
    });
    console.log('Worker: Model built and sent back to main thread.');
};