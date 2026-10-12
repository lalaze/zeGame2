# Tiny Bean Café · Regular guests / 熟客故事

## Content contract / 内容约定

- Twelve permanent guests, five chapters each, with complete English and Simplified Chinese text. Their appearance IDs refer to existing `CUSTOMER_CAST` entries; names and stories are new identities, and do not rename the underlying visual cast.
- 12 位具名熟客，每人 5 章，共 60 章，全部提供英文及简体中文。`appearanceId` 复用现有 `CUSTOMER_CAST`，名字与故事是新增的身份，不改写底层外观目录。
- Two guests become eligible on each of days 1, 3, 5, 7, 9 and 11. A debut day is the earliest possible visit, not a promise that a busy café will serve that guest on that day.
- 第 1、3、5、7、9、11 天各加入两位可来访的熟客；出场日是最早可来访日期，不代表一定在当天完成接待。
- Chapter n (1–5) requires at least n successful visits and café day ≥ debutDay + 2 × (n − 1). Chapters unlock in order, at most one per guest per café day. Reading earlier chapters is optional; other guests never gate progress.
- 第 n 章（1–5）要求累计成功接待至少 n 次，且营业日 ≥ 出场日 + 2 × (n − 1)。章节按顺序解锁，每位熟客每天最多解锁一章。无需阅读前章，也不依赖其他熟客的进度。
- Failed visits do not count. Favorite drinks describe preferences; a favorite recipe or another guest is never a story-unlock requirement. Previously unlocked chapters remain available to reread.
- 未成功接待不计次数。偏好饮品只表示口味，解锁偏好配方或遇见其他角色都不是故事条件；已解锁章节可随时回看。
- Stories use small, self-contained daily-life arcs, with no timed choices, hidden cross-character prerequisites, reward claims, or promises to change café finances.
- 故事围绕独立、连续的日常生活展开，无限时选择、隐藏跨角色前置、奖励承诺或经营数值变化。

## Cast and earliest chapter days / 角色与章节最早日期

| ID | Name / 姓名 | Appearance | Debut | Favorite | Chapter days |
| --- | --- | ---: | ---: | --- | --- |
| `mina` | Mina / 米娜 | 0 | 1 | `espresso` | 1, 3, 5, 7, 9 |
| `theo` | Theo / 西奥 | 17 | 1 | `americano` | 1, 3, 5, 7, 9 |
| `iris` | Iris / 艾瑞丝 | 10 | 3 | `blacktea` | 3, 5, 7, 9, 11 |
| `nico` | Nico / 尼可 | 4 | 3 | `latte` | 3, 5, 7, 9, 11 |
| `june` | June / 六月 | 7 | 5 | `cappuccino` | 5, 7, 9, 11, 13 |
| `alba` | Alba / 阿尔芭 | 13 | 5 | `hotchoc` | 5, 7, 9, 11, 13 |
| `ren` | Ren / 阿任 | 6 | 7 | `coldbrew` | 7, 9, 11, 13, 15 |
| `tess` | Tess / 苔丝 | 2 | 7 | `fruittea` | 7, 9, 11, 13, 15 |
| `sam` | Sam / 山姆 | 24 | 9 | `flatwhite` | 9, 11, 13, 15, 17 |
| `vivi` | Vivi / 薇薇 | 21 | 9 | `lemontea` | 9, 11, 13, 15, 17 |
| `otto` | Otto / 奥托 | 8 | 11 | `cortado` | 11, 13, 15, 17, 19 |
| `luz` | Luz / 露兹 | 29 | 11 | `hojicha` | 11, 13, 15, 17, 19 |

## Mina / 米娜 · `mina`

- Role / 身份: Student / 学生
- Personality: Careful and curious; rehearses her first sentence, then asks wonderful questions.
- 性格：认真又好奇，总要先练习开场白，聊起来却有许多有趣的问题。
- Appearance: Brick-red cardigan, glasses, brown hair; cast 0, Morning Reader.
- 外观：砖红开衫、眼镜、棕发；原外观 0「晨读常客」。
- Favorite / 偏好: `espresso`; first eligible café day / 最早出场日: 1
- Locale namespace / 文案键前缀: `regular.guest.mina`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[0]`, `look = { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 1 }`, `hairstyle = 0`, `outfit = 'cardigan'`, `accessory = 'glasses'`, `accent = '#d6b66d'`.

### 1. The First Index Card / 第一张卡片

Unlock: 1 successful visits; café day 1 or later. / 条件：成功接待至少 1 次，且营业日不少于第 1 天。

My class is mapping the walk from the station to school, and I've filled six cards with facts but none with a first sentence. I came here to practise saying it aloud; so far, the sugar jar is a very patient audience.

我们班要画一张车站到学校的步行地图，我写满了六张资料卡，还是没想好怎么开场。我来这里练习出声讲解，目前糖罐是位很有耐心的听众。

### 2. Twenty Seconds / 二十秒

Unlock: 2 successful visits; café day 3 or later. / 条件：成功接待至少 2 次，且营业日不少于第 3 天。

I managed a twenty-second recording of my opening, although the bus outside got the last word. Listening back, I realised I was listing street names without saying why anyone would take that walk. Tomorrow I'll try it with my notebook shut.

开场白终于录出了二十秒，虽然最后一句被窗外的公交车抢走了。回听时我才发现，自己一直在报路名，却没说清为什么值得走这条路。明天我想把笔记本合起来试试。

### 3. The Other Entrance / 另一处入口

Unlock: 3 successful visits; café day 5 or later. / 条件：成功接待至少 3 次，且营业日不少于第 5 天。

A classmate tested my route and found that I'd drawn the station stairs but missed the ramp around the side. We walked it together, and I added the crossing with the longer green light too. There's a lot you can't spot while staring at a neat little map.

同学试走了我的路线，发现我只画了车站的楼梯，漏掉了侧面的坡道。我们一起重新走过，还补上了绿灯更长的那个路口。原来盯着一张整齐的小地图，会错过这么多事。

### 4. A Ring on the Corner / 角落的杯印

Unlock: 4 successful visits; café day 7 or later. / 条件：成功接待至少 4 次，且营业日不少于第 7 天。

I gave the presentation with a coffee ring on the corner of my last card. When someone asked about the ramp, I answered without looking down once. I've clipped that stained card to the finished map; it earned its place.

展示那天，我最后一张卡片的角落留着一圈咖啡印。有人问起坡道，我一次也没低头看笔记就答完了。我把那张有杯印的卡片夹在完成的地图上，它也出了不少力。

### 5. Room for a Pencil / 留一支铅笔的位置

Unlock: 5 successful visits; café day 9 or later. / 条件：成功接待至少 5 次，且营业日不少于第 9 天。

Our map is up on the class noticeboard with a pencil tied beside it for corrections. Someone has already marked a bench I didn't know about, so I have a new stop to investigate. May I leave a copy here too, with plenty of room in the margins?

地图贴上了班级公告板，旁边系着一支铅笔，谁都能补充修改。已经有人标出一张我不知道的长椅，我又有新地方可以去看看了。我特意把页边留得很宽，这里也能放一份吗？

## Theo / 西奥 · `theo`

- Role / 身份: Commuter / 通勤族
- Personality: Punctual and dryly funny; notices the details his timetable leaves out.
- 性格：守时，幽默有点一本正经，渐渐留意时刻表以外的小事。
- Appearance: Slate-blue hair, glasses and a blue duffle coat; cast 17, Rainy-Day Coat.
- 外观：灰蓝头发、眼镜、蓝色牛角扣外套；原外观17「雨天风衣」。
- Favorite / 偏好: `americano`; first eligible café day / 最早出场日: 1
- Locale namespace / 文案键前缀: `regular.guest.theo`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[17]`, `look = { skin: 1, hair: 4, hairStyle: 0, shirt: 1, pants: 1 }`, `hairstyle = 0`, `outfit = 'duffle'`, `accessory = 'glasses'`, `accent = '#e5c483'`.

