export const TUTORIAL_HTML = `<section id="tutorial" hidden aria-labelledby="tutorial-title">
<div class="tutorial-head"><h2 id="tutorial-title">X垢のログイン方法</h2><button id="tutorial-close" type="button">閉じる</button></div>
<div id="tutorial-confirm-wrap" hidden><p class="warning">判別が確定していない項目があります。下の項目と購入元の情報を確認してください。</p><label class="confirm"><input id="tutorial-confirm" type="checkbox">選択したログイン情報を確認しました</label></div>
<ol class="tutorial-steps">
<li><h3>① アカウント追加画面を開く</h3><p>Xアプリを開き、左上のプロフィールアイコンをタップします。メニュー内のアカウント切り替え・追加ボタンを開き、「作成済みのアカウントを使う」など、既存アカウントにログインする項目を選択し、「メールアドレスで続ける」をタップします。</p><p class="muted">画面の表記はアプリのバージョンによって異なります。「メールアドレスで続ける」がない場合は、メールアドレス・ユーザー名を入力できるログイン画面へ進みます。</p></li>
<li><h3>② ログイン情報を入力する</h3><p>メールアドレスまたはユーザー名の入力欄に、以下の情報を貼り付けて進みます。</p>
<label for="tutorial-email-select">X登録メールアドレス</label><select id="tutorial-email-select" hidden></select><input id="tutorial-email-value" readonly autocomplete="off" aria-label="チュートリアルのX登録メールアドレス"><button id="tutorial-email-copy" type="button">メールアドレスをコピー</button>
<label for="tutorial-username-select">Xユーザー名</label><select id="tutorial-username-select" hidden></select><input id="tutorial-username-value" readonly autocomplete="off" aria-label="チュートリアルのXユーザー名"><button id="tutorial-username-copy" type="button">ユーザー名をコピー</button></li>
<li><h3>③ Xのパスワードを入力する</h3><p>以下のXパスワードを貼り付けて、ログインを進めます。</p><label for="tutorial-password-select">Xパスワード</label><select id="tutorial-password-select" hidden></select><input id="tutorial-password-value" readonly autocomplete="off" aria-label="チュートリアルのXパスワード"><button id="tutorial-password-copy" type="button">Xパスワードをコピー</button></li>
<li><h3>④ 2FA認証コードを生成する</h3><p>Xで認証コードの入力を求められたら、「2FAコードを生成」をタップします。</p><label for="tutorial-totp-select">使用する2FAキー</label><select id="tutorial-totp-select" hidden></select><p id="tutorial-totp-note"></p><button id="tutorial-generate" type="button" class="primary">2FAコードを生成</button>
<div id="tutorial-code-wrap" hidden><label for="tutorial-code">認証コード</label><input id="tutorial-code" readonly autocomplete="off" aria-label="生成された認証コード"><button id="tutorial-code-copy" type="button">認証コードをコピー</button><p id="tutorial-countdown" role="timer"></p></div>
<p id="tutorial-code-error" role="alert" class="warning"></p><p>表示されたコードをコピーし、Xの認証コード入力欄に貼り付けて進みます。</p><p class="muted">※提供された英数字の2FAキーを、そのままXに入力するわけではありません。</p></li>
<li><h3>⑤ ログイン完了</h3><p>アカウントのホーム画面が表示されたら、ログイン完了です。</p></li>
</ol></section>`;
