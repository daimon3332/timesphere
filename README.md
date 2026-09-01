# 世界时间对比

选择一个基准时区，即时查看全球主要城市的当前时间、日期、星期与时差，并在世界地图上按真实时区边界对比。

## 运行

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 类型检查 + 生产构建
npm test             # 54 个单元测试
npm run lint
```

`public/data/` 中的地图数据已随仓库提供，克隆后无需额外下载即可运行。

## 重新生成数据

```bash
npm run fetch:sources   # 下载原始数据到 .tmp/（约 70 MB）
npm run build:data      # 生成 src/data/ 与 public/data/
```

`build:data` 会校验每座城市的坐标是否落在其声明的 IANA 时区多边形内，
校验失败会直接报错，避免把错误的地理数据带进产品。

## 时间计算的三条硬规则

**1. IANA 是唯一的内部时区标识。** 所有计算都基于 `Intl.DateTimeFormat` 与平台
自带的 tzdata，不维护任何 DST 日期表。

**2. UTC 偏移是计算结果，不是属性。** `offsetMinutes()` 把某一瞬间在目标时区的
挂钟时间还原成 UTC 时间戳再求差，因此 +5:45、−3:30、+12:45 这类非整数时区
和 DST 切换都自然成立。

**3. 时差来自两地的真实偏移，而不是静态偏移相减。**
上海 ↔ 伦敦在 7 月是 7 小时、在 1 月是 8 小时，因为伦敦会在 BST 与 GMT 之间切换。
日期翻页只影响“昨天/明天”标签，绝不会把 1 小时的时差显示成 23 小时。

### 夏令时判定

`isDST` 优先读取 CLDR 的完整时区名（含 `Summer` / `Daylight` 即为夏令时），
这对伦敦、洛杉矶、悉尼、加沙都正确。对 CLDR 只给出 `GMT+02:00` 的时区
（`Antarctica/Troll`、`Africa/Casablanca`）改用「全年占多数的偏移即标准时间」
回退判断。

已知边界情况：`Europe/Dublin` 在 tzdata 中把冬季标记为负 DST，本产品按用户直觉
显示为「爱尔兰标准时间」而非夏令时。`isDST` 仅用于展示，偏移与时差在任何情况下
都是精确的。

## 数据来源

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 时区边界 | timezone-boundary-builder `2026c` | 444 个时区，含公海，简化到 2.5% |
| 国界 | Natural Earth 50m（world-atlas） | 241 个多边形，已标注 alpha-2 |
| 城市地理 | GeoNames `cities15000` | 133 座城市的坐标与时区 |
| 国家↔时区 | `@vvo/tzdb` 6.198.0 | 多时区国家的地区分组 |

时区多边形 3.0 MB（gzip 后约 700 KB），国界 1.4 MB（gzip 后约 411 KB）。

### 数据处理中的三个真实陷阱

**时区多边形会重叠。** 乌鲁木齐同时落在 `Asia/Shanghai` 与 `Asia/Urumqi` 内
（中国全境行政上使用北京时间）。校验因此检查「城市是否属于其声明时区」，
而不是「是否唯一命中」。

**同名时区可能规则不同。** `America/Denver` 与 `America/Phoenix` 都叫
Mountain Time，但凤凰城不实行夏令时；悉尼与布里斯班同为 Australian Eastern Time，
布里斯班不实行夏令时。国家时区选择器按「名称 + 偏移 + 是否有 DST」分组，
否则一年中有半年会给出错误时间。

**`Etc/GMT` 的符号是相反的。** `Etc/GMT+9` 实际是 UTC−9。这些公海时区的原始
id 永远不直接展示，改为按真实偏移显示为「UTC−9 海域」。

## 架构

```
src/
  lib/time.ts        时间引擎：偏移、缩写、DST、时差格式化
  lib/search.ts      搜索索引：城市 / 国家 / IANA / UTC 偏移 / 缩写歧义
  lib/map-style.ts   地图图层常量与 UTC 偏移配色
  data/              构建产物：cities.ts、countries.ts；tz-groups.ts 为人工维护
  store.ts           Zustand：基准、选中、显示模式、图层、收藏
  hooks/useNow.ts    全页唯一的秒级 ticker
  components/        Header、CityGrid、WorldMap、DetailPanel 等
scripts/
  city-seed.ts       城市清单（编辑此文件增删城市）
  build-data.mjs     解析地理数据 + 校验 + 生成
```

### 若干实现选择

**地图城市标签是 DOM 而非 MapLibre symbol 图层。** 这样不依赖远端 glyph 服务器
即可渲染中文，离线可用，并且能用 CSS 控制字体；碰撞按城市等级贪心解决，
一级城市不会被邻近小城市挤掉标签。

**整页只有一个 ticker。** 133 张卡片全部由同一个 `now` 派生，实测 58 fps。
地图每秒重绘 0 次，只有文本在刷新；时区配色仅在整点变化时重新着色。

**`optimizeDeps.exclude: ['maplibre-gl']`** 是必需的：Vite 预打包会重写
maplibre 的 worker 入口导致 404，worker 无法启动时所有 GeoJSON 源都会静默地
解析不出任何要素。

## 无障碍

地图之外始终存在完整城市列表，键盘可 Tab 遍历。每张卡片的 `aria-label`
形如「伦敦，当前时间 05:55，2026-09-01 周二，慢 7 小时」。
`/` 或 `Cmd/Ctrl+K` 打开搜索，`↑↓` 选择，`Enter` 确认，`Esc` 关闭。
地图数据加载失败时城市列表仍完全可用。