### 1. Seven Forty-Two / 七点四十二分

Unlock: 1 successful visits; café day 1 or later. / 条件：成功接待至少 1 次，且营业日不少于第 1 天。

Train at 7:42, second carriage, same door: that's my weekday in three facts. The station coffee machine swallowed my coins this morning, so your café is an unscheduled entry. For the record, the chair is considerably better than platform two.

七点四十二分的车，第二节车厢，同一扇门：三个信息就能概括我的工作日。今早车站的咖啡机吞了硬币，所以这家店算是计划外的一项。郑重说明，这里的椅子比二号站台舒服多了。

### 2. A Pencil Correction / 铅笔改动

Unlock: 2 successful visits; café day 3 or later. / 条件：成功接待至少 2 次，且营业日不少于第 3 天。

The escalator is being repaired, and my usual shortcut now ends at a very definite fence. I tried the riverside entrance instead and still made my train. I've pencilled it into my timetable; apparently the timetable doesn't contain every useful fact.

扶梯正在维修，我的惯常近路现在通向一道毫不含糊的围栏。我改走了河边的入口，仍然赶上了车。已经用铅笔记在时刻表上了，看来表里也不是写全了所有有用的信息。

### 3. The Longer Route / 长一点的路

Unlock: 3 successful visits; café day 5 or later. / 条件：成功接待至少 3 次，且营业日不少于第 5 天。

I timed the river route properly: four extra minutes, one heron, no traffic lights. The escalator is working again, but I went the long way anyway. I've decided not to put the heron in the spreadsheet; it would spoil the formatting.

认真测过河边那条路了：多花四分钟，一只苍鹭，没有红绿灯。扶梯已经修好，我还是绕了远路。我决定不把苍鹭填进表格，会破坏格式。

### 4. Ten Minutes in Reserve / 留出十分钟

Unlock: 4 successful visits; café day 7 or later. / 条件：成功接待至少 4 次，且营业日不少于第 7 天。

I left home ten minutes earlier today, then spent those ten minutes sitting here with my phone zipped away. No efficiency gains to report, unless finishing a warm drink counts. It felt suspiciously like getting part of the morning back.

今天提前十分钟出门，然后把这十分钟花在这里坐着，手机好好待在拉上拉链的包里。暂时没有效率提升可以汇报，除非喝完一杯还温热的饮料也算。感觉简直像是把早晨拿回来了一小块。

### 5. The Blank Square / 空白的一格

Unlock: 5 successful visits; café day 9 or later. / 条件：成功接待至少 5 次，且营业日不少于第 9 天。

My new timetable has a blank square before the 7:42 train, labelled only 'here'. On rainy days that's this table; on clear days it's the bench by the river. Same train, same second carriage, slightly different weekday.

新版时刻表在七点四十二分的车之前留了一格，只写着“这里”。雨天是这张桌子，晴天是河边的长椅。同一班车，同一节第二车厢，工作日倒是有点不同了。

## Iris / 艾瑞丝 · `iris`

