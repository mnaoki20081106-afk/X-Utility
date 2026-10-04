# X-Utility

Discord上で次の機能を提供するCloudflare Workers BOTです。

- Xシャドウバンチェック
- TOTP 2FAコード生成
- アカウント形式判別・項目別コピー・ログインチュートリアル

## 起動

このリポジトリは `bot-factory.json` に対応しています。Discord-Bot-FactoryからCloudflareへ起動してください。

初回デプロイ後、Discord Developer Portalの **General Information > Interactions Endpoint URL** に次を設定します。

```
https://<Factoryで発行されたWorker URL>/interactions
```

## Xaccount-Bot連携

Xaccount-Bot管理画面からパネルを設置する場合、X-UtilityとXaccount-Botの両方へ同じ `XUTILITY_BRIDGE_SECRET` を設定し、Xaccount-Bot側の `XUTILITY_API_BASE_URL` にX-Utilityの実Worker HTTPS originを設定します。

## 2FA

Discordパネルから2FAキー入力モーダルを開き、標準TOTP（HMAC-SHA1 / 6桁 / 30秒）を生成します。結果はEphemeralで本人だけに表示し、更新・別キー入力にも対応します。シークレットはD1・KV・ログへ保存しません。

## シャドウバン

IRith.ioの現行表示に合わせ、次の6項目を表示します。

- Media Ban
- Search Sensitive Ban
- Search Suggestion Ban
- Search Ban
- Ghost Ban
- Reply Deboosting

Xの公開Web経路から検索・検索候補・会話スレッドの可視性を観測します。取得不能・投稿不足・対象リプライ不足の場合は正常扱いにせず「判定不能 / 対象なし」と表示します。

## アカウント形式判別

Xaccount-Bot管理画面の「X Utility」→「アカウント形式判別」でチャンネルを選び、パネルを設置できます。X-UtilityとXaccount-Botの両方を更新して再起動してください。署名付き設置APIは `/bridge/main/guilds/:guildId/panels/account-format` です。

Discordの標準ボタンはクリップボードへ直接書き込めないため、リンクボタンから同じWorkerの `/account-format` を開きます。入力文字列はブラウザ内のみで解析し、各項目の「コピー」でクリップボードへ書き込みます。入力を送信・保存せず、`connect-src 'none'` のCSPで通信を制限します。Discord内のモーダルへ認証情報を送る必要はありません。

区切り文字、項目数、値の形、購入元商品の公開Formatを組み合わせます。複数の解釈が成り立つ場合は候補を表示し、商品ID/URL/ショップ名検索またはFormat入力で絞り込めます。手入力Formatには `Login:Password:Email:EmailPassword:RecoveryEmail:2FA:Token` などが使えます。項目名だけ修正することもできます。空欄とパスワードの空白を保持します。ログインやキーの有効性は検証しません。

2026-10-04時点のXカテゴリ全15ページ、175商品、75ショップを調査し、明確な表記がある119商品の形式を登録しています。形式未記載・曖昧な商品、将来の新規出品を含む「全商品を常に完全自動判別」は保証できません。調査範囲と未確定商品は `docs/account-format-coverage.md` を参照してください。

`npm run typecheck` はブラウザ用スクリプトを生成した上でWorker・ブラウザの型を確認します。`npm test` は登録形式・候補衝突・コピー内容・通信/保存なしの画面テストを実行します。

## ログインチュートリアル

形式を判別した後、「チュートリアルを表示」を押すと、判別したX登録メールアドレス・ユーザー名・Xパスワードを手順内に表示し、その場でコピーできます。候補が複数ある項目は選択し、推定を含むログイン情報は確認チェックを入れてから使用します。メールのパスワード・回復用メールはXのログイン情報として自動採用しません。項目名を修正する場合は判別結果で修正してから開き直してください。

「2FAコードを生成」は端末内で標準TOTP（SHA1・6桁・30秒）を計算します。コピーボタンに「あと〇秒で更新」を表示し、期限に合わせて自動更新します。コピー時も期限を確認するため、別アプリから戻ったときに古いコードをコピーしません。入力をクリア・再判別した場合、項目名を変更した場合、チュートリアルを閉じた場合はコードと更新タイマーを破棄します。2FAキーや生成コードは外部サービスへ送信しません。
