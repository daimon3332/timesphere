/**
 * Plain-language explainers for North American zone names (美西时间, PST,
 * PDT...). Static facts only; which variant is in force and when the next
 * switch happens are computed from the platform's tzdata at render time.
 */
export interface ZoneVariant {
  abbr: string
  nameZh: string
  nameEn: string
  offset: number
  /** US calendar rule for this half of the year */
  periodZh: string
}

export interface ZoneGuide {
  id: string
  titleZh: string
  titleEn: string
  /** colloquial Chinese name, if any */
  colloquialZh?: string
  summaryZh: string
  standard: ZoneVariant
  daylight: ZoneVariant | null
  /** zones that follow the standard/daylight pair exactly */
  zones: string[]
  citiesZh: string
  /** zones inside the region that deviate, with what to say about them */
  exceptions: Record<string, ZoneException>
  notesZh: string[]
}

export interface ZoneException {
  noteZh: string
  /**
   * Offset the zone must show from `since` on. A platform that disagrees is
   * running an outdated tzdata and is still computing the old clock rules.
   */
  expect?: { offset: number; since: string }
}

const US_WINTER = '11 月第一个周日 → 次年 3 月第二个周日'
const US_SUMMER = '3 月第二个周日 → 11 月第一个周日'

export const ZONE_GUIDES: ZoneGuide[] = [
  {
    id: 'PT',
    titleZh: '太平洋时间',
    titleEn: 'Pacific Time (PT)',
    colloquialZh: '美西时间',
    summaryZh:
      '“美西时间”是中文俗称，日常基本等同于太平洋时间，通常指美国本土西海岸（加州、俄勒冈州、华盛顿州）以及内华达州。严格说太平洋时区还包括加拿大 BC 省和墨西哥下加利福尼亚州。',
    standard: { abbr: 'PST', nameZh: '太平洋标准时间', nameEn: 'Pacific Standard Time', offset: -480, periodZh: US_WINTER },
    daylight: { abbr: 'PDT', nameZh: '太平洋夏令时间', nameEn: 'Pacific Daylight Time', offset: -420, periodZh: US_SUMMER },
    zones: ['America/Los_Angeles', 'America/Tijuana'],
    citiesZh: '洛杉矶、旧金山、西雅图、圣地亚哥、拉斯维加斯、波特兰',
    exceptions: {
      'America/Vancouver': {
        noteZh:
          'BC 省自 2026 年起不再拨表，全年 UTC-7，官方名称为 Pacific Time（PCT）。因此冬季温哥华比旧金山快 1 小时，夏季两地相同。',
        expect: { offset: -420, since: '2026-11-01T09:00:00Z' },
      },
    },
    notesZh: ['亚利桑那州（凤凰城）常被当作“美西”，但它使用山地时间且不实行夏令时，全年 UTC-7。'],
  },
  {
    id: 'MT',
    titleZh: '山地时间',
    titleEn: 'Mountain Time (MT)',
    summaryZh: '美国落基山脉一带使用的时区，比太平洋时间快 1 小时。',
    standard: { abbr: 'MST', nameZh: '山地标准时间', nameEn: 'Mountain Standard Time', offset: -420, periodZh: US_WINTER },
    daylight: { abbr: 'MDT', nameZh: '山地夏令时间', nameEn: 'Mountain Daylight Time', offset: -360, periodZh: US_SUMMER },
    zones: ['America/Denver', 'America/Boise'],
    citiesZh: '丹佛、盐湖城、阿尔伯克基、博伊西',
    exceptions: {
      'America/Phoenix': {
        noteZh: '亚利桑那州（纳瓦霍保留地除外）不实行夏令时，全年 MST（UTC-7）：冬季与丹佛相同，夏季与洛杉矶相同。',
      },
      'America/Edmonton': {
        noteZh: '阿尔伯塔省自 2026 年起不再拨表，全年 UTC-6。因此冬季卡尔加里、埃德蒙顿比丹佛快 1 小时。',
        expect: { offset: -360, since: '2026-11-01T08:00:00Z' },
      },
    },
    notesZh: [],
  },
  {
    id: 'CT',
    titleZh: '中部时间',
    titleEn: 'Central Time (CT)',
    summaryZh: '美国中部大部分地区使用的时区，比美西时间快 2 小时、比美东时间慢 1 小时。',
    standard: { abbr: 'CST', nameZh: '中部标准时间', nameEn: 'Central Standard Time', offset: -360, periodZh: US_WINTER },
    daylight: { abbr: 'CDT', nameZh: '中部夏令时间', nameEn: 'Central Daylight Time', offset: -300, periodZh: US_SUMMER },
    zones: ['America/Chicago'],
    citiesZh: '芝加哥、达拉斯、休斯顿、新奥尔良、明尼阿波利斯',
    exceptions: {
      'America/Winnipeg': {
        noteZh: '曼尼托巴省自 2026 年起不再拨表，全年 UTC-5。因此冬季温尼伯比芝加哥快 1 小时。',
        expect: { offset: -300, since: '2026-11-01T07:00:00Z' },
      },
      'America/Regina': { noteZh: '萨斯喀彻温省长期不实行夏令时，全年 UTC-6。' },
      'America/Mexico_City': { noteZh: '墨西哥 2022 年起取消夏令时，墨西哥城全年 UTC-6。' },
    },
    notesZh: ['CST 也是“中国标准时间”的缩写，看到 CST 时要结合上下文区分。'],
  },
  {
    id: 'ET',
    titleZh: '东部时间',
    titleEn: 'Eastern Time (ET)',
    colloquialZh: '美东时间',
    summaryZh:
      '“美东时间”即东部时间，指美国东部沿海及部分内陆地区使用的时区。美东与美西执行同一套夏令时规则，所以全年都比美西快 3 小时。',
    standard: { abbr: 'EST', nameZh: '东部标准时间', nameEn: 'Eastern Standard Time', offset: -300, periodZh: US_WINTER },
    daylight: { abbr: 'EDT', nameZh: '东部夏令时间', nameEn: 'Eastern Daylight Time', offset: -240, periodZh: US_SUMMER },
    zones: ['America/New_York', 'America/Toronto', 'America/Detroit'],
    citiesZh: '纽约、华盛顿、波士顿、亚特兰大、迈阿密、费城、底特律；加拿大多伦多、渥太华、蒙特利尔',
    exceptions: {
      'America/Cancun': {
        noteZh: '坎昆所在的金塔纳罗奥州全年 UTC-5，不实行夏令时：冬季与纽约相同，夏季比纽约慢 1 小时。',
      },
    },
    notesZh: [],
  },
  {
    id: 'AKT',
    titleZh: '阿拉斯加时间',
    titleEn: 'Alaska Time (AKT)',
    summaryZh: '阿拉斯加州大部分地区使用，比美西时间慢 1 小时。',
    standard: { abbr: 'AKST', nameZh: '阿拉斯加标准时间', nameEn: 'Alaska Standard Time', offset: -540, periodZh: US_WINTER },
    daylight: { abbr: 'AKDT', nameZh: '阿拉斯加夏令时间', nameEn: 'Alaska Daylight Time', offset: -480, periodZh: US_SUMMER },
    zones: ['America/Anchorage', 'America/Juneau'],
    citiesZh: '安克雷奇、朱诺、费尔班克斯',
    exceptions: {},
    notesZh: [],
  },
  {
    id: 'HT',
    titleZh: '夏威夷时间',
    titleEn: 'Hawaii Time (HST)',
    summaryZh: '夏威夷州不实行夏令时，全年 UTC-10：冬季比美西慢 2 小时，夏季慢 3 小时。',
    standard: { abbr: 'HST', nameZh: '夏威夷标准时间', nameEn: 'Hawaii Standard Time', offset: -600, periodZh: '全年' },
    daylight: null,
    zones: ['Pacific/Honolulu'],
    citiesZh: '檀香山（火奴鲁鲁）',
    exceptions: {},
    notesZh: [],
  },
]

export const GUIDE_BY_ZONE = new Map<string, ZoneGuide>()
for (const g of ZONE_GUIDES) {
  for (const z of [...g.zones, ...Object.keys(g.exceptions)]) GUIDE_BY_ZONE.set(z, g)
}