- Role / 身份: Courtyard gardener / 庭院园丁
- Personality: Patient and practical; tells the weather by her pots and laughs at stubborn seedlings.
- 性格：耐心又务实，看花盆就知道天气，也会笑话不肯出芽的小苗。
- Appearance: Honey-brown hair, a green shirt under brown overalls and a satchel; cast 10, Moss Gardener.
- 外观：蜜棕头发、绿色上衣配棕色背带装、挎包；原外观10「苔绿园丁」。
- Favorite / 偏好: `blacktea`; first eligible café day / 最早出场日: 3
- Locale namespace / 文案键前缀: `regular.guest.iris`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[10]`, `look = { skin: 1, hair: 1, hairStyle: 3, shirt: 2, pants: 1 }`, `hairstyle = 3`, `outfit = 'overalls'`, `accessory = 'satchel'`, `accent = '#e6d39d'`.

### 1. The Empty Tub / 空木桶

Unlock: 1 successful visits; café day 3 or later. / 条件：成功接待至少 1 次，且营业日不少于第 3 天。

There's an old wooden tub in our courtyard that has spent two years growing nothing but lost pegs. I've cleared it, checked the drainage, and put in nasturtium seeds. The pegs have had a good run; it's the flowers' turn now.

院子里的旧木桶空了两年，只长出过掉进去的晾衣夹。我清干净桶底，检查了排水孔，种下几粒旱金莲。夹子住得够久了，也该轮到花了。

### 2. Something Green / 一点绿色

Unlock: 2 successful visits; café day 5 or later. / 条件：成功接待至少 2 次，且营业日不少于第 5 天。

Two round little leaves have come up in the tub, looking as if someone left tiny umbrellas in the soil. I nearly watered them twice because I was so pleased, then checked with my finger and left the damp soil alone. Looking after something sometimes means putting the watering can down.

木桶里冒出两片圆圆的小叶子，像有人把小伞插在土里。我一高兴险些又浇一遍水，伸手摸过土，发现还湿着，便停了。照料小苗，有时也得把水壶放下。

### 3. A Place to Lean / 可以倚靠的地方

Unlock: 3 successful visits; café day 7 or later. / 条件：成功接待至少 3 次，且营业日不少于第 7 天。

The stems have started reaching past the rim, so I made a low support from fallen twigs and soft string. The first version leaned worse than the plant did. Four crossed sticks later, everything is standing, including my pride.

茎已经探过桶沿了，我用捡来的树枝和软绳搭了个矮支架。第一版歪得比花苗还厉害。交叉补上四根枝条之后，总算都站稳了，包括我的面子。

### 4. After the Rain / 雨后

Unlock: 4 successful visits; café day 9 or later. / 条件：成功接待至少 4 次，且营业日不少于第 9 天。

Last night's rain loosened one tie, but the stem beneath it was fine. I retied the support and found the first tightly folded bud, hiding on the other side of the tub. Good thing repairs make you walk all the way around.

昨夜的雨冲松了一处绳结，好在下面的茎没事。我重新绑好支架，在木桶背面找到了第一个裹得紧紧的花苞。看来修修补补也有好处，会让人绕到背后看看。

### 5. An Orange Visitor / 橙色的客人

Unlock: 5 successful visits; café day 11 or later. / 条件：成功接待至少 5 次，且营业日不少于第 11 天。

The first flower opened this morning, bright orange against all those round leaves. A neighbour stopped to look and admitted one of the lost pegs was hers. I've left a little stool beside the tub now; apparently the courtyard has an attraction.

今天早上第一朵花开了，圆叶子中间亮着一抹橙色。邻居停下来瞧，还承认以前桶里有一只夹子是她的。我已经在桶旁放了张小凳子，看来院子有新看点了。

## Nico / 尼可 · `nico`

- Role / 身份: Illustrator / 插画师
- Personality: Playful and observant; pockets odd shapes and learns to stop polishing every line.
- 性格：爱玩也善于观察，总收集奇怪的形状，正在学着不把每一笔都改到完美。
- Appearance: Slate-blue hair, lilac jacket and ochre satchel; cast 4, Wisteria Painter.
- 外观：灰蓝头发、淡紫夹克、赭黄挎包；原外观4「紫藤画家」。
- Favorite / 偏好: `latte`; first eligible café day / 最早出场日: 3
- Locale namespace / 文案键前缀: `regular.guest.nico`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[4]`, `look = { skin: 3, hair: 4, hairStyle: 1, shirt: 4, pants: 0 }`, `hairstyle = 5`, `outfit = 'jacket'`, `accessory = 'satchel'`, `accent = '#d5ad73'`.

### 1. A Street in My Pocket / 口袋里的一条街

Unlock: 1 successful visits; café day 3 or later. / 条件：成功接待至少 1 次，且营业日不少于第 3 天。

I'm drawing a postcard of this street, small enough to post and large enough for every wonky drainpipe. I spent an hour making the café roof straight before noticing the real roof isn't. The building has better ideas about character than I do.

我想把这条街画成明信片，小到能寄走，又大到装得下每根歪歪的排水管。我花了一小时把咖啡店屋顶画直，抬头才发现真的屋顶就不直。这栋房子比我更懂什么叫特点。

### 2. An Accidental Cat / 意外的猫

Unlock: 2 successful visits; café day 5 or later. / 条件：成功接待至少 2 次，且营业日不少于第 5 天。

A splash of wash landed in the postcard's empty corner, exactly where I had planned to put a very respectable tree. Two ears later, it was a cat sitting beside the drainpipe. The tree has been reassigned to the next drawing.

一滴颜料落在明信片的空角上，那里原本计划长一棵很端正的树。添上两只耳朵后，它成了排水管旁边坐着的猫。树已经调岗，去下一张画了。

### 3. Only Two Inks / 只用两种墨

Unlock: 3 successful visits; café day 7 or later. / 条件：成功接待至少 3 次，且营业日不少于第 7 天。

The print shop suggested two inks to keep my little postcard affordable, so the sky and the cat now share the same blue. I thought that would feel like losing a colour. Instead, the whole street looks as if it knows the same secret.

为了让这张小明信片印得划算些，印刷店建议只用两种墨，于是天空和猫共用了同一种蓝。我本以为会觉得少了一种颜色。结果整条街看起来像是共享着一个小秘密。

### 4. The Crooked Proof / 有点歪的样张

Unlock: 4 successful visits; café day 9 or later. / 条件：成功接待至少 4 次，且营业日不少于第 9 天。

The first proof came back with the blue layer a little off, giving every window a strange little shadow. We fixed the alignment for the final batch, but I kept the crooked one in my sketchbook. It's a useful reminder that charming and readable still need to get along.

第一张样张的蓝色有点错位，每扇窗都拖着一小截奇怪的影子。正式印刷前我们对准了位置，那张歪样张却被我收进了速写本。它提醒我，好玩和看得清还是得相处好。

### 5. Six on a String / 绳子上的六张

Unlock: 5 successful visits; café day 11 or later. / 条件：成功接待至少 5 次，且营业日不少于第 11 天。

June, who runs the bookshop, hung six postcards from a string by her till, and someone bought one before I'd finished explaining the blue cat. I used my own copy to write home instead of saving it in a drawer. Now this little street is going somewhere.

经营书店的六月把六张明信片夹在收银台旁的细绳上，我还没解释完那只蓝猫，就有人买走了一张。我也拿出自己的一张给家里写了信，没有再把它收进抽屉。这条小街终于要出发了。

## June / 六月 · `june`

