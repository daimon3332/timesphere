/**
 * What each time-zone abbreviation shown in the app stands for.
 *
 * Abbreviations are not unique — CST is China, North America and Cuba; IST is
 * India, Israel and Ireland — so an entry is identified by abbreviation AND
 * UTC offset. Anything missing here falls back to the browser's CLDR names.
 */
export interface AbbrEntry {
  abbr: string
  /** minutes east of UTC */
  offset: number
  nameZh: string
  nameEn: string
  regionZh: string
  /** when in the year it applies, for zones that switch */
  periodZh?: string
}

const US = '3 月第二个周日 → 11 月第一个周日'
const US_WINTER = '11 月第一个周日 → 次年 3 月第二个周日'
const EU = '3 月最后一个周日 → 10 月最后一个周日'
const EU_WINTER = '10 月最后一个周日 → 次年 3 月最后一个周日'
const AU = '10 月第一个周日 → 次年 4 月第一个周日'
const AU_WINTER = '4 月第一个周日 → 10 月第一个周日'
const NZ = '9 月最后一个周日 → 次年 4 月第一个周日'
const NZ_WINTER = '4 月第一个周日 → 9 月最后一个周日'

const e = (
  abbr: string,
  offset: number,
  nameZh: string,
  nameEn: string,
  regionZh: string,
  periodZh?: string,
): AbbrEntry => ({ abbr, offset, nameZh, nameEn, regionZh, periodZh })

