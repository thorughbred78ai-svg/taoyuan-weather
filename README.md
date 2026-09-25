# taoyuan-weather
taoyuan weather

# 🌤 Taoyuan Weather

桃園市 13 行政區天氣預報 GitHub Actions 專案。

目前版本：

**v2.2.0**

---

## 功能

- 桃園市 13 行政區
- 未來 3 天逐 3 小時預報
- 未來 7 天逐日預報
- 中央氣象署 CWA API
- Telegram Bot 推播
- GitHub Actions 自動執行
- 可指定日期
- 可指定行政區
- 支援只執行 API、不推送 Telegram
- Telegram 自動分割長訊息

---

## CWA 資料集

本專案不再使用：

```text
F-D0047-093

改使用桃園市專屬資料集：

F-D0047-005

桃園市未來 3 天逐 3 小時預報。

以及：

F-D0047-007

桃園市未來 1 週預報。
GitHub Secrets

到：

Repository
→ Settings
→ Secrets and variables
→ Actions

建立：

CWA_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

GitHub Actions

手動執行：

Actions
→ Taoyuan Weather
→ Run workflow

可以設定：
input_date

例如：

2026-09-25

留空：

使用台灣當天日期

input_locations

例如：

桃園區

或：

桃園區,中壢區,龜山區

留空：

桃園13區全部

send_telegram

true

會推送 Telegram。

false

只抓資料並輸出到 GitHub Actions Log。
本機測試

Node.js 22 以上。

安裝：

npm ci

執行：

CWA_API_KEY="你的KEY" \
TELEGRAM_BOT_TOKEN="你的TOKEN" \
TELEGRAM_CHAT_ID="你的CHAT_ID" \
npm run weather

只測試 CWA、不推 Telegram：

CWA_API_KEY="你的KEY" \
SEND_TELEGRAM=false \
npm run weather

指定日期：

CWA_API_KEY="你的KEY" \
SEND_TELEGRAM=false \
INPUT_DATE="2026-09-25" \
npm run weather

指定行政區：

CWA_API_KEY="你的KEY" \
SEND_TELEGRAM=false \
INPUT_LOCATIONS="桃園區,中壢區,龜山區" \
npm run weather

專案結構

taoyuan-weather/
├── .github/
│   └── workflows/
│       └── weather.yml
├── src/
│   ├── districts.js
│   └── weather.js
├── .gitignore
├── README.md
├── package.json
└── package-lock.json

注意

本專案使用 Node.js 內建 fetch()。

因此：

不需要 axios
不需要 node-fetch
不需要任何 npm runtime dependency

package-lock.json 仍建議提交到 GitHub，
讓 GitHub Actions 可以使用：

npm ci

版本
v2.2.0

修正：

F-D0047-093 HTTP 404

改成：

F-D0047-005
F-D0047-007

並將：

3天逐3小時
+
7天逐日

拆成兩個 CWA 資料集取得後再合併。

資料來源：

中央氣象署

:::

---

## 7. `package-lock.json`

因為這個專案**沒有任何 npm runtime dependency**，lock file 很簡單。

你可以直接把以下檔案放進 GitHub：

:::writing{variant="document" id="65218" title="package-lock.json"}
```json
{
  "name": "taoyuan-weather",
  "version": "2.2.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "taoyuan-weather",
      "version": "2.2.0",
      "engines": {
        "node": ">=22"
      }
    }
  }
}