- Role / 身份: Bookshop owner / 书店店主
- Personality: Quietly witty and welcoming; remembers the book you meant even when you don't.
- 性格：安静亲切，偶尔说句俏皮话；你忘了书名，她倒还记得。
- Appearance: Brown hair, a cream shirt, a warm-brown vest and glasses; cast 7, Cream Book Lover.
- 外观：棕发、奶油色上衣、暖棕色背心、眼镜；原外观7「奶油书迷」。
- Favorite / 偏好: `cappuccino`; first eligible café day / 最早出场日: 5
- Locale namespace / 文案键前缀: `regular.guest.june`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[7]`, `look = { skin: 2, hair: 0, hairStyle: 0, shirt: 7, pants: 0 }`, `hairstyle = 0`, `outfit = 'vest'`, `accessory = 'glasses'`, `accent = '#9e7357'`.

### 1. The Squeaking Cart / 吱呀响的书车

Unlock: 1 successful visits; café day 5 or later. / 条件：成功接待至少 1 次，且营业日不少于第 5 天。

My bookshop cart announces every delivery with a squeak loud enough to count as a reading. I've decided to clear its bottom shelf for books people can borrow without buying. First I need somewhere else to put eleven years of spare paper bags.

书店的小推车每次送书都吱呀作响，声音大得够举办一场朗读会。我打算清出底层，放一些不必购买也能借走的书。首先得给攒了十一年的纸袋找个新家。

### 2. A Ticket in Chapter Four / 第四章的车票

Unlock: 2 successful visits; café day 7 or later. / 条件：成功接待至少 2 次，且营业日不少于第 7 天。

While sorting books for the cart, I found an old bus ticket between the pages of a gardening guide. Someone had underlined 'leave room to grow' twice. I've kept the ticket as its bookmark; whoever reads it next may appreciate the accidental advice.

整理要放上推车的书时，我在园艺指南里翻到一张旧车票。有人把“留出成长的空间”画了两道线。我留下车票当书签，说不定下一位读者也会喜欢这句偶然碰到的提醒。

### 3. Help Yourself / 请自己挑一本

Unlock: 3 successful visits; café day 9 or later. / 条件：成功接待至少 3 次，且营业日不少于第 9 天。

I wrote 'Please borrow a book' on the cart, but everyone kept asking whether I really meant it. A second sign now says 'Yes, really', which seems to have helped. The gardening guide went out before lunchtime.

我在书车上写了“欢迎借一本”，大家却总来问是不是真的可以。现在旁边又贴了张“真的可以”，看来很管用。还没到午饭时间，园艺指南就借走了。

### 4. A Softer Wheel / 安静一点的轮子

Unlock: 4 successful visits; café day 11 or later. / 条件：成功接待至少 4 次，且营业日不少于第 11 天。

The cart is quiet at last: a loose wheel fitting needed tightening, not an elaborate farewell ceremony. The gardening guide came back too, with the bus ticket intact and a pencilled note recommending chapter six. I've put a little notebook on the shelf for more tips like that.

小推车终于安静了，原来只是轮子上的螺丝松了，还没到需要隆重告别的时候。园艺指南也回来了，旧车票还在，旁边多了句铅笔写的“推荐第六章”。我在架上放了个小本子，专门收这些提醒。

### 5. A Good Empty Shelf / 空架子也不错

Unlock: 5 successful visits; café day 13 or later. / 条件：成功接待至少 5 次，且营业日不少于第 13 天。

Only two books were left on the borrowing shelf when I closed yesterday. For once, an empty patch in the shop means something is going well. I saved the last paper bag for returned books and recycled the rest; eleven years was quite enough.

昨天打烊时，借书那层只剩下两本了。店里难得有一处空着反而说明事情进展不错。我留了最后一个纸袋装还回来的书，其他的都回收了，十一年确实够久了。

## Alba / 阿尔芭 · `alba`

- Role / 身份: New neighbour / 新搬来的邻居
- Personality: Warm and candid; turns small mishaps into invitations and slowly feels at home.
- 性格：热情直率，会把小岔子聊成邀请，正在慢慢习惯新的家。
- Appearance: Blond hair, rose cardigan and a bow; cast 13, Peach Cardigan.
- 外观：金发、玫瑰色开衫、蝴蝶结；原外观13「桃子开衫」。
- Favorite / 偏好: `hotchoc`; first eligible café day / 最早出场日: 5
- Locale namespace / 文案键前缀: `regular.guest.alba`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[13]`, `look = { skin: 1, hair: 2, hairStyle: 1, shirt: 5, pants: 1 }`, `hairstyle = 1`, `outfit = 'cardigan'`, `accessory = 'bow'`, `accent = '#8caa9a'`.

### 1. The Box Marked Kitchen / 写着“厨房”的箱子

Unlock: 1 successful visits; café day 5 or later. / 条件：成功接待至少 1 次，且营业日不少于第 5 天。

I've moved into the flat around the corner, and the box marked 'kitchen' contains three lamps and a scarf. All my mugs are somewhere else, probably enjoying a much better system. Until I find them, this may be my most organised breakfast spot.

我刚搬进拐角的公寓，写着“厨房”的箱子里装了三盏灯和一条围巾。杯子们都在别处，大概享受着更高明的分类方式。在找到它们之前，这里可能是我最井井有条的早餐角。

### 2. One Curtain Too Short / 少了一截的窗帘

Unlock: 2 successful visits; café day 7 or later. / 条件：成功接待至少 2 次，且营业日不少于第 7 天。

I found the mugs inside the laundry basket, so that mystery is solved. The curtains are another matter: one stops a hand's width above the sill, and the evening sun goes straight through the gap. I've put my unpacking chair there; it turns out to be the nicest patch of light in the flat.

在洗衣篮里找到杯子了，案子告破。窗帘还有点问题，其中一幅离窗台差一掌宽，傍晚的阳光正好从缝里照进来。我把拆箱时坐的椅子搬过去，发现那竟是整间屋子光线最好的一角。

### 3. Four Different Bowls / 四只不一样的碗

Unlock: 3 successful visits; café day 9 or later. / 条件：成功接待至少 3 次，且营业日不少于第 9 天。

I invited the people next door for noodles before counting my bowls; there are four, and none match. They brought their own chopsticks and said the funny curtain gap made the room look cheerful. We ate with the moving boxes still stacked behind us.

我先请了隔壁来吃面，才想起数碗：一共四只，谁和谁也配不成一套。他们自带了筷子，还说那道古怪的窗帘缝让房间显得很有精神。我们就背靠着一摞搬家箱吃完了面。

