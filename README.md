# 套房代管記帳

代管套房的每月記帳工具（手機／電腦皆可用）。純前端單檔 `index.html`，資料存於 Supabase（需登入），手機電腦同步同一份。

## 功能
- 租客帳單：每月自動產生 LINE 文字（同一租客多間房可合併），可一鍵複製
- 收電費：雙月輸入電表度數，自動算用量×電價
- 屋主對帳：每間明細＋服務費（自動串接上月匯款）＋第四台＋退押金，附匯款帳戶
- 水電盈虧：收到的電費／水費 vs 台電／台水帳單
- 歷史帳本：每月關鍵數字總表
- 固定調整：每房可多筆折扣，可設時機（每月／雙月／單月）

## 技術
- HTML + CSS + 原生 JavaScript，無建置流程
- Supabase（Auth 登入 + Postgres，RLS 每位使用者只看自己的資料）
- 真實財務資料一律存於 Supabase，不寫進程式碼

## 設定
`index.html` 內 `SUPA_URL` / `SUPA_KEY` 為 Supabase 專案網址與 publishable（anon）金鑰，可公開。
資料表見 `app_state`（uid + data jsonb + RLS）。
