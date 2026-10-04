import json,re,pathlib,sys
records=json.load(open(sys.argv[1]))
repo=pathlib.Path(__file__).resolve().parents[1]
overrides={
'1444':['Username:Password:Email:EmailPassword:Token:2FA'],
'627':['Username:Password:Email:EmailPassword:Token:2FA'],
'1783':['User|Password|2FA|AuthToken|Phone|Mail|PassMail|RefreshToken|ClientID|EmailRecovery|Cookies'],
'4436':['User|Password|2FA|AuthToken|Mail|PassMail|RefreshToken|ClientID|EmailRecovery|Cookies'],
'5432':['User|Password|2FA|AuthToken|Phone|Mail|PassMail|RefreshToken|ClientID|EmailRecovery|Cookies'],
'2217':[], '2232':[],
'3799':['Account--Password--2FA--Token--Email--EmailPassword'],
'4208':['Account--Password--2FA--Token--Email--EmailPassword'],
'4427':['Account|Password|Email-EmailPassword|2FA|Token|ClientID|RefreshToken'],
'4434':['Login:Password:Mail:MailPassword:2FAMail:VerificationURL'],
'4591':[],
'451':['Username----Password----Email----EmailPassword|AdditionalPassword|AdditionalPassword----PhoneNumber----2FA----Token'],
'4384':['User|Pass|Email|PassMail|2FA|AuthToken|','Username:Password:Email:EmailPassword:2FAKey:CT0:AuthToken'],
'4521':['User:Pass:Mail|MailPass|AuthToken:2FA:'],
'4612':['User:Pass:Mail:MailPass:Token:CT0:2FA'],
'4730':['User:Pass:Mail:MailPass:2FA:Token:CT0'],
'4667':[],
'4841':['Username----Password----Email----TwoFactorVerification----VerificationToken'],
'5132':['Username----Password----Email----TwoFactorAuthentication----VerificationToken'],
'5257':['User:Pass:Mail:CT0:AuthToken','User:Pass:Phone:CT0:AuthToken'],
'5262':['User----Pass----Phone----Token','User----Pass----Mail----Token'],
'5370':['Username:Password:Email:EmailPassword:Token:CT0:Token:2FA'],
'644':[], '661':[],
'2889':['Username-Password-EmailUsername-EmailPassword-2FA-BackupCode-Token'],
'4240':['Username.Password.2FAKey.Mail.MailPassword'],
'5216':['Account----Password----Email|EmailPassword|RefreshToken|ClientID----Phone----2FA----Token'],
'625':[],
}
# Normalize confirmed declarations into a field/separator DSL. Original
# declarations stay beside each profile for review; ambiguous text is not guessed.
for r in records:
    r['formats']=overrides.get(r['id'],[re.sub(r'\s*([-:|;]+)\s*',r'\1',s).strip().rstrip(':|') for s in r['declarations']])
    if r['id'] in ['2889','4240','5216']:
        r['declarations']={'2889':['Username-Password-Email Username-Email Password-2FA-backup code-Token'],'4240':['username.password.2fakey.mail.mailpassword.'],'5216':['Account ---- Password ---- Email | Email Password | Refresh Token | Client ID ---- phone verified----2fa----Token']}[r['id']]
    r['formats']=list(dict.fromkeys(r['formats']))
(repo/'src/generated/hstora-formats.ts').write_text('import type { FormatSource } from "../account-format";\nexport const FORMAT_CATALOG: FormatSource[] = '+json.dumps(records,ensure_ascii=False,indent=2)+';\nexport const FORMAT_COVERAGE = '+json.dumps({'checkedAt':'2026-10-04','categoryPages':15,'products':len(records),'shops':len(set(r['seller'] for r in records)),'withFormats':sum(bool(r['formats']) for r in records),'summary':f"2026年10月4日確認: HStora Xカテゴリ15ページ・{len(records)}商品・{len(set(r['seller'] for r in records))}ショップを調査。形式を確認できた{sum(bool(r['formats']) for r in records)}商品の表記を登録。未記載・曖昧な商品は自動確定できません。"},ensure_ascii=False,indent=2)+';\n')