### 4. Letters by the Bell / 门铃旁的名字

Unlock: 4 successful visits; café day 11 or later. / 条件：成功接待至少 4 次，且营业日不少于第 11 天。

My name is finally beside the doorbell, written on a strip cut from the last moving box. I put it in upside down the first time, which the neighbour from our noodle dinner spotted immediately. We agreed that's a better introduction than another anonymous bell.

门铃旁终于有我的名字了，写在最后一个搬家箱剪下来的纸条上。第一次居然装反了，上回一起吃面的邻居马上就看见了。我们一致觉得，这总比一枚没名字的门铃好认识。

### 5. A Place for the Spare Mug / 备用杯的位置

Unlock: 5 successful visits; café day 13 or later. / 条件：成功接待至少 5 次，且营业日不少于第 13 天。

The boxes are gone, but I've kept the short curtain and the four mismatched bowls. There's a spare mug by the kettle for whoever knocks, and I know which bell is mine without checking now. I'll still come here for breakfast; it's nice having more than one familiar doorway.

箱子全收完了，短窗帘和四只不配套的碗却都留下了。水壶旁摆着备用杯，谁来敲门都能用，我现在也不用仔细看就知道哪枚门铃是自己的了。早餐还是会来这里的，有不止一扇熟悉的门，挺好的。

## Ren / 阿任 · `ren`

- Role / 身份: Bicycle courier / 骑行配送员
- Personality: Quick, good-humoured and alert; knows every shortcut but is learning where to stop.
- 性格：利落、爱开玩笑、眼尖；熟悉每条近路，也在学着找地方歇脚。
- Appearance: Dark hair and a mint hoodie; cast 6, Mint Rider.
- 外观：深棕头发、薄荷色连帽衫；原外观6「薄荷骑手」。
- Favorite / 偏好: `coldbrew`; first eligible café day / 最早出场日: 7
- Locale namespace / 文案键前缀: `regular.guest.ren`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[6]`, `look = { skin: 1, hair: 0, hairStyle: 3, shirt: 6, pants: 2 }`, `hairstyle = 7`, `outfit = 'hoodie'`, `accessory = 'none'`, `accent = '#eddbb8'`.

### 1. One Extra Rattle / 多出来的响声

Unlock: 1 successful visits; café day 7 or later. / 条件：成功接待至少 1 次，且营业日不少于第 7 天。

I can usually name a street by the rattle it gives my bicycle, but today the bike kept making the same noise everywhere. Turns out a loose lunch tin was bouncing in the front basket. I've come in to eat the evidence before my next delivery.

光听自行车颠出来的响声，我通常就能猜到走在哪条街，今天却到处都是同一种声音。原来是午饭盒在前篮里蹦。我来把证据吃掉，再去送下一单。

### 2. Number Twenty-Seven A / 二十七号甲

Unlock: 2 successful visits; café day 9 or later. / 条件：成功接待至少 2 次，且营业日不少于第 9 天。

I spent ten minutes looking for 27A, which lives behind a gate labelled simply '27'. The resident showed me the side entrance and said every courier gets lost there. With their permission, I sketched the turn in the depot's route notebook; one mystery fewer for the next rider.

今天找二十七号甲花了十分钟，它藏在一扇只写着“二十七号”的门后。住户带我看了侧门，说每个配送员都在这里迷路。问过他们同意后，我把转弯处画进了站点的路线本，下一位骑手能少破一个案子。

### 3. The Blue Circle / 蓝色圆圈

Unlock: 3 successful visits; café day 11 or later. / 条件：成功接待至少 3 次，且营业日不少于第 11 天。

Someone added a blue circle to my route sketch: a public tap beside the little square. I've marked a bike rack and a sheltered bench too, in a different colour from the delivery stops. A useful route can have places where you aren't going anywhere.

有人在我的路线图上添了个蓝圈，是小广场旁的公共饮水处。我又标出了停车架和避雨长椅，特意用了和送货点不同的颜色。好用的路线，也可以画出暂时哪儿都不去的地方。

### 4. Rain on the Map / 地图上的雨

Unlock: 4 successful visits; café day 13 or later. / 条件：成功接待至少 4 次，且营业日不少于第 13 天。

Rain blurred the corner of the notebook, so I copied our notes onto a fresh sheet and slipped it into a clear sleeve. Another rider corrected the square's opening hours before I made copies. The map is slower work than a delivery, but it's getting more useful with every pair of eyes.

雨把路线本的一角打花了，我重新抄到纸上，套进透明保护袋。复印前，另一位骑手纠正了广场的开放时间。做地图比送一单慢多了，不过每多一双眼睛，它就更好用一点。

### 5. A Stop of My Own / 给自己的一站

Unlock: 5 successful visits; café day 15 or later. / 条件：成功接待至少 5 次，且营业日不少于第 15 天。

The depot has copies of our little map now, and 27A even has a clearer sign. I've added one private mark to mine: this café, for a break after the last delivery. The lunch tin stays quiet these days; I actually empty it on time.

站点现在有了我们那张小地图的副本，二十七号甲也换上了更清楚的牌子。我给自己的那份另外加了一处标记：这家店，送完最后一单就来歇歇。午饭盒最近安静多了，我总算会按时把它吃空。

## Tess / 苔丝 · `tess`

- Role / 身份: Flower-shop assistant / 花店店员
- Personality: Bright and resourceful; sees a place for bent stems and asks direct, cheerful questions.
- 性格：爽快活泼，善于变通；弯了的花枝也能找到合适的位置。
- Appearance: Brown hair, a green shirt under brown overalls and a rose bow; cast 2, Flower-Shop Girl.
- 外观：棕发、绿色上衣配棕色背带装、玫瑰色蝴蝶结；原外观2「花店姑娘」。
- Favorite / 偏好: `fruittea`; first eligible café day / 最早出场日: 7
- Locale namespace / 文案键前缀: `regular.guest.tess`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[2]`, `look = { skin: 2, hair: 0, hairStyle: 0, shirt: 2, pants: 1 }`, `hairstyle = 4`, `outfit = 'overalls'`, `accessory = 'bow'`, `accent = '#d58e98'`.

