import type {Pea,Zombie} from './model';
export type ImpactSound='hit'|'shield'|'plastic'|'ignite'|'kernel'|'butter'|'melon';
// Projectile::PlayImpactSound / IsSplashDamage and Zombie::IsFireResistant.
export function fireResistant(z:Zombie){return z.kind==='catapult'||z.kind==='zomboni'||(z.kind==='door'||z.kind==='ladder')&&z.shield>0;}
export function impactSounds(shot:Pea,target?:Zombie):ImpactSound[]{
 const kind=shot.lob?.kind;
 if(kind==='kernel')return ['kernel'];
 if(shot.fire&&(!target||!fireResistant(target)))return ['ignite'];
 const melon=kind==='melon'||kind==='wintermelon',butter=kind==='butter';
 const sounds:ImpactSound[]=melon?['melon']:butter?['butter']:[];
 const helmet=target&&target.armor>0?target.kind:null;
 if(helmet==='bucket')sounds.push('shield');
 else if(helmet==='cone'||helmet==='football'||helmet==='digger')sounds.push('plastic');
 if(!melon&&!butter&&helmet!=='bucket')sounds.push('hit');
 return sounds;
}
