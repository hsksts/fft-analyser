# 🎚️ Web Audio Graphic Equalizer / FFT Spectrum Analyser

A browser-based **graphic equalizer** with **FFT spectrum analyser**, built using the Web Audio API.  
Web Audio API を利用した **グラフィック・イコライザ** と **FFT スペクトラムアナライザ** のブラウザアプリです。

---

## 🌐 Live Demo / 公開ページ

👉 [GitHub Pages Demo](https://hsksts.github.io/fft-analyser/)

---

## ✨ Features / 機能

- **Input source selection / 入力ソース選択**  
  - File (音声ファイル)  
  - Microphone (マイク入力)  
  - White Noise (ホワイトノイズ)  
  - Pink Noise (ピンクノイズ)

- **10-band Graphic Equalizer / 10バンド グラフィックEQ**  
  - Range: **−20 dB ~ +20 dB**  
  - Adjustable Q (bandwidth) / Q値（帯域幅）の調整  
  - Double-click a slider to reset to 0 dB / スライダーをダブルクリックで 0 dB にリセット  

- **Presets / プリセット**  
  - Flat, Bass Boost, Treble Boost, Vocal, Loudness  

- **Master controls / マスターコントロール**  
  - Master Volume（マスター音量）  
  - Bypass（EQバイパス）  
  - Noise Level（ノイズソース専用音量）

- **Real-time Spectrum Analyser / リアルタイム・スペクトラムアナライザ**  
  - Log-frequency axis / 対数周波数軸  
  - Post-EQ signal visualization / EQ後の信号を表示

---

## 🖥 How to Use / 使い方

1. Open the demo page / デモページを開く  
2. Select **source**: File, Mic, White, Pink / 入力ソースを選択  
3. Press **▶︎ 再生 / Play** to start playback  
   ⚠️ Autoplay policies: must use a user gesture / ブラウザの自動再生制限のため必ずボタン操作で再生開始  
4. Adjust sliders or apply presets / スライダーやプリセットでEQ調整  
5. Observe spectrum changes in real time / スペクトラムの変化をリアルタイム表示  

---

## 📂 File Structure / ファイル構成

```
index.html   # Main UI / メインHTML
eq.js        # Core logic (EQ + analyser) / アプリ本体
```

---

## ⚠ Notes / 注意事項

- Works best in modern browsers (Chrome, Edge)  
  最新のブラウザ（Chrome, Edge 推奨）で動作確認済み
- Microphone input requires HTTPS + user permission  
  マイク入力には HTTPS 環境とマイク権限が必要
- Safari/iOS: some limitations in Web Audio API  
  Safari/iOS では一部制限あり

---

## 📜 License / ライセンス

MIT License