### 1. The Crooked Stems / 弯弯的花枝

Unlock: 1 successful visits; café day 7 or later. / 条件：成功接待至少 1 次，且营业日不少于第 7 天。

A delivery arrived at the flower shop with three perfectly healthy stems bent into the shape of question marks. They won't fit the tall bouquet I planned, but throwing them out would feel ridiculous. I've brought my sketchbook to work out what sort of vase likes questions.

花店新到的三根花枝长得好好的，却弯得像三个问号。它们放不进原定的高花束，丢掉又实在可惜。我带着速写本来想想，什么样的花瓶会喜欢问号。

### 2. Low and Wide / 矮一点，宽一点

Unlock: 2 successful visits; café day 9 or later. / 条件：成功接待至少 2 次，且营业日不少于第 9 天。

The answer was a low bowl, not a taller vase: the stems lean out over the edge as if they're chatting. My manager let me try the arrangement in the shop window. I turned the most crooked flower toward the street; it deserved the best view.

答案是浅碗，不是更高的花瓶，花枝伸出碗沿，像在凑着聊天。店长让我试着把这组花摆进橱窗。我把最弯的那朵转向街道，它值得看最好的风景。

### 3. Just Because / 不为什么也可以

Unlock: 3 successful visits; café day 11 or later. / 条件：成功接待至少 3 次，且营业日不少于第 11 天。

Someone liked the window bowl but asked whether it was strange to buy flowers with no occasion. I wrote a tiny card saying 'Just because' and tucked it beside the display. By closing time, two people had asked for the same card with their flowers.

有人喜欢橱窗里的浅碗花，却问没什么特别的日子买花会不会很奇怪。我写了张“不为什么也可以”的小卡片，放在花旁边。打烊前已经有两个人想给自己的花也配一张。

### 4. A Different Kind of Order / 另一种订单

Unlock: 4 successful visits; café day 13 or later. / 条件：成功接待至少 4 次，且营业日不少于第 13 天。

We got an order for a little kitchen table: nothing tall, nothing formal, and definitely room left for toast. I used the low-bowl idea with fresh stems and checked its width against a breakfast plate. That's the first arrangement I've designed around crumbs.

这次收到的订单是给一张小厨房餐桌：别太高，别太正式，而且一定要留得下吐司的位置。我用新鲜花枝重做了浅碗方案，还拿早餐盘比了比宽度。这是我第一次围着面包屑设计花。

### 5. The Bent-Stem Notebook / 弯花枝笔记

Unlock: 5 successful visits; café day 15 or later. / 条件：成功接待至少 5 次，且营业日不少于第 15 天。

I've started a notebook of small arrangements, with a photo of those three question-mark stems on the first page. My manager wants one new window idea each week, and I've already drawn a vase made from an old teapot. It has a spout, which feels like a very promising complication.

我开始记录小型花艺，第一页就贴着那三根问号花枝的照片。店长想每周换一个橱窗点子，我已经画好了用旧茶壶当花器的草图。它还有一张壶嘴，感觉是个很值得期待的麻烦。

## Sam / 山姆 · `sam`

- Role / 身份: Repair-shop owner / 修理铺店主
- Personality: Reserved and steady; prefers useful things and shows affection by making them work again.
- 性格：话少稳当，偏爱实用的东西，关心常常藏在修好的小物件里。
- Appearance: Copper hair and a brick-red jacket; cast 24, Cinnamon Jacket.
- 外观：铜红头发、砖红夹克；原外观24「肉桂短夹克」。
- Favorite / 偏好: `flatwhite`; first eligible café day / 最早出场日: 9
- Locale namespace / 文案键前缀: `regular.guest.sam`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[24]`, `look = { skin: 0, hair: 3, hairStyle: 1, shirt: 0, pants: 1 }`, `hairstyle = 5`, `outfit = 'jacket'`, `accessory = 'none'`, `accent = '#ebd4a4'`.

### 1. A Tune That Stops / 停在一半的曲子

Unlock: 1 successful visits; café day 9 or later. / 条件：成功接待至少 1 次，且营业日不少于第 9 天。

A customer brought in a wind-up music box that stops halfway through its tune. She doesn't remember the song's name, only that her father used to wind it after supper. I've put it on the quiet end of the bench; some jobs need listening space.

有位客人送来一只上弦音乐盒，曲子播到一半就停。她不记得曲名，只记得父亲以前晚饭后会给它上弦。我把它放在工作台安静的那一头，有些活得留地方好好听。

### 2. The Small Missing Piece / 缺掉的小东西

Unlock: 2 successful visits; café day 11 or later. / 条件：成功接待至少 2 次，且营业日不少于第 11 天。

The music box has a damaged gear, and the maker stopped producing that size long ago. I found a possible match in my drawer of parts worth keeping, right under a button that has no business being there. I'll check the fit before promising anything.

音乐盒坏了一只齿轮，厂家早就不做这个尺寸了。我在留存零件的抽屉里找到个可能合适的，压在一枚根本不该出现在那里的纽扣下面。先试合不合适，再说能不能修好。

### 3. Beyond the Pause / 越过停顿

Unlock: 3 successful visits; café day 13 or later. / 条件：成功接待至少 3 次，且营业日不少于第 13 天。

The replacement fits, and today the tune made it past the place where it always stopped. It still runs unevenly, so there's more adjusting to do. I caught myself holding my breath for that one extra note.

替换的零件装得上，今天曲子终于越过了总停下的地方。转起来还不匀，得再调调。我发现自己为了听到多出来的那个音，居然一直憋着气。

### 4. The Whole Song / 完整的一曲

Unlock: 4 successful visits; café day 15 or later. / 条件：成功接待至少 4 次，且营业日不少于第 15 天。

I played the music box for its owner, and she hummed the ending before it reached it. She still couldn't name the song, but that didn't seem important anymore. We left the scratch on the lid alone; she said she'd made it herself years ago.

我把修好的音乐盒放给主人听，还没播到结尾，她已经哼出了后面的旋律。她仍然叫不出曲名，不过好像已经不重要了。盒盖上的划痕没处理，她说那是自己很多年前留下的。

### 5. Space in the Drawer / 抽屉里的空位

Unlock: 5 successful visits; café day 17 or later. / 条件：成功接待至少 5 次，且营业日不少于第 17 天。

The music box is home, and there's one useful gap in my spare-parts drawer. I finally sorted the drawer and put that stray button in its own tin. When I closed the shop, I was still humming a tune I don't know the name of.

音乐盒回家了，备件抽屉里也空出一个有用的位置。我总算把抽屉整理了一遍，那枚走错地方的纽扣也有了自己的小盒子。关店时我还在哼一首不知道名字的曲子。

## Vivi / 薇薇 · `vivi`

- Role / 身份: Community choir member / 社区合唱团成员
- Personality: Expressive and self-deprecating; talks in musical phrases and makes room for quieter voices.
- 性格：表情丰富，爱拿自己打趣，说话带着节拍，也愿意听见安静的声音。
- Appearance: Rose-pink hair and shirt, a cream scarf and glasses; cast 21, Rose Scarf.
- 外观：玫瑰粉头发及上衣、奶油色围巾、眼镜；原外观21「玫瑰围巾」。
- Favorite / 偏好: `lemontea`; first eligible café day / 最早出场日: 9
- Locale namespace / 文案键前缀: `regular.guest.vivi`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[21]`, `look = { skin: 0, hair: 5, hairStyle: 3, shirt: 5, pants: 2 }`, `hairstyle = 7`, `outfit = 'scarf'`, `accessory = 'glasses'`, `accent = '#9e687a'`.

