import { FORMAT_CATALOG as HSTORA, FORMAT_COVERAGE as HSTORA_COVERAGE } from './generated/hstora-formats';
import { FORMAT_CATALOG as HSTOCKPLUS, FORMAT_COVERAGE as HSTOCKPLUS_COVERAGE } from './generated/hstockplus-formats';
import type { FormatSource } from './account-format';
export const FORMAT_CATALOG: FormatSource[] = [...HSTORA, ...HSTOCKPLUS];
export const FORMAT_COVERAGE = {summary: HSTORA_COVERAGE.summary+' '+HSTOCKPLUS_COVERAGE.summary};
function normalizeUrl(value:string):string {
 try {const u=new URL(value);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/^\/ja\//,'/').replace(/\/$/,'');}catch{return '';}
}
export function resolveFormatSources(value:string,catalog:FormatSource[]=FORMAT_CATALOG):FormatSource[] {
 const query=value.trim();if(!query)return catalog;
 const url=normalizeUrl(query);
 const exact=catalog.filter(s=>s.id===query || s.aliases?.includes(query) || (url && normalizeUrl(s.url)===url));
 if(exact.length>1)throw new Error('商品IDが複数のサイトにあります。商品URLを指定してください。');
 if(exact.length)return exact;
 const shops=catalog.filter(s=>s.seller.toLowerCase()===query.toLowerCase());
 if(shops.length)return shops;
 throw new Error('購入元の商品ID・URLまたはショップ名を確認してください。');
}
