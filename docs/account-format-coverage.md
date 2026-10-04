# HStora Xアカウント形式調査

2026年10月4日確認: HStora Xカテゴリ15ページ・175商品・75ショップを調査。形式を確認できた119商品の表記を登録。未記載・曖昧な商品は自動確定できません。

取得範囲は `https://hstora.com/en/category/twitter` の全ページに掲載された商品です。購入せず公開商品説明のみを確認しました。出品説明が完全な納品仕様とは限らず、購入元を指定した場合もログインの有効性は保証しません。新規出品や説明変更はこのスナップショットに含まれません。

単一/複数ハイフン、コロン、パイプ、ドット、および混在順序を保持します。パスワード内の区切り文字等により分割が一意にならない場合は確定しません。`2217`・`2232`・`4591`・`4667`・`644`・`661` 等は、項目名の重複/欠落または説明とURLの境界が曖昧なためFormatを自動登録していません。`5370` はTokenが二箇所ある原文を維持し、重複項目の確認を促します。

## 更新手順

```bash
python scripts/crawl-hstora.py /tmp/hstora-cache
python scripts/extract-hstora-formats.py /tmp/hstora-cache /tmp/hstora-declarations.json
# 全ての宣言と未抽出商品を確認し、build-hstora-catalog.py の手動補正と調査日を更新
python scripts/build-hstora-catalog.py /tmp/hstora-declarations.json
npm run typecheck
npm test
```

自動抽出は候補収集用です。新しい形式の原文を人手で確認する前に公開しないでください。公開ショップ・商品情報とFormatのみを収集し、購入情報・認証情報は取得しません。

## 商品別対応