### 1. One Beat Early / 早了一拍

Unlock: 1 successful visits; café day 9 or later. / 条件：成功接待至少 1 次，且营业日不少于第 9 天。

I joined the community choir and made a spectacular entrance, exactly one beat before everyone else. The conductor said enthusiasm was welcome, though preferably on the right beat. I've drawn a giant rest on my music, just in case enthusiasm can't read small print.

我加入社区合唱团，来了一次非常醒目的开口，足足比大家早了一拍。指挥说欢迎热情，不过最好在对的拍子上。我在谱子上画了个巨大的休止符，免得热情看不清小字。

### 2. The Pencil Mark / 铅笔记号

Unlock: 2 successful visits; café day 11 or later. / 条件：成功接待至少 2 次，且营业日不少于第 11 天。

The singer beside me showed me where to breathe, and suddenly the long phrase felt possible. I lent her my spare pencil because hers had worn down to a wooden whisper. We now have matching marks in our scores, which feels like a very quiet sort of teamwork.

旁边的团员告诉我该在哪儿换气，那句长长的旋律一下就唱得完了。我把备用铅笔借给她，她原来那支短得快只剩一声木头的叹息。现在我们的谱子上有一样的记号，像一种很安静的配合。

### 3. Without the Loudest Voice / 少了最响的声音

Unlock: 3 successful visits; café day 13 or later. / 条件：成功接待至少 3 次，且营业日不少于第 13 天。

Our loudest singer was away, so rehearsal sounded alarmingly empty for the first few bars. Then I could hear a low harmony I'd never noticed, and I tried fitting my voice around it. We finished more softly than usual, but nobody had disappeared.

嗓门最大的团员请假了，排练开头几小节空得让人有点慌。后来我听见了以前没注意过的低声部，试着让自己的声音贴着它走。唱完时比平常轻了些，却没有谁的声音不见了。

### 4. The Hall Rehearsal / 到礼堂排练

Unlock: 4 successful visits; café day 15 or later. / 条件：成功接待至少 4 次，且营业日不少于第 15 天。

We rehearsed in the little hall today, where every footstep sounds important and the last row is surprisingly far away. I missed a word, found the next line, and kept going with everyone else. The giant pencil rest did its job; my entrance was right on time.

今天到小礼堂排练，每一下脚步声都显得很郑重，最后一排居然那么远。我漏了一个词，找到下一句，就跟着大家继续唱了。那个巨大的铅笔休止符很管用，这次开口刚好。

### 5. The Last Note / 最后一个音

Unlock: 5 successful visits; café day 17 or later. / 条件：成功接待至少 5 次，且营业日不少于第 17 天。

The concert ended, and for one lovely second the last chord seemed to stay in the hall without us. Then someone in the back clapped too early, which I appreciated on a personal level. I've signed up for the next term and bought a whole box of pencils to share.

演出结束时，有那么美好的一秒，最后一个和弦像是离开我们，自己留在了礼堂里。随后后排有人提前鼓了掌，从个人经历来说，我非常理解。我已经报名下期，还买了整盒铅笔，准备分给大家。

## Otto / 奥托 · `otto`

