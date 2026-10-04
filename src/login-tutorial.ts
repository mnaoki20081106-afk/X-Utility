import type { AccountField } from "./account-format";
import { decodeBase32, generateTotp, type TotpResult } from "./totp";


export function totpKey(value: string): string {
  let secret=value;
  if(value.startsWith("otpauth://")) {
    const url=new URL(value);
    if(url.hostname!=="totp" || (url.searchParams.get("algorithm")??"SHA1").toUpperCase()!=="SHA1" ||
      (url.searchParams.get("digits")??"6")!=="6" || (url.searchParams.get("period")??"30")!=="30") {
      throw new Error("この2FAキーの設定には対応していません。SHA1・6桁・30秒のキーを指定してください。");
    }
    secret=url.searchParams.get("secret")??"";
  }
  decodeBase32(secret);
  return secret;
}

export class LoginTutorial {
  private fields: AccountField[]=[];
  private selected = new Map<string,AccountField>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private code: TotpResult | null=null;
  private revision=0;
  private pending=false;
  private active=false;
  private node<T extends HTMLElement>(id:string):T {return document.getElementById(id) as T;}
  constructor(private copy:(value:string,label:string)=>Promise<void>) {
    for(const key of ["email","username","password"]) {
      this.node("tutorial-"+key+"-copy").addEventListener("click",()=>{
        if(this.ready())void this.copy(this.selected.get(key)?.value??"",key==="email"?"メールアドレス":key==="username"?"ユーザー名":"Xパスワード");
      });
    }
    this.node("tutorial-generate").addEventListener("click",()=>void this.start());
    this.node("tutorial-code-copy").addEventListener("click",()=>void this.copyCode());
    this.node("tutorial-confirm").addEventListener("change",()=>{this.stop();this.sync();});
    this.node("tutorial-close").addEventListener("click",()=>this.close());
    document.addEventListener("visibilitychange",()=>{if(this.active && !document.hidden)void this.tick();});
  }
  open(fields:AccountField[]) {
    this.close();this.fields=fields;this.selected.clear();
    this.node<HTMLInputElement>("tutorial-confirm").checked=false;
    for(const key of ["email","username","password","totp"]) {
      const select=this.node<HTMLSelectElement>("tutorial-"+key+"-select");
      const choices=fields.map((field,index)=>({field,index})).filter(({field})=>field.key===key && field.value);
      select.replaceChildren(new Option(choices.length?"使用する項目を選択":"この項目は判別されていません",""));
      for(const {field,index} of choices)select.add(new Option(`項目${index+1}${key==="email" || key==="username"?" / "+field.value:""}`,String(index)));
      if(choices.length===1) {select.value=String(choices[0]!.index);this.selected.set(key,choices[0]!.field);}
      select.hidden=choices.length<2;
      select.onchange=()=>{this.stop();this.node<HTMLInputElement>("tutorial-confirm").checked=false;const field=this.fields[Number(select.value)];if(select.value!=="" && field)this.selected.set(key,field);else this.selected.delete(key);this.sync();};
    }
    this.node("tutorial").hidden=false;
    this.node("tutorial-show").setAttribute("aria-expanded","true");
    this.sync();
    this.node("tutorial").scrollIntoView?.({behavior:"smooth",block:"start"});
  }
  close() {
    this.stop();this.selected.clear();this.fields=[];
    this.node("tutorial").hidden=true;
    this.node("tutorial-show").setAttribute("aria-expanded","false");
    for(const key of ["email","username","password"])this.node<HTMLInputElement>("tutorial-"+key+"-value").value="";
    for(const key of ["email","username","password","totp"])this.node<HTMLSelectElement>("tutorial-"+key+"-select").replaceChildren();
  }
  private ready():boolean {
    return this.node("tutorial-confirm-wrap").hidden || this.node<HTMLInputElement>("tutorial-confirm").checked;
  }
  private sync() {
    const ambiguous=[...this.selected.values()].some(field=>field.confidence!=="format") ||
      ["email","username","password","totp"].some(key=>this.fields.filter(field=>field.key===key && field.value).length>1);
    this.node("tutorial-confirm-wrap").hidden=!ambiguous;
    for(const key of ["email","username","password"]) {
      const field=this.selected.get(key);
      const input=this.node<HTMLInputElement>("tutorial-"+key+"-value");input.value=field?.value??"";input.placeholder="判別結果で項目名を確認してください";
      this.node<HTMLButtonElement>("tutorial-"+key+"-copy").disabled=!this.ready() || !field?.value;
    }
    const totp=this.selected.get("totp");
    this.node("tutorial-totp-note").textContent=totp?"判別結果の2FAキーを使います。":"2FAキーが判別されていません。判別結果で2FAキーの項目を確認してください。";
    this.node<HTMLButtonElement>("tutorial-generate").disabled=!this.ready() || !totp;
  }
  private stop() {
    this.revision++;this.active=false;this.pending=false;this.code=null;
    if(this.timer!==undefined)clearInterval(this.timer);this.timer=undefined;
    this.node<HTMLInputElement>("tutorial-code").value="";
    this.node("tutorial-countdown").textContent="";this.node("tutorial-code-copy").textContent="認証コードをコピー";this.node("tutorial-code-error").textContent="";
    this.node("tutorial-code-wrap").hidden=true;this.node<HTMLButtonElement>("tutorial-code-copy").disabled=true;
  }
  private async start() {
    this.stop();if(!this.ready() || !this.selected.get("totp"))return;
    this.active=true;const revision=this.revision;await this.tick();
    if(this.active && revision===this.revision && this.timer===undefined)this.timer=setInterval(()=>void this.tick(),250);
  }
  private async tick() {
    if(!this.active || this.pending)return;
    const revision=this.revision;
    try {
      if(!this.code || Date.now()<this.code.validFrom || Date.now()>=this.code.validUntil) {
        this.pending=true;this.node<HTMLButtonElement>("tutorial-code-copy").disabled=true;
        const code=await generateTotp(totpKey(this.selected.get("totp")!.value));
        if(revision!==this.revision)return;
        this.code=code;this.pending=false;
      }
      // Crypto may complete across a period boundary: never expose an expired code.
      if(!this.code || Date.now()>=this.code.validUntil) {this.code=null;return;}
      const remaining=Math.ceil((this.code.validUntil-Date.now())/1000);
      this.node<HTMLInputElement>("tutorial-code").value=this.code.code;
      this.node("tutorial-code-wrap").hidden=false;
      this.node("tutorial-countdown").textContent="コードは有効期限に合わせて自動更新されます。";
      this.node("tutorial-code-copy").textContent=`認証コードをコピー（あと${remaining}秒で更新）`;
      this.node<HTMLButtonElement>("tutorial-code-copy").disabled=false;
    } catch {
      if(revision!==this.revision)return;
      this.stop();this.node("tutorial-code-error").textContent="2FAコードを生成できませんでした。2FAキーの形式と項目の選択を確認してください。";
    }
  }
  private async copyCode() {
    if(!this.active || !this.ready())return;
    await this.tick();
    if(this.code && Date.now()>=this.code.validFrom && Date.now()<this.code.validUntil && !this.pending)await this.copy(this.code.code,"認証コード");
  }
}
