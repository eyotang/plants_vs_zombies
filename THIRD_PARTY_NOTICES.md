# 素材来源与使用范围

压扁植物音效补充：固定325b2229版本 SexyAppFramework/sounds/chomp.ogg、chomp2.ogg，按同版本 TodFoley.cpp 的 FOLEY_SQUISH 等权变体使用，转换为44.1kHz、96kbit/s MP3。来源与输出哈希见 classic-adventure/docs/squish-audio.json。

独立五关经典挑战使用用户指定的参考项目中的视觉素材：
https://github.com/marblexu/PythonPlantsVsZombies

素材来自该项目 resources/graphics，包括植物、僵尸逐帧动画、卡牌、草坪、菜单、阳光、豌豆和割草机；为浏览器性能合并为 PNG 图集。游戏逻辑和网页界面为本项目实现。

参考项目 README 声明：仅供个人学习和非商业用途。原版植物大战僵尸相关角色、美术和商标的权利归原权利人所有，本项目不宣称拥有这些素材。此本地版本用于个人学习和非商业体验。

铲子图标（assets/classic/shovel.svg）为本项目原创矢量绘制，用于匹配经典卡通画风。

阳光收集器图标（assets/classic/sun-collector.svg）为本项目原创矢量绘制。

五关经典挑战中的背景音乐及新增音效为本项目原创程序合成。完整冒险中的音乐与音效来源见下文。

扩展植物、蘑菇睡眠/消化/跳跃动画、旗帜僵尸、夜晚和保龄球背景、传送带底图均来自同一参考项目；五关出怪数据来自该项目 source/data/map/level_1.json 至 level_5.json。

追加经典僵尸无头行走/啃食、旗帜/报纸受伤、掉落头部、独立倒地与焦黑退场动画，均来自同一参考仓库的 resources/graphics/Zombies。紧凑图集按需加载。

完整冒险（一代）参考与改造：
- https://github.com/xyxiao001/pvz-web ，固定提交 45fe1f404ff702ff37589d015aad0f62509d373e。
- 本地源码在 classic-adventure/，只包含一代实现及运行素材，未引入二代。上游的Portable行为/素材来源记录保留在 classic-adventure/docs。
- 本次改造包括30帧与经典像素预算、流式音乐、音效并发限制、永久收阳光道具及旧进度衔接、独立五关挑战入口与运行资源裁剪。
- 角色、音乐和原版风格图像的原始权利归相应权利人；用于用户本地学习与非商业致敬项目。铲子和阳光收集器SVG沿用本项目自绘版本。

完整冒险的射击与普通命中音效：
- 固定来源：https://github.com/ruslan831/PlantsVsZombies-decompilation/tree/325b2229a7225d73870bb69322eefcda3a45bf8d/SexyAppFramework/sounds
- throw/throw2 与 splat/splat2/splat3 从原始 Vorbis 转为手机兼容的44.1kHz MP3；变体权重参照同版本 Sexy.TodLib/TodFoley.cpp。来源和转换后哈希记录在 classic-adventure/docs/combat-audio.json。
- 通用射击/命中变体的来源见上述记录，专用命中音效见下文。

专用命中声补充11段同一固定版本的 shieldhit、plastichit、ignite、kernelpult、butter、melonimpact 系列；来源哈希和转换后哈希记录在 classic-adventure/docs/impact-audio.json，仍为44.1kHz手机兼容MP3并保留原声道。声音分层与火豌豆规则对照同版本 Lawn/Projectile.cpp、Lawn/Zombie.cpp、Sexy.TodLib/TodFoley.cpp。

经典原尺寸运行纹理：同一固定版本 SexyAppFramework/reanim 的PNG/JPG原图，无损重打包为134张 *.classic.webp，使用965份经SHA256核验的源图片；僵王的彩色JPEG与原始灰度透明遮罩按上游方式合成。未缩放原始像素，动作与逻辑帧矩形不变。来源、生成文件哈希和逐帧像素核验记录在 classic-adventure/docs/classic-texture-assets.json。原2倍素材继续保留用于旧页面兼容。

经典Powie爆炸效果：来源为同一固定325b2229版本的 SexyAppFramework/particles/Powie.xml、ExplosionCloud.png，以及 DebugVS2005/particles/ExplosionPowie.png 的经典英文版本。两张运行PNG原样使用、未编辑像素，合计6251字节。参考同版本 Sexy.TodLib/TodParticle.cpp、Definition.cpp 与已校验的编译曲线数据；规则、哈希与剩余差异见 classic-adventure/docs/native-powie.json。

经典冰块覆盖效果：同一固定325b2229版本的 SexyAppFramework/images/icetrap.png 与 icetrap2.png 原样使用，无像素编辑。两张54×30透明PNG合计5618字节，前后层顺序和物种位置参照 Zombie::DrawIceTrap；来源、SHA256和验证边界见 classic-adventure/docs/native-ice-trap.json。
