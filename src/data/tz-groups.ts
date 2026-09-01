/**
 * Curated timezone concepts users search for that are not cities: abbreviations,
 * UTC/GMT, and Chinese/English colloquial names.
 *
 * Abbreviations are deliberately many-to-many. CST is China Standard Time AND
 * US Central Standard Time; IST is India, Israel and Ireland. Search must
 * surface every candidate instead of silently picking one.
 */
export interface TzGroup {
  /** primary search token, e.g. CST */
  code: string
  titleZh: string
  titleEn: string
  /** zones this abbreviation can mean, most-expected first */
  zones: { timezone: string; labelZh: string; labelEn: string; citiesZh: string }[]
  aliases: string[]
}

export const TZ_GROUPS: TzGroup[] = [
  {
    code: 'UTC',
    titleZh: '协调世界时',
    titleEn: 'Coordinated Universal Time',
    zones: [{ timezone: 'UTC', labelZh: '协调世界时', labelEn: 'UTC', citiesZh: 'UTC±0' }],
    aliases: ['UTC', 'UTC+0', 'UTC0', 'Z', 'Zulu', '世界时', '协调世界时', '标准时'],
  },
  {
    code: 'GMT',
    titleZh: '格林尼治标准时间',
    titleEn: 'Greenwich Mean Time',
    zones: [
      { timezone: 'Europe/London', labelZh: '英国', labelEn: 'United Kingdom', citiesZh: '伦敦' },
      { timezone: 'UTC', labelZh: '协调世界时', labelEn: 'UTC', citiesZh: 'UTC±0' },
      { timezone: 'Africa/Accra', labelZh: '加纳', labelEn: 'Ghana', citiesZh: '阿克拉' },
    ],
    aliases: [
      'GMT',
      'Greenwich',
      'Greenwich Mean Time',
      '格林尼治',
      '格林尼治时间',
      '格林尼治标准时间',
      '格林威治时间',
      '零时区',
    ],
  },
  {
    code: 'PST',
    titleZh: '美国太平洋时间',
    titleEn: 'Pacific Time (US & Canada)',
    zones: [
      {
        timezone: 'America/Los_Angeles',
        labelZh: '美国太平洋时间',
        labelEn: 'US Pacific Time',
        citiesZh: '洛杉矶 / 旧金山 / 西雅图',
      },
      {
        timezone: 'America/Vancouver',
        labelZh: '加拿大太平洋时间',
        labelEn: 'Canada Pacific Time',
        citiesZh: '温哥华',
      },
    ],
    aliases: [
      'PST',
      'PDT',
      'PT',
      'Pacific Time',
      'Pacific Standard Time',
      'Pacific Daylight Time',
      '太平洋时间',
      '美西时间',
      '美国西部时间',
      '美国太平洋时间',
      '西岸时间',
    ],
  },
  {
    code: 'MST',
    titleZh: '美国山地时间',
    titleEn: 'Mountain Time (US & Canada)',
    zones: [
      {
        timezone: 'America/Denver',
        labelZh: '山地时间（观察夏令时）',
        labelEn: 'Mountain Time (observes DST)',
        citiesZh: '丹佛',
      },
      {
        timezone: 'America/Phoenix',
        labelZh: '山地时间（全年不变）',
        labelEn: 'Mountain Time (no DST)',
        citiesZh: '菲尼克斯',
      },
    ],
    aliases: [
      'MST',
      'MDT',
      'MT',
      'Mountain Time',
      'Mountain Standard Time',
      'Mountain Daylight Time',
      '山地时间',
      '美国山地时间',
    ],
  },
  {
    code: 'CST-US',
    titleZh: '美国中部时间',
    titleEn: 'Central Time (US & Canada)',
    zones: [
      {
        timezone: 'America/Chicago',
        labelZh: '美国中部时间',
        labelEn: 'US Central Time',
        citiesZh: '芝加哥 / 达拉斯 / 休斯顿',
      },
      {
        timezone: 'America/Winnipeg',
        labelZh: '加拿大中部时间',
        labelEn: 'Canada Central Time',
        citiesZh: '温尼伯',
      },
    ],
    aliases: [
      'CST',
      'CDT',
      'CT',
      'Central Time',
      'Central Standard Time',
      'Central Daylight Time',
      '美国中部时间',
      '中部时间',
    ],
  },
  {
    code: 'CST-CN',
    titleZh: '中国标准时间',
    titleEn: 'China Standard Time',
    zones: [
      {
        timezone: 'Asia/Shanghai',
        labelZh: '中国标准时间',
        labelEn: 'China Standard Time',
        citiesZh: '上海 / 北京',
      },
    ],
    aliases: [
      'CST',
      'China Standard Time',
      'Beijing Time',
      '北京时间',
      '中国标准时间',
      '中国时间',
      '国内时间',
    ],
  },
  {
    code: 'EST',
    titleZh: '美国东部时间',
    titleEn: 'Eastern Time (US & Canada)',
    zones: [
      {
        timezone: 'America/New_York',
        labelZh: '美国东部时间',
        labelEn: 'US Eastern Time',
        citiesZh: '纽约 / 华盛顿 / 波士顿',
      },
      {
        timezone: 'America/Toronto',
        labelZh: '加拿大东部时间',
        labelEn: 'Canada Eastern Time',
        citiesZh: '多伦多 / 蒙特利尔',
      },
    ],
    aliases: [
      'EST',
      'EDT',
      'ET',
      'Eastern Time',
      'Eastern Standard Time',
      'Eastern Daylight Time',
      '美东时间',
      '美国东部时间',
      '东部时间',
      '东岸时间',
    ],
  },
  {
    code: 'CET',
    titleZh: '中欧时间',
    titleEn: 'Central European Time',
    zones: [
      { timezone: 'Europe/Paris', labelZh: '法国', labelEn: 'France', citiesZh: '巴黎' },
      { timezone: 'Europe/Berlin', labelZh: '德国', labelEn: 'Germany', citiesZh: '柏林' },
      { timezone: 'Europe/Madrid', labelZh: '西班牙', labelEn: 'Spain', citiesZh: '马德里' },
      { timezone: 'Europe/Rome', labelZh: '意大利', labelEn: 'Italy', citiesZh: '罗马' },
    ],
    aliases: [
      'CET',
      'CEST',
      'Central European Time',
      'Central European Summer Time',
      '中欧时间',
      '欧洲中部时间',
    ],
  },
  {
    code: 'EET',
    titleZh: '东欧时间',
    titleEn: 'Eastern European Time',
    zones: [
      { timezone: 'Europe/Athens', labelZh: '希腊', labelEn: 'Greece', citiesZh: '雅典' },
      { timezone: 'Europe/Helsinki', labelZh: '芬兰', labelEn: 'Finland', citiesZh: '赫尔辛基' },
      { timezone: 'Europe/Kyiv', labelZh: '乌克兰', labelEn: 'Ukraine', citiesZh: '基辅' },
      { timezone: 'Africa/Cairo', labelZh: '埃及', labelEn: 'Egypt', citiesZh: '开罗' },
    ],
    aliases: ['EET', 'EEST', 'Eastern European Time', '东欧时间'],
  },
  {
    code: 'WET',
    titleZh: '西欧时间',
    titleEn: 'Western European Time',
    zones: [
      { timezone: 'Europe/Lisbon', labelZh: '葡萄牙', labelEn: 'Portugal', citiesZh: '里斯本' },
      { timezone: 'Atlantic/Canary', labelZh: '加那利群岛', labelEn: 'Canary Islands', citiesZh: '' },
    ],
    aliases: ['WET', 'WEST', 'Western European Time', '西欧时间'],
  },
  {
    code: 'BST',
    titleZh: '英国夏令时',
    titleEn: 'British Summer Time',
    zones: [
      { timezone: 'Europe/London', labelZh: '英国', labelEn: 'United Kingdom', citiesZh: '伦敦' },
      { timezone: 'Asia/Dhaka', labelZh: '孟加拉国', labelEn: 'Bangladesh', citiesZh: '达卡' },
    ],
    aliases: ['BST', 'British Summer Time', '英国夏令时', '英国时间', '英国夏时制'],
  },
  {
    code: 'JST',
    titleZh: '日本标准时间',
    titleEn: 'Japan Standard Time',
    zones: [{ timezone: 'Asia/Tokyo', labelZh: '日本', labelEn: 'Japan', citiesZh: '东京 / 大阪' }],
    aliases: ['JST', 'Japan Standard Time', '日本时间', '日本标准时间', '东京时间'],
  },
  {
    code: 'KST',
    titleZh: '韩国标准时间',
    titleEn: 'Korea Standard Time',
    zones: [{ timezone: 'Asia/Seoul', labelZh: '韩国', labelEn: 'South Korea', citiesZh: '首尔' }],
    aliases: ['KST', 'Korea Standard Time', '韩国时间', '韩国标准时间', '首尔时间'],
  },
  {
    code: 'IST',
    titleZh: '印度标准时间',
    titleEn: 'India Standard Time',
    zones: [
      { timezone: 'Asia/Kolkata', labelZh: '印度', labelEn: 'India', citiesZh: '孟买 / 新德里' },
      { timezone: 'Asia/Jerusalem', labelZh: '以色列', labelEn: 'Israel', citiesZh: '耶路撒冷' },
      { timezone: 'Europe/Dublin', labelZh: '爱尔兰', labelEn: 'Ireland', citiesZh: '都柏林' },
    ],
    aliases: [
      'IST',
      'India Standard Time',
      'Israel Standard Time',
      'Irish Standard Time',
      '印度时间',
      '印度标准时间',
      '以色列时间',
    ],
  },
  {
    code: 'HKT',
    titleZh: '香港时间',
    titleEn: 'Hong Kong Time',
    zones: [
      { timezone: 'Asia/Hong_Kong', labelZh: '中国香港', labelEn: 'Hong Kong', citiesZh: '香港' },
    ],
    aliases: ['HKT', 'Hong Kong Time', '香港时间'],
  },
  {
    code: 'SGT',
    titleZh: '新加坡时间',
    titleEn: 'Singapore Time',
    zones: [
      { timezone: 'Asia/Singapore', labelZh: '新加坡', labelEn: 'Singapore', citiesZh: '新加坡' },
    ],
    aliases: ['SGT', 'SST', 'Singapore Time', '新加坡时间', '狮城时间'],
  },
  {
    code: 'AEST',
    titleZh: '澳大利亚东部时间',
    titleEn: 'Australian Eastern Time',
    zones: [
      {
        timezone: 'Australia/Sydney',
        labelZh: '悉尼 / 墨尔本（观察夏令时）',
        labelEn: 'Sydney / Melbourne (observes DST)',
        citiesZh: '悉尼 / 墨尔本',
      },
      {
        timezone: 'Australia/Brisbane',
        labelZh: '布里斯班（全年不变）',
        labelEn: 'Brisbane (no DST)',
        citiesZh: '布里斯班',
      },
    ],
    aliases: [
      'AEST',
      'AEDT',
      'Australian Eastern Time',
      '澳东时间',
      '澳大利亚东部时间',
      '悉尼时间',
    ],
  },
  {
    code: 'NZST',
    titleZh: '新西兰时间',
    titleEn: 'New Zealand Time',
    zones: [
      {
        timezone: 'Pacific/Auckland',
        labelZh: '新西兰',
        labelEn: 'New Zealand',
        citiesZh: '奥克兰 / 惠灵顿',
      },
    ],
    aliases: ['NZST', 'NZDT', 'New Zealand Time', '新西兰时间', '奥克兰时间'],
  },
  {
    code: 'MSK',
    titleZh: '莫斯科时间',
    titleEn: 'Moscow Time',
    zones: [
      {
        timezone: 'Europe/Moscow',
        labelZh: '俄罗斯',
        labelEn: 'Russia',
        citiesZh: '莫斯科 / 圣彼得堡',
      },
    ],
    aliases: ['MSK', 'Moscow Time', '莫斯科时间', '俄罗斯时间'],
  },
  {
    code: 'GST',
    titleZh: '海湾标准时间',
    titleEn: 'Gulf Standard Time',
    zones: [
      {
        timezone: 'Asia/Dubai',
        labelZh: '阿联酋',
        labelEn: 'United Arab Emirates',
        citiesZh: '迪拜 / 阿布扎比',
      },
    ],
    aliases: ['GST', 'Gulf Standard Time', '海湾时间', '迪拜时间', '阿联酋时间'],
  },
]
