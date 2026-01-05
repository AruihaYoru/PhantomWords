import json
import re
import time

def clean_definition(text):
    """辞書の定義文をクリーンアップして整形する関数"""
    text = text.replace('\n', ' ')
    text = re.sub(r'See [A-Z][a-z]+\.', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\s--\s.*', '', text)
    text = re.sub(r';\s--\s.*', '', text)
    text = text.replace('"', '')
    text = re.sub(r'\b\d+\.\s', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    parts = text.split('. ')
    if len(parts) > 1:
        last_part = parts[-1].strip()
        if len(last_part.split()) <= 3 and last_part and last_part[0].isupper():
            text = '. '.join(parts[:-1]) + '.'
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# --- メイン処理 ---

INPUT_FILENAME = 'dictionary.json'
OUTPUT_FILENAME = 'markov_db.json'
PROGRESS_INTERVAL = 10000 

print("=" * 40)
print(" Lexicogenesis - Markov Chain DB Parser")
print("=" * 40)

start_time = time.time()

print(f"[{time.strftime('%H:%M:%S')}] 辞書ファイル ({INPUT_FILENAME}) を読み込んでいます...")
try:
    with open(INPUT_FILENAME, 'r', encoding='utf-8') as f:
        original_dict = json.load(f)
except FileNotFoundError:
    print(f"エラー: {INPUT_FILENAME} が見つかりません。スクリプトを終了します。")
    exit()
except json.JSONDecodeError:
    print(f"エラー: {INPUT_FILENAME} の形式が正しくありません。スクリプトを終了します。")
    exit()

print(f"[{time.strftime('%H:%M:%S')}] 読み込み完了。{len(original_dict):,} 件のデータを処理します。")

processed_data = []
total_count = len(original_dict)
processed_count = 0
skipped_count = 0

for word, definition in original_dict.items():
    processed_count += 1
    cleaned_def = clean_definition(definition)

    if cleaned_def and len(cleaned_def.split()) > 1:
        processed_data.append({
            "word": word,
            "definition": cleaned_def
        })
    else:
        skipped_count += 1
    
    if processed_count % PROGRESS_INTERVAL == 0 or processed_count == total_count:
        print(f"[{time.strftime('%H:%M:%S')}] 進捗: {processed_count:,} / {total_count:,} 件処理済み...")

print(f"[{time.strftime('%H:%M:%S')}] 処理済みデータを {OUTPUT_FILENAME} に書き出しています...")
try:
    with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as f:
        json.dump(processed_data, f, indent=2, ensure_ascii=False)
except Exception as e:
    print(f"エラー: ファイルの書き出し中に問題が発生しました - {e}")
    exit()

import random

# 軽量版データベースの作成
LITE_FILENAME = 'markov_db_lite.json'
LITE_SAMPLE_SIZE = 500  # 最初に読み込む件数 (500件くらいが品質と速度のバランスが良い)

print(f"[{time.strftime('%H:%M:%S')}] 軽量版データベース ({LITE_FILENAME}) を作成しています...")
if len(processed_data) > LITE_SAMPLE_SIZE:
    lite_data = random.sample(processed_data, LITE_SAMPLE_SIZE)
else:
    lite_data = processed_data # データが少ない場合は全部使う

with open(LITE_FILENAME, 'w', encoding='utf-8') as f:
    json.dump(lite_data, f, indent=2, ensure_ascii=False)


end_time = time.time()
processing_time = end_time - start_time

print(f"[{time.strftime('%H:%M:%S')}] 書き出し完了。")
print("-" * 40)
print("            処理結果サマリー")
print("-" * 40)
print(f"処理時間: {processing_time:.2f} 秒")
print(f"元のデータ数: {total_count:,} 件")
print(f"処理後のデータ数: {len(processed_data):,} 件")
print(f"除外されたデータ数: {skipped_count:,} 件")
print(f"\n成功！マルコフ連鎖用のデータベース '{OUTPUT_FILENAME}' が生成されました。")
print("=" * 40)