// Plant::Fire / ZombieCatapultFire / Projectile::UpdateLobMotion, pinned in docs/lob-flight.json.
export type LobKind='cabbage'|'kernel'|'butter'|'melon'|'wintermelon'|'basketball';
export type LobFlight={vx:number;vz:number;z:number;planeY:number};
export function lobFlight(startX:number,startY:number,endX:number,endY:number):LobFlight {
 return {vx:(endX-startX)/120,vz:(endY-startY)/120-7,z:0,planeY:startY};
}
export function lobCanCollide(kind:LobKind,age:number,f:LobFlight,water:boolean){
 if(f.vz<0&&(kind==='basketball'||age>20))return false;
 const minimum=(kind==='butter'?-32:kind==='basketball'?60:kind==='melon'||kind==='wintermelon'?-35:-30)+(water?40:0);
 return age<=20||f.z>minimum;
}
