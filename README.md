# 台股投資紀錄

個人使用的 Google Apps Script 網站：以 Google 試算表保存交易，顯示台股持倉、成本、盤後行情與相關新聞。

## 專案檔案

- `Code.gs`：Apps Script 後端，處理交易、試算表、盤後行情與新聞。
- `Index.html`：網站畫面與互動介面。
- `appsscript.json`：Apps Script 執行環境與台北時區設定。

## 部署網站

1. 在 Google Apps Script 建立新專案。
2. 將 `Code.gs` 貼入預設程式檔，新增名為 `Index` 的 HTML 檔並貼入 `Index.html`。
3. 將 `appsscript.json` 的設定填入 Apps Script 專案設定中的資訊清單。
4. 按「部署」→「新增部署作業」→「網頁應用程式」。執行身分選「我」，存取權限選「只有我」。
5. 依 Google 提示授權並開啟部署網址。第一次開啟會在你的 Google Drive 建立試算表。

## GitHub 與 Google Apps Script

GitHub 保存並追蹤程式碼；Apps Script 執行網站與試算表功能。此專案使用 `google.script.run`，不能直接當成靜態網站部署到 GitHub Pages。程式有更新時，將 `Code.gs`、`Index.html` 同步至 Apps Script，儲存後建立新部署版本。

此 repository 目前是公開的，因此程式碼可供任何人瀏覽。它不應包含 Google 帳戶憑證、個人交易紀錄、試算表 ID 或部署網址；交易資料只存放在你的 Google 試算表。

根目錄既有的 `index.htm` 是早期靜態原型；正式網站請使用 Apps Script 專案中的 `Index.html` 與 `Code.gs`。

## 資料來源與計算範圍

- 行情：證交所與櫃買中心公開盤後資料，並非盤中即時報價。
- 新聞：依持倉代號與名稱搜尋 Google 新聞 RSS；討論區提供公開搜尋連結。
- 損益：以平均成本法估算，買進手續費計入成本，賣出費用與交易稅納入已實現損益。除權息及其他特殊交易尚未自動調整。

