# X-Utility

Discord上で次の2機能だけを提供するCloudflare Workers BOTです。

- Xシャドウバンチェック
- TOTP 2FAコード生成

## 起動

このリポジトリは `bot-factory.json` に対応しています。Discord-Bot-FactoryからCloudflareへ起動してください。

初回デプロイ後、Discord Developer Portalの **General Information > Interactions Endpoint URL** に次を設定します。

```
https://<Factoryで発行されたWorker URL>/interactions
```

## Xaccount-Bot連携

Xaccount-Bot管理画面からパネルを設置する場合、X-UtilityとXaccount-Botの両方へ同じ `XUTILITY_BRIDGE_SECRET` を設定し、Xaccount-Bot側の `XUTILITY_API_BASE_URL` にX-Utilityの実Worker HTTPS originを設定します。

## 2FA

パネルから専用ページを開き、入力されたBase32シークレットから標準TOTP（HMAC-SHA1 / 6桁 / 30秒）をブラウザ内だけで生成します。シークレットはDiscordやWorkerへ送信せず、D1・KV・ログにも保存しません。

## シャドウバン

IRith.ioの現行表示に合わせ、次の6項目を表示します。

- Media Ban
- Search Sensitive Ban
- Search Suggestion Ban
- Search Ban
- Ghost Ban
- Reply Deboosting

Xの公開Web経路から検索・検索候補・会話スレッドの可視性を観測します。取得不能・投稿不足・対象リプライ不足の場合は正常扱いにせず「判定不能 / 対象なし」と表示します。