- Role / 身份: Postal carrier / 邮递员
- Personality: Measured and kind; remembers doorways and takes the small responsibilities seriously.
- 性格：不急不躁，温和认真，记得每一处门口，也把小小的托付放在心上。
- Appearance: Copper hair, brick-red duffle coat and a satchel; cast 8, Maple Post Carrier.
- 外观：铜红头发、砖红牛角扣外套、挎包；原外观8「枫叶邮差」。
- Favorite / 偏好: `cortado`; first eligible café day / 最早出场日: 11
- Locale namespace / 文案键前缀: `regular.guest.otto`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[8]`, `look = { skin: 0, hair: 3, hairStyle: 0, shirt: 0, pants: 1 }`, `hairstyle = 4`, `outfit = 'duffle'`, `accessory = 'satchel'`, `accent = '#e8c68c'`.

### 1. The Unsent Postcard / 没寄出的明信片

Unlock: 1 successful visits; café day 11 or later. / 条件：成功接待至少 1 次，且营业日不少于第 11 天。

I found a seaside postcard in an old coat pocket, bought for my sister last year and never posted. I deliver letters all day, yet apparently I can carry one around for twelve months without noticing. There's a gull printed in the corner, looking rather disappointed in me.

我在旧外套口袋里找到一张海边明信片，去年买给姐姐，却一直没寄。我整天送信，居然也能把一封放在身上带十二个月都没发现。角落印着一只海鸥，看起来对我挺失望的。

### 2. What I Remember / 真正记得的事

Unlock: 2 successful visits; café day 13 or later. / 条件：成功接待至少 2 次，且营业日不少于第 13 天。

I tried writing about the trip and couldn't remember the hotel's name or the day we arrived. What I do remember is a pebble getting into my shoe while I ate a melting ice cream. I think my sister would rather hear about that than a perfect itinerary.

想写那次旅行，却记不起旅馆叫什么，也记不起哪天到的。我倒记得一边吃快融化的冰淇淋，一边有颗石子钻进鞋里。比起一份完美的行程表，姐姐大概更想听这个。

### 3. Through the Slot / 投进信口

Unlock: 3 successful visits; café day 15 or later. / 条件：成功接待至少 3 次，且营业日不少于第 15 天。

The postcard is written: one stubborn pebble, one crooked gull, and a question about the shelf we built in her kitchen. I put a stamp on it and slipped it into the postbox after my round. For once, I don't know exactly which pair of hands will carry the next part.

明信片写好了：一颗赖着不走的石子，一只歪歪的海鸥，再问问我们一起做的厨房架子怎么样。我贴好邮票，跑完投递路线后，把它投进邮筒。这回，我倒不知道接下来会是哪双手带着它走。

### 4. The Crooked Shelf / 有点歪的架子

Unlock: 4 successful visits; café day 17 or later. / 条件：成功接待至少 4 次，且营业日不少于第 17 天。

My sister replied with a photo of the kitchen shelf, still slightly crooked and still holding her teacups. She remembers the day we built it because I dropped a screw into the flour tin. Her letter was mostly ordinary things; I read it twice before taking my coat off.

姐姐回信了，附着厨房架子的照片，它还是有点歪，还是摆着她的茶杯。她记得我们做架子那天，因为我把一颗螺丝掉进了面粉罐。信里大多是寻常小事，我却外套还没脱就读了两遍。

### 5. One Blank Card / 留一张空白卡

Unlock: 5 successful visits; café day 19 or later. / 条件：成功接待至少 5 次，且营业日不少于第 19 天。

I've put her letter in the drawer beside my stamps, and a fresh blank card in my bag. This time I'll write about the café window and the first yellow leaf on my round, before I forget them. My sister says the kitchen shelf has room for one more postcard.

我把姐姐的信收在邮票旁的抽屉里，包里放进一张新的空白卡。这回想写咖啡店的窗，还有投递路上第一片黄叶，趁着还没忘掉。姐姐说，厨房架子上还放得下一张明信片。

## Luz / 露兹 · `luz`

- Role / 身份: Translator / 译者
- Personality: Thoughtful and gently playful; listens for what people mean and keeps room for their own words.
- 性格：细心温柔，偶尔俏皮，留意话里的意思，也珍惜说话人自己的用词。
- Appearance: Rose-pink hair and shirt, a cream scarf and a tan satchel; cast 29, Peach Travel Bag.
- 外观：玫瑰粉头发及上衣、奶油色围巾、棕色挎包；原外观29「蜜桃旅行包」。
- Favorite / 偏好: `hojicha`; first eligible café day / 最早出场日: 11
- Locale namespace / 文案键前缀: `regular.guest.luz`
- Exact pixel binding / 固定像素绑定: `CUSTOMER_CAST[29]`, `look = { skin: 1, hair: 5, hairStyle: 2, shirt: 5, pants: 1 }`, `hairstyle = 2`, `outfit = 'scarf'`, `accessory = 'satchel'`, `accent = '#ae7159'`.

### 1. A Little, Enough / 少许，够了就好

Unlock: 1 successful visits; café day 11 or later. / 条件：成功接待至少 1 次，且营业日不少于第 11 天。

I'm translating my grandmother's recipe notebook for a cousin who lives abroad. Her measurements include 'a little', 'the blue bowl', and 'you'll know when it's enough'. I translate for a living, but the blue bowl may be my toughest reference yet.

我在帮住在国外的表亲翻译祖母的食谱本。她的计量单位包括“少许”“那个蓝碗”和“你觉得够了就好”。我靠翻译吃饭，可那个蓝碗可能是我查过最难的资料。

### 2. The Bowl on the Shelf / 架上的蓝碗

Unlock: 2 successful visits; café day 13 or later. / 条件：成功接待至少 2 次，且营业日不少于第 13 天。

I found the blue bowl on the top kitchen shelf, with a tiny chip near the rim that marks her usual water level. We measured it together and wrote the amount beside the old words. She insisted I keep 'the blue bowl' too, because otherwise it wouldn't sound like her.

蓝碗找到了，在厨房最高那层架上，碗沿附近的小缺口正好标着她惯常加水的位置。我们一起量过，把份量记在原来的话旁边。她坚持也要留下“那个蓝碗”，不然就不像她写的了。

### 3. What She Meant by Golden / 她说的金黄

Unlock: 3 successful visits; café day 15 or later. / 条件：成功接待至少 3 次，且营业日不少于第 15 天。

We cooked the flatbreads together, and I discovered that her 'golden' means the colour underneath, not the flour-dusted top. I took a photo of one turned over and added it to the draft. Some words become much easier when you can lift the pan.

我们一起做了薄饼，我才知道她说的“金黄”指的是底面，不是撒着面粉的上面。我把一张饼翻过来拍照，添进译稿。有些词，能端起锅看看就好懂多了。

### 4. Both Pages / 左右两页

Unlock: 4 successful visits; café day 17 or later. / 条件：成功接待至少 4 次，且营业日不少于第 17 天。

The booklet is laid out with her handwritten page on the left and my translation on the right. I was about to clean up a flour smudge in the scan, then noticed it covered a correction she'd made. We kept the smudge and added a note; the recipe had learned something there.

小册子排好了，左边是她的手写页，右边是我的翻译。我原本想修掉扫描图上一点面粉印，后来发现下面压着她改过的一笔。我们留下了印子，又加了说明，这张食谱也是在那儿学会了一点东西。

### 5. Two Kitchens / 两间厨房

Unlock: 5 successful visits; café day 19 or later. / 条件：成功接待至少 5 次，且营业日不少于第 19 天。

My cousin sent a photo of the finished flatbreads, along with a note about the different flour she used. Grandmother wants that note on the next page, in both languages. The booklet finally has a title: 'The Blue Bowl', which now belongs in two kitchens.

表亲寄来做好的薄饼照片，还写了她换用另一种面粉的心得。祖母想把那段话也加到下一页，两种语言都写。小册子终于有了名字：《那个蓝碗》，现在它同时住在两间厨房里。
