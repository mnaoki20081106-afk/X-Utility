# Bug audit — 2026-09-30

No purchasing, currency conversion or vending payment implementation is present in this repository. Its financial exposure is indirect through account utilities.

Fixed Base32 decoding silently discarding invalid trailing bits or accepting impossible encoded lengths. Added a minimum secret configuration check before encrypting/decrypting refresh-button state.

Typecheck and all three tests passed: RFC 6238 SHA1 vectors, malformed Base32 rejection and 30-second boundaries. No production deployment was performed. Live X shadowban/suspension detection and Discord interaction timing were not validated against external services.

## 2026-10-01 main統合検証

最新main（6bf7be2）を統合。検索用認証情報の初回保存前にテーブルを初期化するよう修正。空のSQLiteへの保存・暗号化・復号・削除の回帰テストを追加。typecheck・4テスト成功。
実送金・本番デプロイの検証は実施していない。
