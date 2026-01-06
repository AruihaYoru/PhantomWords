// markov.js

/**
 * 渡された文字列の配列から文字ベースのマルコフ連鎖モデルを構築し、新しい単語を生成するクラス
 */
export class CharMarkovGenerator {
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
                    if (!this.transitions[state]) {
                        this.transitions[state] = [];
                    }
                    this.transitions[state].push(nextChar);
                }
            }
        });
    }

    generate(options = {}) {
        const { minLength = 5, maxLength = 30, prefix = '' } = options;

        let currentState;
        if (prefix && prefix.length >= this.order) {
            currentState = prefix.slice(-this.order);
        } else if (prefix) {
            // prefixが次数より短い場合、それに続く単語の開始部分を探す
            const possibleStarts = this.startStates.filter(s => s.startsWith(prefix));
            currentState = possibleStarts[Math.floor(Math.random() * possibleStarts.length)] || this.startStates[Math.floor(Math.random() * this.startStates.length)];
        } else {
            currentState = this.startStates[Math.floor(Math.random() * this.startStates.length)];
        }

        let result = prefix ? prefix : currentState;

        for (let i = 0; i < maxLength; i++) {
            const nextChars = this.transitions[currentState];
            if (!nextChars) break;

            const nextChar = nextChars[Math.floor(Math.random() * nextChars.length)];
            result += nextChar;
            currentState = result.slice(-this.order);

            if (result.length >= maxLength) break;
        }

        if (result.length < minLength) {
            return this.generate(options); // 短すぎる場合は再試行
        }
        return result.charAt(0).toUpperCase() + result.slice(1); // 先頭を大文字に
    }
}


/**
 * 渡された文章の配列から単語ベースのマルコフ連鎖モデルを構築し、新しい文章を生成するクラス
 */
export class WordMarkovGenerator {
    constructor(sentences, order = 2) {
        this.order = order;
        this.transitions = {};
        this.startStates = [];
        this._train(sentences);
    }

    _train(sentences) {
        sentences.forEach(sentence => {
            const words = sentence.trim().split(/\s+/);
            if (words.length >= this.order) {
                const startState = words.slice(0, this.order).join(' ');
                this.startStates.push(startState);

                for (let i = 0; i < words.length - this.order; i++) {
                    const state = words.slice(i, i + this.order).join(' ');
                    const nextWord = words[i + this.order];
                    if (!this.transitions[state]) {
                        this.transitions[state] = [];
                    }
                    this.transitions[state].push(nextWord);
                }
            }
        });
    }

    generate(options = {}) {
        const { maxWords = 25 } = options;
        if (this.startStates.length === 0) {
            return "Not enough data to generate a definition.";
        }
        
        let currentState = this.startStates[Math.floor(Math.random() * this.startStates.length)];
        let result = currentState.split(' ');

        for (let i = 0; i < maxWords; i++) {
            const nextWords = this.transitions[currentState];
            if (!nextWords) break;

            const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];
            result.push(nextWord);
            currentState = result.slice(-this.order).join(' ');
            
            if (result.length >= maxWords) break;
        }

        let sentence = result.join(' ');
        // 文の終わりを整える
        sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        if (!sentence.endsWith('.')) {
            sentence += '.';
        }
        return sentence;
    }
}