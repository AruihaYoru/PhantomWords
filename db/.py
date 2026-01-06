import json
import re
from collections import Counter

def extract_strict_labels(data):
    results = []
    # 修正された正規表現:
    # 1. カッコ開始 \(
    # 2. 大文字1つ [A-Z]
    # 3. 小文字またはドット、または特殊文字(öなど)が1〜10文字続く [a-z\.ö]{1,10}
    # 4. カッコ終了 \)
    # ※数字、スペース、ハイフンが含まれるものは一切無視します
    pattern = r"\([A-Z][a-z\.ö]{1,10}\)"

    def walk(obj):
        if isinstance(obj, dict):
            for v in obj.values(): walk(v)
        elif isinstance(obj, list):
            for i in obj: walk(i)
        elif isinstance(obj, str):
            matches = re.findall(pattern, obj)
            results.extend(matches)

    walk(data)
    return results

def main():
    file_path = 'markov_db.json'
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        found_labels = extract_strict_labels(data)
        counts = Counter(found_labels)
        
        # --- フィルタリング条件 ---
        # 1. 出現回数が 2回以上 のものに絞る（1回のみのノイズを排除）
        # 2. (He) や (II) などの短すぎる固有名詞っぽすぎるものを除外
        filtered_results = {
            label: count for label, count in counts.items() 
            if count >= 2 and len(label) > 3
        }

        # 出現回数順に並び替え
        sorted_results = sorted(filtered_results.items(), key=lambda x: x[1], reverse=True)

        print(f"--- 厳選された分類ラベル ({len(sorted_results)}種類) ---")
        for label, count in sorted_results:
            print(f"{label:<15}")
            
    except Exception as e:
        print(f"エラー: {e}")

if __name__ == "__main__":
    main()