| 商品 | ショップ | 状態 |
| --- | --- | --- |
| [119](https://hstora.com/en/product/119-twitter-accounts-2008-aged-login-pass-email-passmail-token-2fa) | Accounts | 登録済み |
| [1204](https://hstora.com/en/product/1204-twitter-aged-2007-mail-2fa) | MiraStore | 登録済み |
| [1205](https://hstora.com/en/product/1205-twitter-aged-2008-mail-2fa) | MiraStore | 登録済み |
| [1206](https://hstora.com/en/product/1206-30-100-followers-top-latest-search-by-from-username-twitter-aged-2007-26-hotmail-2fa) | MiraStore | 登録済み |
| [1208](https://hstora.com/en/product/1208-new-x-twitter-account-30-days-old-email-access-included-2fa-auth-token-included-clean-account-instant-delivery) | MIDACCS | 登録済み |
| [120](https://hstora.com/en/product/120-twitter-accounts-2007-aged-login-pass-email-passmail-token-2fa) | Accounts | 登録済み |
| [1358](https://hstora.com/en/product/1358-twitter-2006-2018-microsoft-email-auth-token-2fa) | Twitter Store | 登録済み |
| [1359](https://hstora.com/en/product/1359-twitter-2019-2025-include-hotmail-email-token-2fa-token) | Twitter Store | 登録済み |
| [1444](https://hstora.com/en/product/1444-1000-1999-old-followers-2fa) | X Twitter | 登録済み |
| [1582](https://hstora.com/en/product/1582-2010-2016-10-years-old-sms-twitter-accounts-auth-token-mix-ip) | HStora Official Shop | 登録済み |
| [1583](https://hstora.com/en/product/1583-21-days-old-twitter-x-real-phones-outlook-mail-auth-token-2fa-ct0) | HStora Official Shop | 登録済み |
| [1584](https://hstora.com/en/product/1584-fresh-twitter-x-outlook-mail-2fa-auth-token-mix-ip) | HStora Official Shop | 登録済み |
| [1592](https://hstora.com/en/product/1592-2017-2025-sms-twitter-accounts-auth-token-mix-ip) | HStora Official Shop | 登録済み |
| [1594](https://hstora.com/en/product/1594-2010-2022-old-twitter-accounts-auth-token-ct0) | HStora Official Shop | 登録済み |
| [1595](https://hstora.com/en/product/1595-30-followers-2010-2020-old-twitter-accounts-auth-token-ct0) | HStora Official Shop | 登録済み |
| [1597](https://hstora.com/en/product/1597-500-followers-2010-2020-old-twitter-accounts-auth-token-ct0) | HStora Official Shop | 登録済み |
| [1598](https://hstora.com/en/product/1598-1000-followers-2010-2020-old-twitter-accounts-auth-token-ct0) | HStora Official Shop | 登録済み |
| [1609](https://hstora.com/en/product/1609-no-shadow-bans-twitter-accounts-no-bans) | Twt Store | 登録済み |
| [1613](https://hstora.com/en/product/1613-2006-2018-x-hotmail-auth-token-2fa) | X Store | 登録済み |
| [1615](https://hstora.com/en/product/1615-2019-2025-x-phone-verified-hotmail-auth-token-2fa) | X Store | 登録済み |
| [1617](https://hstora.com/en/product/1617-2006-2026-x-10-30-real-followers-hotmail-auth-token-2fa) | X Store | 登録済み |
| [1619](https://hstora.com/en/product/1619-2006-2018-x-phone-verified-hotmail-auth-token-2fa) | X Store | 登録済み |
| [1622](https://hstora.com/en/product/1622-2019-2025-x-hotmail-token-2fa) | X Store | 登録済み |
| [1630](https://hstora.com/en/product/1630-a-customized-fan-account) | Twitter Store | 未記載または曖昧（自動確定不可） |
| [1649](https://hstora.com/en/product/1649-19-days-x-accounts-nft-profil-high-quality) | Tazmanya | 登録済み |
| [1698](https://hstora.com/en/product/1698-2023-old-twitter-accounts-verified-by-email-email-access-provided) | Accounts Master | 未記載または曖昧（自動確定不可） |
| [1722](https://hstora.com/en/product/1722-twitter-accounts-more-than-1month-old-verified-with-email-and-2fa-enabled) | Accountix | 未記載または曖昧（自動確定不可） |
| [1769](https://hstora.com/en/product/1769-twitter-2007-20-hotmails-auth-token-2fa) | MiraStore | 登録済み |
| [1775](https://hstora.com/en/product/1775-twitter-phone-mail-2021-25-phone-mail-auth-token-2fa) | MiraStore | 登録済み |
| [1783](https://hstora.com/en/product/1783-twitter-x-accounts-2006-2020-phone-verified-hotmail-access-2fa-auth-token-0-20-followers) | Enak | 登録済み |
| [1862](https://hstora.com/en/product/1862-twitter-x-top-latest-search-20-posts-45-days-mix-kols-cloning) | Enak | 登録済み |
| [1903](https://hstora.com/en/product/1903-twitter-10-30-followers-hotmails-2fa-aged-2007-25) | MiraStore | 登録済み |
| [1924](https://hstora.com/en/product/1924-twitter-aged-2007-25-30-100-followers-mail-2fa) | MiraStore | 登録済み |
| [1954](https://hstora.com/en/product/1954-a-guide-to-getting-a-twitter-premium-subscription-at-the-lowest-price) | TW Shop | 未記載または曖昧（自動確定不可） |
| [1955](https://hstora.com/en/product/1955-twitter-06-25-u-s-web-1000-followers-2fa-token) | good acc shop | 登録済み |
| [1992](https://hstora.com/en/product/1992-old-twitter-accounts-500-followers-2007-2014-ready-to-use) | Twitold | 登録済み |
| [2027](https://hstora.com/en/product/2027-premium-blue-acc-valid-for-3-months-2006-2025-profile-added-2fa-token) | TW Shop | 登録済み |
| [2029](https://hstora.com/en/product/2029-twitter-2009-2019-2000-real-followers) | NexTweet | 登録済み |
| [2086](https://hstora.com/en/product/2086-0day-twitter-reg-hotmails-2fa-mail-works) | MiraStore | 登録済み |
| [2119](https://hstora.com/en/product/2119-twitter-phone-mail-2007-20-phone-mail-auth-token-2fa) | MiraStore | 登録済み |
| [2139](https://hstora.com/en/product/2139-0-29-2008-followers-2fa) | X Tweets | 登録済み |
| [2166](https://hstora.com/en/product/2166-no-shadowban-2006-2025-hotmail-email-available-login-with-2fa-token) | Twitter Store | 登録済み |
| [2217](https://hstora.com/en/product/2217-tweeter-10-29-follower-onet-pl) | MR.X | 未記載または曖昧（自動確定不可） |
| [2220](https://hstora.com/en/product/2220-high-quality-twitter-accounts-in-search-email-2fa-cto-auth-token-high-quality) | Premium x search glow | 登録済み |
| [2232](https://hstora.com/en/product/2232-twitter-blue-accounts-geo-mix-2007-2026-no-ads-twitter-blue-accounts-geo-mix-2007-2026-no-ads) | Аккаунты Twitter Blue | 未記載または曖昧（自動確定不可） |
| [2233](https://hstora.com/en/product/2233-accounts-twitter-blue-verified-status-billing-200-2026-year-account-location-us-twitter-blue-accounts-verified-status-billing-200-year-2026-account-location-us) | Аккаунты Twitter Blue | 登録済み |
| [2243](https://hstora.com/en/product/2243-2007-2020-1000sub) | x bext top seach | 未記載または曖昧（自動確定不可） |
| [2247](https://hstora.com/en/product/2247-fresh-twitter-x-accounts-with-best-and-high-quality-accounts) | The Digital Shop | 未記載または曖昧（自動確定不可） |
| [2352](https://hstora.com/en/product/2352-no-shadow-ban-top-latest-search-1-posts-2007-2025-aged-5-30-followers) | XTWITTER SHOP | 登録済み |
| [2569](https://hstora.com/en/product/2569-21-days-old-reg-twitter-x-phone-outlook-mail-auth-token-2fa) | HStora Official Shop | 登録済み |
| [2570](https://hstora.com/en/product/2570-2010-2025-2fa-twitter-accounts-valid-mail-outlook-auth-token-ct0) | HStora Official Shop | 登録済み |
| [2575](https://hstora.com/en/product/2575-no-shadow-ban-30-100-real-followers-2010-2026-top-latest-saerch) | XTWITTER SHOP | 登録済み |
| [2582](https://hstora.com/en/product/2582-2006-2025-top-search-no-shadowban-hotmail-2fa-token-login) | X Store | 登録済み |
| [2583](https://hstora.com/en/product/2583-twitter-1k-followers-aged-2007-25-mail-2fa) | MiraStore | 登録済み |
| [2673](https://hstora.com/en/product/2673-fresh-twitter-accounts-created-on-email-verified-by-2fa) | Super Store | 未記載または曖昧（自動確定不可） |
| [2718](https://hstora.com/en/product/2718-10-followers-top-latest-search-by-from-username-twitter-aged-2026-hotmail-2fa-mail-accessible) | MiraStore | 登録済み |
| [2778](https://hstora.com/en/product/2778-twitter-x-account-random-organic-posts-showing-in-top-no-shadowoban-2fa-auth-token-ct0-cookies) | Social Solutions | 登録済み |
| [2810](https://hstora.com/en/product/2810-twitter-x-blue-premium-2008-2023-aged-0-10-followers-2fa-token) | Buyz Store | 登録済み |
| [2889](https://hstora.com/en/product/2889-no-shadow-ban-1-6month-aged-accounts-0-30-followers-avatar) | acc157 | 登録済み |
| [2897](https://hstora.com/en/product/2897-fresh-twitter-accounts-verified-by-email-email-access-provided) | Accounts Master | 未記載または曖昧（自動確定不可） |
| [3659](https://hstora.com/en/product/3659-twitter-2006-2025-30-100fan-4f4-hotmail-token-2fa) | Twitter Store | 登録済み |
| [3674](https://hstora.com/en/product/3674-x-twitter-5-50-real-followers-2006-2025-includes-email-auth-token-profile-complete) | Savo Social Mall | 登録済み |
| [3680](https://hstora.com/en/product/3680-twitter-x-top-search-latest-2x-post-2x-followers-30-days) | X Seach TOP | 登録済み |
| [376](https://hstora.com/en/product/376-twitter-aged-2008-auth-token-firstmail-included-2fa) | Tweety Store | 登録済み |
| [377](https://hstora.com/en/product/377-twitter-aged-2007-auth-token-firstmail-included-2fa) | Tweety Store | 登録済み |
| [3790](https://hstora.com/en/product/3790-old-twitter-account-no-posting-restrictions-long-term-posting-supported-2009-2024-posts-can-appear-in-top-comments-are-fully-visible-no-shadow-ban-random-followers) | Qid | 未記載または曖昧（自動確定不可） |
| [3799](https://hstora.com/en/product/3799-gold-account-x-enterprise-account) | 账号胖 | 登録済み |
| [3830](https://hstora.com/en/product/3830-twitter) | venus_seller | 未記載または曖昧（自動確定不可） |
| [386](https://hstora.com/en/product/386-twitter-10-30-real-followers-2006-2025-includes-microsoft-email-auth-token-2fa) | Twitter Store | 登録済み |
| [3887](https://hstora.com/en/product/3887-twitter-blue-active-since-last-year) | XTWITTER SHOP | 登録済み |
| [3909](https://hstora.com/en/product/3909-2023-old-real-android-reg-fresh-twitter-x-outlook-mail) | HStora Official Shop | 登録済み |
| [3949](https://hstora.com/en/product/3949-twitter-account-100-500-real-followers-email-2fa) | Global Telegram Accounts | 登録済み |
| [3973](https://hstora.com/en/product/3973-top-latest-saerch-twitter-accounts-verified-by-email-outlook-com-hotmail-com-email-may-not-work) | XTWITTER SHOP | 登録済み |
| [4000](https://hstora.com/en/product/4000-conf-rmed-w-th-hotma-l-twitter-account-phone-ver-f-ed-2009-2023-ct0-auth-token) | Zera Digital | 未記載または曖昧（自動確定不可） |
| [4023](https://hstora.com/en/product/4023-zerad-g-tal-30-followers-twitter-account-phone-ver-f-ed-2009-2023-ct0-auth-token) | Zera Digital | 未記載または曖昧（自動確定不可） |
| [4064](https://hstora.com/en/product/4064-twitter-09-25-1000-followers-no-shadow-ban-1-post-mix-2fa-token) | good acc shop | 登録済み |
| [4136](https://hstora.com/en/product/4136-x-twitter-0-30-real-followers-2006-2025-includes-email-auth-token-2fa-profile-picture-complete) | Savo Social Mall | 登録済み |
| [4139](https://hstora.com/en/product/4139-aged-x-twitter-accounts-with-140-real-followers-include-mail-2fa) | Arsel Store | 登録済み |
| [4155](https://hstora.com/en/product/4155-twitter-no-shadow-ban-top-latest-2006-2025year-2fa-token) | Twt Acc Store | 登録済み |
| [4208](https://hstora.com/en/product/4208-gold-account-customized-to-customer-requirements) | 账号胖 | 登録済み |
| [4220](https://hstora.com/en/product/4220-old-twitter-onet-mail-recovery-best-quality) | SK marketing | 未記載または曖昧（自動確定不可） |
| [4239](https://hstora.com/en/product/4239-top-latest-search-by-from-username-twitter-aged-2007-25-0-30-followers-hotmail-2fa) | MiraStore | 登録済み |
| [4240](https://hstora.com/en/product/4240-2009-2015-old-twitter-account) | AccGalaxy | 登録済み |
| [4276](https://hstora.com/en/product/4276-21-days-old-twitter-x-accounts-phone-confirmed-and-removed-2fa-enabled-auth-token-ct0) | Social Solutions | 登録済み |
| [4320](https://hstora.com/en/product/4320-premium-version-blue-3months) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [4326](https://hstora.com/en/product/4326-twitter-x-blue-badge-accounts-100-300-followers-original-2009-2022-year-aged) | MJ Social Power | 未記載または曖昧（自動確定不可） |
| [4331](https://hstora.com/en/product/4331-noshadowban-top-search-1-posts-twitter-aged-2007-25-not-latest-0-10-followers) | MiraStore | 登録済み |
| [434](https://hstora.com/en/product/434-twitter-2007-2024-2fa-10) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [4354](https://hstora.com/en/product/4354-twitter-2006-2025-30-100-followers-4f4-hotmail-token-2fa) | X Store | 登録済み |
| [435](https://hstora.com/en/product/435-twitter-2007-2024-2fa-50) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [436](https://hstora.com/en/product/436-twitter-2007-2024-2fa-100) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [437](https://hstora.com/en/product/437-twitter-2007-2024-2fa-0-9) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [4384](https://hstora.com/en/product/4384-x-appears-in-search-top-tab-20-followers-2fa-20-tweets-luxury-vip-premium-x-appears-in-search-top-tab-30-days-full-profile-2fa) | 🆃🅾🅺🅸🅽🅰🅸🆂🆃 | 登録済み |
| [438](https://hstora.com/en/product/438-twitter-2007-2024-2fa-10) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [439](https://hstora.com/en/product/439-twitter-2007-2024-2fa-50) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [441](https://hstora.com/en/product/441-twitter-2007-2024-2fa-10) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [4423](https://hstora.com/en/product/4423-twitter-x-blue-check-accounts-2009-2026-2fa-active) | Moselia | 未記載または曖昧（自動確定不可） |
| [4427](https://hstora.com/en/product/4427-no-shadow-ban-top-latest-5-100-followers-2009-2018-hotmail-email-token-2fa-token) | X Account Hub | 登録済み |
| [442](https://hstora.com/en/product/442-twitter-2007-2024-2fa-50) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [4434](https://hstora.com/en/product/4434-aged-twitter-account-2009-2fa-firstmail) | Pickemart | 登録済み |
| [4436](https://hstora.com/en/product/4436-twitter-x-accounts-2006-2018-hotmail-access-2fa-auth-token-80-110-followers) | Enak | 登録済み |
| [443](https://hstora.com/en/product/443-twitter-2007-2024-2fa-100) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [444](https://hstora.com/en/product/444-twitter-2007-2024-2fa-500) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [445](https://hstora.com/en/product/445-twitter-2007-2024-2fa-1000) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [4464](https://hstora.com/en/product/4464-premium-x-twitter-blue-account-personalized-for-you-29-days-remaining-2fa-token) | Buyz Store | 登録済み |
| [446](https://hstora.com/en/product/446-twitter-2007-2024-2fa-0-9) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [447](https://hstora.com/en/product/447-twitter-2007-2024-2fa-10) | 小爱跨境 | 未記載または曖昧（自動確定不可） |
| [450](https://hstora.com/en/product/450-twitter-2006-2018-phone-verified-microsoft-email-auth-token-2fa) | Twitter Store | 登録済み |
| [451](https://hstora.com/en/product/451-twitter-2019-2025-phone-verified-microsoft-email-auth-token-2fa) | Twitter Store | 登録済み |
| [4521](https://hstora.com/en/product/4521-hq-aged-2026-twitter-accounts-mail-access-auth-token-2fa) | Tweet Pro | 登録済み |
| [4541](https://hstora.com/en/product/4541-twitter-no-shadow-ban-20-posts-top-latest-21-day-2fa-token) | X SHOP | 登録済み |
| [4591](https://hstora.com/en/product/4591-twitter-2010-account-firstmail-2fa) | Pickemart | 未記載または曖昧（自動確定不可） |
| [4592](https://hstora.com/en/product/4592-twitter-2006-2025-100-500-real-followers-hotmail-token-2fa) | X SHOP | 登録済み |
| [4611](https://hstora.com/en/product/4611-aged-x-twitter-accounts-100-300-followers2009-2018-auth-token-hotmail-included-2fa-cto) | 🆃🅾🅺🅸🅽🅰🅸🆂🆃 | 登録済み |
| [4612](https://hstora.com/en/product/4612-aged-x-accounts-2009-2018-100-150-followers-auth-token-ct0-hotmail-2fa) | Tweet Pro | 登録済み |
| [4616](https://hstora.com/en/product/4616-500-999followers-2007-2019-twitter-token-2fa) | ACCOUNT VAULT | 登録済み |
| [4638](https://hstora.com/en/product/4638-twitter-clean-0-10-followers-no-shadow-2fa-token-1-posts) | ApeX | 登録済み |
| [4667](https://hstora.com/en/product/4667-aged-x-twitter-accounts-1000-2000-real-followers2009-2016-auth-token-hotmail-included-2fa-cto) | 🆃🅾🅺🅸🅽🅰🅸🆂🆃 | 未記載または曖昧（自動確定不可） |
| [4672](https://hstora.com/en/product/4672-old-twitter-account-created-in-2019-2fa-enabled-high-quality) | ECHOTRADE | 未記載または曖昧（自動確定不可） |
| [4729](https://hstora.com/en/product/4729) | SMMPanelAccount | 登録済み |
| [4730](https://hstora.com/en/product/4730-aged-x-accounts-2009-2018-300-400-followers-auth-token-ct0-hotmail-2fa) | Tweet Pro | 登録済み |
| [4820](https://hstora.com/en/product/4820-twitter-x-accounts-with-outlook-hotmail-email-included-and-verified-male-female-profile-options-available-each-account-comes-with-2fa-enabled-and-a-profile-photo-uploaded) | muktamamunn | 登録済み |
| [4832](https://hstora.com/en/product/4832-2026-sms-twitter-accounts-auth-token-mix-ip) | HStora Official Shop | 登録済み |
| [4841](https://hstora.com/en/product/4841-twitter-no-shadowban-top-latest-2fa-token-10-followers-2-tweets) | X TOP search | 登録済み |
| [4852](https://hstora.com/en/product/4852-twitter-x-account-number-verified-2fa-key-quality-account) | Social Media Connect | 未記載または曖昧（自動確定不可） |
| [486](https://hstora.com/en/product/486-twitter-blue-verified-accounts) | MiraStore | 登録済み |
| [4948](https://hstora.com/en/product/4948-twitter-with-recovery-high-quality) | Social Stock | 未記載または曖昧（自動確定不可） |
| [5007](https://hstora.com/en/product/5007-based-in-united-states-aged-phone-verified-2007-26-accounts) | MiraStore | 登録済み |
| [5023](https://hstora.com/en/product/5023-x-accounts-old-accounts-2fa-token-50-followers) | RoyalX Market | 未記載または曖昧（自動確定不可） |
| [5027](https://hstora.com/en/product/5027-500-twitter-accounts-with-real-post) | X vibes | 未記載または曖昧（自動確定不可） |
| [5038](https://hstora.com/en/product/5038-a1-quality-accounts-2010-2026-top-search-2fa-token-20-followers-200-posts) | RoyalX Market | 未記載または曖昧（自動確定不可） |
| [5079](https://hstora.com/en/product/5079-twitter-2009) | shandian | 未記載または曖昧（自動確定不可） |
| [5083](https://hstora.com/en/product/5083-high-quality-twitter-onet-pl-mail-verified-accounts-with-profile-picture-added) | Best Accounter | 未記載または曖昧（自動確定不可） |
| [5110](https://hstora.com/en/product/5110-twitter-no-shadowban-top-2010-2025-phone-mail-2fa-auth-token) | Hami Store | 登録済み |
| [5124](https://hstora.com/en/product/5124-fresh-twitter-accounts-with-verified-onet-mail) | DREAM SHOP | 未記載または曖昧（自動確定不可） |
| [5132](https://hstora.com/en/product/5132-twitter-no-shadow-ban-top-latest-2006-2025year-10-30followers-2-tweets) | X SHOP TOP | 登録済み |
| [5152](https://hstora.com/en/product/5152-fresh-twitter-account-add-mail-enable) | Insta world | 未記載または曖昧（自動確定不可） |
| [5203](https://hstora.com/en/product/5203-twitter-u-s-web-u-s-us-06-25-0-30-followers-2fa-token) | good acc shop | 登録済み |
| [5216](https://hstora.com/en/product/5216-all-new-twitter-outlook-email-long-lived-token-phone-verified-2fa-token) | Global Telegram Accounts | 登録済み |
| [5217](https://hstora.com/en/product/5217-freshtwitter) | Hubstore | 未記載または曖昧（自動確定不可） |
| [5257](https://hstora.com/en/product/5257-twitter-aged-100-followers-user-pass-mail-phone-ct0-auth-read-description) | MiraStore | 登録済み |
| [5262](https://hstora.com/en/product/5262-no-shadow-ban-2007-2026-10-followers-1-posts-token-based-login-only) | X SHOP | 登録済み |
| [5287](https://hstora.com/en/product/5287-2007-2020-farm-2fa) | TraffiQo | 登録済み |
| [5291](https://hstora.com/en/product/5291-x-twitter-premium-blue-3-months-gift-to-your-account-or-custom-prepared-account) | Buyz Store | 登録済み |
| [5292](https://hstora.com/en/product/5292-x-twitter-premium-blue-6-months-gift-to-your-account-or-custom-prepared-account) | Buyz Store | 登録済み |
| [5318](https://hstora.com/en/product/5318-twitter-x-accounts-august-2026-top-latest-2fa-token-10-followers-1-posts) | RoyalX Market | 未記載または曖昧（自動確定不可） |
| [5321](https://hstora.com/en/product/5321-high-quality-nft-profile-x-accounts-20-days-old-2fa-token) | RoyalX Market | 未記載または曖昧（自動確定不可） |
| [5370](https://hstora.com/en/product/5370-usa-twitter-account-100-500-followers-aged-premium-mail-verified-2fa-added-auth-token) | XEMPIRE | 登録済み |
| [5384](https://hstora.com/en/product/5384-fresh-twitter-x-accounts-verify-with-mail) | PRIME  HUB | 未記載または曖昧（自動確定不可） |
| [5401](https://hstora.com/en/product/5401-new-twitter-account-verify-with-mail) | premium Market | 未記載または曖昧（自動確定不可） |
| [5432](https://hstora.com/en/product/5432-twitter-x-accounts-2021-2026-phone-verified-hotmail-access-2fa-auth-token-0-20-followers) | Enak | 登録済み |
| [5527](https://hstora.com/en/product/5527-fresh-twitter-account-add-onetpl-maill-verify-with-2fa-key-veryfied-add-profile-picture-add-female-name-pro) | Nice store | 未記載または曖昧（自動確定不可） |
| [5540](https://hstora.com/en/product/5540-x-twitter-account-verify-with-mail-access) | Accesspoint | 未記載または曖昧（自動確定不可） |
| [5552](https://hstora.com/en/product/5552-twitter-30-100-followers-user-pass-mail-ct0-authtoken-aged-2007-25) | MiraStore | 登録済み |
| [5561](https://hstora.com/en/product/5561-2000-2999followers-2007-2019-twitter-token-2fa) | ACCOUNT VAULT | 登録済み |
| [5570](https://hstora.com/en/product/5570-1-month-old-high-quality-twitter-account) | Fahi Marketing | 未記載または曖昧（自動確定不可） |
| [5607](https://hstora.com/en/product/5607-twitter-account-2fa-key-with-mail-verified-account) | HORROR STORE | 未記載または曖昧（自動確定不可） |
| [5628](https://hstora.com/en/product/5628-twitter-accounts-email-verified-email-not-included-2fa-enabled-login-tokens-included) | BERS STORE | 登録済み |
| [5629](https://hstora.com/en/product/5629-twitter-x-accounts-aged-since-2023-email-included-partially-completed-profiles-mixed-country-ips) | BERS STORE | 登録済み |
| [5679](https://hstora.com/en/product/5679-2k-followers-usa-x-account-with-real-followers-2006-2018) | Bestplug | 未記載または曖昧（自動確定不可） |
| [617](https://hstora.com/en/product/617-twitter-premium-verified-accounts) | MiraStore | 登録済み |
| [622](https://hstora.com/en/product/622-30-99-old-followers-2fa) | X Twitter | 登録済み |
| [624](https://hstora.com/en/product/624-100-199-old-followers-2fa) | X Twitter | 登録済み |
| [625](https://hstora.com/en/product/625-200-299-old-followers-2fa) | X Twitter | 未記載または曖昧（自動確定不可） |
| [627](https://hstora.com/en/product/627-300-499-old-followers-2fa) | X Twitter | 登録済み |
| [628](https://hstora.com/en/product/628-500-999-old-followers-2fa) | X Twitter | 登録済み |
| [632](https://hstora.com/en/product/632-twitter-account-100-500-real-followers-mail-2fa-aged-2007-25) | MiraStore | 登録済み |
| [642](https://hstora.com/en/product/642-tweeter-200-follower) | X Socio | 登録済み |
| [643](https://hstora.com/en/product/643-tweeter-100-follower) | X Socio | 登録済み |
| [644](https://hstora.com/en/product/644-tweeter-300-follower) | X Socio | 未記載または曖昧（自動確定不可） |
| [648](https://hstora.com/en/product/648-twitter-1000-followers) | X Socio | 登録済み |
| [657](https://hstora.com/en/product/657-twitter-aged-2026-includes-hotmails-auth-token-2fa) | MiraStore | 登録済み |
| [658](https://hstora.com/en/product/658-twitter-2021-25-hotmails-auth-token-2fa) | MiraStore | 登録済み |
| [661](https://hstora.com/en/product/661-twitter-500-followers) | X Socio | 未記載または曖昧（自動確定不可） |
| [90](https://hstora.com/en/product/90-twitter-accounts-2009-2025-aged-100-500-followers-login-pass-email-passmail-token-2fa) | Accounts | 登録済み |

## 検証の範囲

登録形式ごとの代表的な文字列、混在区切り、候補衝突、空欄、空白保持、ブラウザDOMでの項目表示とコピー内容、入力消去、HTML挿入防止、ネットワーク送信・Web Storage保存なしを自動テストしています。検証環境ではブラウザ起動/ダウンロードに失敗し、実ブラウザでの見た目と実機Discordからの開閉・クリップボードは未検証です。
