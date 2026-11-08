// Keep entitlement separate from the legacy snapshot: stale pages may replace that snapshot.
const KEY='pvz-progress-v1',OWNED_KEY='pvz-collector-owned-v1';
type Store=Pick<Storage,'getItem'|'setItem'>;
export class SunCollector {
  owned=false; enabled=true;
  private legacy: Record<string,unknown>={};
  constructor(private storage:Store){this.refresh()}
  refresh(){
    try{this.legacy=JSON.parse(this.storage.getItem(KEY)||'{}')||{}}catch{}
    this.owned=this.owned||this.legacy.collector===true;
    try{this.owned=this.owned||this.storage.getItem(OWNED_KEY)==='true'}catch{}
    this.enabled=this.legacy.enabled!==false;
    if(this.owned)try{this.storage.setItem(OWNED_KEY,'true')}catch{}
  }
  private save(){
    try{this.legacy=JSON.parse(this.storage.getItem(KEY)||'{}')||{}}catch{}
    if(this.owned)this.storage.setItem(OWNED_KEY,'true');
    this.legacy={...this.legacy,collector:this.owned,enabled:this.enabled};this.storage.setItem(KEY,JSON.stringify(this.legacy));
  }
  get active(){return this.owned&&this.enabled}
  unlocked(nextLevel:number){return nextLevel>=3||Number(this.legacy.highestWave)>=3}
  buy(wallet:{money:number},nextLevel:number){this.refresh();if(this.owned||!this.unlocked(nextLevel)||wallet.money<150)return false;wallet.money-=150;this.owned=true;this.enabled=true;this.save();return true}
  grantVictory(){this.refresh();if(this.owned)return false;this.owned=true;this.enabled=true;this.save();return true}
  toggle(){this.refresh();if(!this.owned)return;this.enabled=!this.enabled;this.save()}
}