export const ABBR_GLOSSARY: AbbrEntry[] = [
  e('UTC', 0, '协调世界时', 'Coordinated Universal Time', '全球时间基准，本身不随季节变化'),
  e('GMT', 0, '格林尼治标准时间', 'Greenwich Mean Time', '英国、爱尔兰冬季，以及加纳等西非国家全年', EU_WINTER),
  e('BST', 60, '英国夏令时间', 'British Summer Time', '英国夏季', EU),
  e('IST', 60, '爱尔兰标准时间', 'Irish Standard Time', '爱尔兰夏季（爱尔兰法律把夏季时间定为“标准时间”）', EU),
  e('WET', 0, '西欧时间', 'Western European Time', '葡萄牙、加那利群岛冬季；摩洛哥斋月期间', EU_WINTER),
  e('WEST', 60, '西欧夏令时间', 'Western European Summer Time', '葡萄牙、加那利群岛夏季；摩洛哥斋月以外的时间', EU),
  e('CET', 60, '欧洲中部时间', 'Central European Time', '德国、法国、意大利、西班牙等大部分欧洲国家冬季', EU_WINTER),
  e('CEST', 120, '欧洲中部夏令时间', 'Central European Summer Time', '德国、法国、意大利、西班牙等大部分欧洲国家夏季', EU),
  e('EET', 120, '东欧时间', 'Eastern European Time', '希腊、芬兰、乌克兰、罗马尼亚冬季；利比亚全年', EU_WINTER),
  e('EEST', 180, '东欧夏令时间', 'Eastern European Summer Time', '希腊、芬兰、乌克兰、罗马尼亚等夏季', EU),
  e('MSK', 180, '莫斯科时间', 'Moscow Standard Time', '俄罗斯欧洲部分，全年不变'),
  e('TRT', 180, '土耳其时间', 'Turkey Time', '土耳其，全年不变'),
  e('WAT', 60, '西非时间', 'West Africa Time', '尼日利亚、喀麦隆等，全年不变'),
  e('CAT', 120, '中非时间', 'Central Africa Time', '赞比亚、津巴布韦、莫桑比克等，全年不变'),
  e('SAST', 120, '南非标准时间', 'South Africa Standard Time', '南非，全年不变'),
  e('EAT', 180, '东非时间', 'East Africa Time', '肯尼亚、埃塞俄比亚、坦桑尼亚等，全年不变'),
  e('IST', 120, '以色列标准时间', 'Israel Standard Time', '以色列冬季', '10 月最后一个周日 → 次年 3 月最后一个周日前的周五'),
  e('IDT', 180, '以色列夏令时间', 'Israel Daylight Time', '以色列夏季', '3 月最后一个周日前的周五 → 10 月最后一个周日'),
  e('AST', 180, '阿拉伯标准时间', 'Arabia Standard Time', '沙特、卡塔尔、科威特、伊拉克等，全年不变'),
  e('GST', 240, '海湾标准时间', 'Gulf Standard Time', '阿联酋、阿曼，全年不变'),
  e('IRST', 210, '伊朗标准时间', 'Iran Standard Time', '伊朗，2022 年起取消夏令时，全年不变'),
  e('AFT', 270, '阿富汗时间', 'Afghanistan Time', '阿富汗，全年不变'),
  e('PKT', 300, '巴基斯坦标准时间', 'Pakistan Standard Time', '巴基斯坦，全年不变'),
  e('YEKT', 300, '叶卡捷琳堡时间', 'Yekaterinburg Time', '俄罗斯乌拉尔地区，全年不变'),
  e('IST', 330, '印度标准时间', 'India Standard Time', '印度全境，全年不变；斯里兰卡同为 UTC+5:30'),
  e('NPT', 345, '尼泊尔时间', 'Nepal Time', '尼泊尔，全年不变'),
  e('BST', 360, '孟加拉国标准时间', 'Bangladesh Standard Time', '孟加拉国，全年不变'),
  e('XJT', 360, '新疆时间', 'Xinjiang Time', '新疆民间及部分机构习惯使用；新疆官方使用北京时间（UTC+8）'),
  e('MMT', 390, '缅甸时间', 'Myanmar Time', '缅甸，全年不变'),
  e('ICT', 420, '印度支那时间', 'Indochina Time', '泰国、越南、柬埔寨、老挝，全年不变'),
  e('WIB', 420, '印尼西部时间', 'Western Indonesia Time', '印尼雅加达、苏门答腊等，全年不变'),
  e('NOVT', 420, '新西伯利亚时间', 'Novosibirsk Time', '俄罗斯新西伯利亚，全年不变'),
  e('KRAT', 420, '克拉斯诺亚尔斯克时间', 'Krasnoyarsk Time', '俄罗斯克拉斯诺亚尔斯克，全年不变'),
  e('CST', 480, '中国标准时间', 'China Standard Time', '中国大陆、澳门、台湾，即“北京时间”，全年不变'),
  e('HKT', 480, '香港时间', 'Hong Kong Time', '香港，全年不变'),
  e('SGT', 480, '新加坡标准时间', 'Singapore Standard Time', '新加坡，全年不变'),
  e('MYT', 480, '马来西亚时间', 'Malaysia Time', '马来西亚，全年不变'),
  e('PST', 480, '菲律宾标准时间', 'Philippine Standard Time', '菲律宾，全年不变'),
  e('WITA', 480, '印尼中部时间', 'Central Indonesia Time', '印尼巴厘岛、望加锡等，全年不变'),
  e('AWST', 480, '澳大利亚西部标准时间', 'Australian Western Standard Time', '西澳大利亚州（珀斯），全年不变'),
  e('ULAT', 480, '乌兰巴托时间', 'Ulaanbaatar Time', '蒙古大部分地区，全年不变'),
  e('IRKT', 480, '伊尔库茨克时间', 'Irkutsk Time', '俄罗斯伊尔库茨克，全年不变'),
  e('JST', 540, '日本标准时间', 'Japan Standard Time', '日本，全年不变'),
  e('KST', 540, '韩国标准时间', 'Korea Standard Time', '韩国、朝鲜，全年不变'),
  e('WIT', 540, '印尼东部时间', 'Eastern Indonesia Time', '印尼巴布亚等，全年不变'),
  e('YAKT', 540, '雅库茨克时间', 'Yakutsk Time', '俄罗斯雅库茨克，全年不变'),
  e('ACST', 570, '澳大利亚中部标准时间', 'Australian Central Standard Time', '北领地（达尔文）全年；南澳（阿德莱德）冬季', AU_WINTER),
  e('ACDT', 630, '澳大利亚中部夏令时间', 'Australian Central Daylight Time', '南澳大利亚州（阿德莱德）夏季', AU),
  e('AEST', 600, '澳大利亚东部标准时间', 'Australian Eastern Standard Time', '昆士兰（布里斯班）全年；新州、维州、塔州冬季', AU_WINTER),
  e('AEDT', 660, '澳大利亚东部夏令时间', 'Australian Eastern Daylight Time', '新南威尔士（悉尼）、维多利亚（墨尔本）、塔斯马尼亚夏季；昆士兰不实行', AU),
  e('VLAT', 600, '符拉迪沃斯托克时间', 'Vladivostok Time', '俄罗斯远东（海参崴），全年不变'),
  e('MAGT', 660, '马加丹时间', 'Magadan Time', '俄罗斯马加丹，全年不变'),
  e('PETT', 720, '堪察加时间', 'Kamchatka Time', '俄罗斯堪察加，全年不变'),
  e('FJT', 720, '斐济时间', 'Fiji Time', '斐济，2022 年起暂停夏令时'),
  e('NZST', 720, '新西兰标准时间', 'New Zealand Standard Time', '新西兰冬季', NZ_WINTER),
  e('NZDT', 780, '新西兰夏令时间', 'New Zealand Daylight Time', '新西兰夏季', NZ),
  e('TAHT', -600, '塔希提时间', 'Tahiti Time', '法属波利尼西亚（塔希提），全年不变'),
  e('HST', -600, '夏威夷-阿留申标准时间', 'Hawaii-Aleutian Standard Time', '夏威夷全年（不实行夏令时）'),
  e('AKST', -540, '阿拉斯加标准时间', 'Alaska Standard Time', '阿拉斯加冬季', US_WINTER),
  e('AKDT', -480, '阿拉斯加夏令时间', 'Alaska Daylight Time', '阿拉斯加夏季', US),
  e('PST', -480, '太平洋标准时间', 'Pacific Standard Time', '美国西海岸（俗称“美西时间”）及墨西哥下加利福尼亚冬季', US_WINTER),
  e('PDT', -420, '太平洋夏令时间', 'Pacific Daylight Time', '美国西海岸及墨西哥下加利福尼亚夏季', US),
  e('PCT', -420, '太平洋时间（BC 省）', 'Pacific Time', '加拿大 BC 省，2026 年起全年 UTC-7，不再拨表'),
  e('MST', -420, '山地标准时间', 'Mountain Standard Time', '美国山地各州冬季；亚利桑那全年', US_WINTER),
  e('MDT', -360, '山地夏令时间', 'Mountain Daylight Time', '美国科罗拉多、犹他等山地各州夏季', US),
  e('CST', -360, '北美中部标准时间', 'Central Standard Time', '美国中部冬季；加拿大萨斯喀彻温、墨西哥大部分地区全年', US_WINTER),
  e('CDT', -300, '北美中部夏令时间', 'Central Daylight Time', '美国中部夏季', US),
  e('CST', -300, '古巴标准时间', 'Cuba Standard Time', '古巴冬季'),
  e('EST', -300, '北美东部标准时间', 'Eastern Standard Time', '美国东部、加拿大安大略和魁北克冬季（俗称“美东时间”）；墨西哥坎昆全年', US_WINTER),
  e('EDT', -240, '北美东部夏令时间', 'Eastern Daylight Time', '美国东部、加拿大安大略和魁北克夏季', US),
  e('AST', -240, '大西洋标准时间', 'Atlantic Standard Time', '加拿大东部沿海省份冬季；波多黎各全年', US_WINTER),
  e('ADT', -180, '大西洋夏令时间', 'Atlantic Daylight Time', '加拿大新斯科舍等沿海省份夏季', US),
  e('NST', -210, '纽芬兰标准时间', 'Newfoundland Standard Time', '加拿大纽芬兰冬季', US_WINTER),
  e('NDT', -150, '纽芬兰夏令时间', 'Newfoundland Daylight Time', '加拿大纽芬兰夏季', US),
  e('COT', -300, '哥伦比亚时间', 'Colombia Time', '哥伦比亚，全年不变'),
  e('PET', -300, '秘鲁时间', 'Peru Time', '秘鲁，全年不变'),
  e('VET', -240, '委内瑞拉时间', 'Venezuelan Standard Time', '委内瑞拉，全年不变'),
  e('AMT', -240, '亚马逊时间', 'Amazon Time', '巴西亚马孙州（马瑙斯）等，全年不变'),
  e('BRT', -180, '巴西利亚时间', 'Brasília Time', '巴西大部分地区，2019 年起取消夏令时'),
  e('ART', -180, '阿根廷时间', 'Argentina Time', '阿根廷，全年不变'),
  e('CLT', -240, '智利标准时间', 'Chile Standard Time', '智利本土冬季（约 4 月 → 9 月）'),
  e('CLST', -180, '智利夏令时间', 'Chile Summer Time', '智利本土夏季（约 9 月 → 次年 4 月）'),
]

const BY_ABBR = new Map<string, AbbrEntry[]>()
for (const entry of ABBR_GLOSSARY) {
  const list = BY_ABBR.get(entry.abbr) ?? []
  list.push(entry)
  BY_ABBR.set(entry.abbr, list)
}

/** The meaning of `abbr` as used at `offset`; null if not curated. */
export function lookupAbbr(abbr: string, offset: number): AbbrEntry | null {
  const list = BY_ABBR.get(abbr)
  if (!list) return null
  return list.find((x) => x.offset === offset) ?? null
}

/** Other things the same letters stand for, to warn about ambiguity. */
export function otherMeanings(entry: AbbrEntry): AbbrEntry[] {
  return (BY_ABBR.get(entry.abbr) ?? []).filter((x) => x !== entry)
}
