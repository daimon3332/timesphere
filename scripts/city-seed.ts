/**
 * Curated city list. Geography (lat/lng/timezone/population) is resolved from
 * GeoNames at build time; this file owns only the editorial data.
 *
 * Columns: geonameid | nameEn | countryCode | nameZh | countryZh | region | priority | expectTz
 *
 * expectTz is asserted against GeoNames. A `!` prefix means "override GeoNames
 * deliberately" — used where GeoNames picks a rules-equivalent but incorrect
 * zone id for the country (e.g. Asia/Bangkok for Hanoi).
 */
export const CITY_SEED = `
1796236|Shanghai|CN|上海|中国|asia|1|Asia/Shanghai
1816670|Beijing|CN|北京|中国|asia|1|Asia/Shanghai
1795565|Shenzhen|CN|深圳|中国|asia|3|Asia/Shanghai
1809858|Guangzhou|CN|广州|中国|asia|3|Asia/Shanghai
1815286|Chengdu|CN|成都|中国|asia|3|Asia/Shanghai
1529102|Urumqi|CN|乌鲁木齐|中国|asia|3|Asia/Urumqi
1819729|Hong Kong|HK|香港|中国香港|asia|1|Asia/Hong_Kong
1821274|Macau|MO|澳门|中国澳门|asia|3|Asia/Macau
1668341|Taipei|TW|台北|中国台湾|asia|2|Asia/Taipei
1850147|Tokyo|JP|东京|日本|asia|1|Asia/Tokyo
1853909|Osaka|JP|大阪|日本|asia|3|Asia/Tokyo
1835848|Seoul|KR|首尔|韩国|asia|1|Asia/Seoul
1880252|Singapore|SG|新加坡|新加坡|asia|1|Asia/Singapore
1735161|Kuala Lumpur|MY|吉隆坡|马来西亚|asia|3|Asia/Kuala_Lumpur
1609350|Bangkok|TH|曼谷|泰国|asia|2|Asia/Bangkok
1566083|Ho Chi Minh City|VN|胡志明市|越南|asia|3|Asia/Ho_Chi_Minh
1581130|Hanoi|VN|河内|越南|asia|3|!Asia/Ho_Chi_Minh
1642911|Jakarta|ID|雅加达|印度尼西亚|asia|2|Asia/Jakarta
1622786|Makassar|ID|望加锡|印度尼西亚|asia|3|Asia/Makassar
2082600|Jayapura|ID|查亚普拉|印度尼西亚|asia|3|Asia/Jayapura
1701668|Manila|PH|马尼拉|菲律宾|asia|3|Asia/Manila
1275339|Mumbai|IN|孟买|印度|asia|2|Asia/Kolkata
1261481|New Delhi|IN|新德里|印度|asia|2|Asia/Kolkata
1277333|Bengaluru|IN|班加罗尔|印度|asia|3|Asia/Kolkata
1275004|Kolkata|IN|加尔各答|印度|asia|3|Asia/Kolkata
1185241|Dhaka|BD|达卡|孟加拉国|asia|3|Asia/Dhaka
1174872|Karachi|PK|卡拉奇|巴基斯坦|asia|3|Asia/Karachi
1176615|Islamabad|PK|伊斯兰堡|巴基斯坦|asia|3|Asia/Karachi
1283240|Kathmandu|NP|加德满都|尼泊尔|asia|3|Asia/Kathmandu
1248991|Colombo|LK|科伦坡|斯里兰卡|asia|3|Asia/Colombo
1298824|Yangon|MM|仰光|缅甸|asia|3|Asia/Yangon
1138958|Kabul|AF|喀布尔|阿富汗|asia|3|Asia/Kabul
1526384|Almaty|KZ|阿拉木图|哈萨克斯坦|asia|3|Asia/Almaty
2028462|Ulaanbaatar|MN|乌兰巴托|蒙古|asia|3|Asia/Ulaanbaatar
2643743|London|GB|伦敦|英国|europe|1|Europe/London
2655984|Birmingham|GB|伯明翰|英国|europe|3|Europe/London
2988507|Paris|FR|巴黎|法国|europe|1|Europe/Paris
2950159|Berlin|DE|柏林|德国|europe|1|Europe/Berlin
2925533|Frankfurt am Main|DE|法兰克福|德国|europe|2|Europe/Berlin
2867714|Munich|DE|慕尼黑|德国|europe|3|Europe/Berlin
2759794|Amsterdam|NL|阿姆斯特丹|荷兰|europe|2|Europe/Amsterdam
2800866|Brussels|BE|布鲁塞尔|比利时|europe|3|Europe/Brussels
3117735|Madrid|ES|马德里|西班牙|europe|2|Europe/Madrid
3128760|Barcelona|ES|巴塞罗那|西班牙|europe|3|Europe/Madrid
3169070|Rome|IT|罗马|意大利|europe|2|Europe/Rome
3173435|Milan|IT|米兰|意大利|europe|3|Europe/Rome
2657896|Zurich|CH|苏黎世|瑞士|europe|2|Europe/Zurich
2661552|Bern|CH|伯尔尼|瑞士|europe|3|Europe/Zurich
2673730|Stockholm|SE|斯德哥尔摩|瑞典|europe|2|Europe/Stockholm
3143244|Oslo|NO|奥斯陆|挪威|europe|3|Europe/Oslo
2618425|Copenhagen|DK|哥本哈根|丹麦|europe|3|Europe/Copenhagen
658225|Helsinki|FI|赫尔辛基|芬兰|europe|3|Europe/Helsinki
2761369|Vienna|AT|维也纳|奥地利|europe|3|Europe/Vienna
3067696|Prague|CZ|布拉格|捷克|europe|3|Europe/Prague
756135|Warsaw|PL|华沙|波兰|europe|3|Europe/Warsaw
3054643|Budapest|HU|布达佩斯|匈牙利|europe|3|Europe/Budapest
2267057|Lisbon|PT|里斯本|葡萄牙|europe|3|Europe/Lisbon
2964574|Dublin|IE|都柏林|爱尔兰|europe|3|Europe/Dublin
264371|Athens|GR|雅典|希腊|europe|3|Europe/Athens
745044|Istanbul|TR|伊斯坦布尔|土耳其|europe|2|Europe/Istanbul
524901|Moscow|RU|莫斯科|俄罗斯|europe|2|Europe/Moscow
498817|Saint Petersburg|RU|圣彼得堡|俄罗斯|europe|3|Europe/Moscow
1496747|Novosibirsk|RU|新西伯利亚|俄罗斯|asia|3|Asia/Novosibirsk
2013348|Vladivostok|RU|符拉迪沃斯托克|俄罗斯|asia|3|Asia/Vladivostok
1486209|Yekaterinburg|RU|叶卡捷琳堡|俄罗斯|asia|3|Asia/Yekaterinburg
703448|Kyiv|UA|基辅|乌克兰|europe|3|Europe/Kyiv
5128581|New York City|US|纽约|美国|north-america|1|America/New_York
4140963|Washington|US|华盛顿|美国|north-america|2|America/New_York
4930956|Boston|US|波士顿|美国|north-america|2|America/New_York
4560349|Philadelphia|US|费城|美国|north-america|3|America/New_York
4164138|Miami|US|迈阿密|美国|north-america|3|America/New_York
4180439|Atlanta|US|亚特兰大|美国|north-america|3|America/New_York
4887398|Chicago|US|芝加哥|美国|north-america|1|America/Chicago
4684888|Dallas|US|达拉斯|美国|north-america|2|America/Chicago
4699066|Houston|US|休斯顿|美国|north-america|3|America/Chicago
5045360|Minneapolis|US|明尼阿波利斯|美国|north-america|3|America/Chicago
5419384|Denver|US|丹佛|美国|north-america|2|America/Denver
5308655|Phoenix|US|菲尼克斯|美国|north-america|3|America/Phoenix
5368361|Los Angeles|US|洛杉矶|美国|north-america|1|America/Los_Angeles
5391959|San Francisco|US|旧金山|美国|north-america|1|America/Los_Angeles
5809844|Seattle|US|西雅图|美国|north-america|2|America/Los_Angeles
5506956|Las Vegas|US|拉斯维加斯|美国|north-america|3|America/Los_Angeles
5391811|San Diego|US|圣地亚哥|美国|north-america|3|America/Los_Angeles
5879400|Anchorage|US|安克雷奇|美国|north-america|3|America/Anchorage
5856195|Honolulu|US|檀香山|美国|north-america|3|Pacific/Honolulu
6167865|Toronto|CA|多伦多|加拿大|north-america|2|America/Toronto
6077243|Montreal|CA|蒙特利尔|加拿大|north-america|3|America/Toronto
6173331|Vancouver|CA|温哥华|加拿大|north-america|2|America/Vancouver
5913490|Calgary|CA|卡尔加里|加拿大|north-america|3|America/Edmonton
6141256|Saskatoon|CA|萨斯卡通|加拿大|north-america|3|America/Regina
6183235|Winnipeg|CA|温尼伯|加拿大|north-america|3|America/Winnipeg
6324729|Halifax|CA|哈利法克斯|加拿大|north-america|3|America/Halifax
6094817|Ottawa|CA|渥太华|加拿大|north-america|3|America/Toronto
6324733|St. John's|CA|圣约翰斯|加拿大|north-america|3|America/St_Johns
3530597|Mexico City|MX|墨西哥城|墨西哥|north-america|3|America/Mexico_City
3981609|Tijuana|MX|蒂华纳|墨西哥|north-america|3|America/Tijuana
3531673|Cancun|MX|坎昆|墨西哥|north-america|3|America/Cancun
3435910|Buenos Aires|AR|布宜诺斯艾利斯|阿根廷|south-america|3|America/Argentina/Buenos_Aires
3448439|Sao Paulo|BR|圣保罗|巴西|south-america|2|America/Sao_Paulo
3451190|Rio de Janeiro|BR|里约热内卢|巴西|south-america|3|America/Sao_Paulo
3663517|Manaus|BR|马瑙斯|巴西|south-america|3|America/Manaus
3871336|Santiago|CL|圣地亚哥|智利|south-america|3|America/Santiago
3688689|Bogota|CO|波哥大|哥伦比亚|south-america|3|America/Bogota
3936456|Lima|PE|利马|秘鲁|south-america|3|America/Lima
3646738|Caracas|VE|加拉加斯|委内瑞拉|south-america|3|America/Caracas
292223|Dubai|AE|迪拜|阿联酋|middle-east|1|Asia/Dubai
292968|Abu Dhabi|AE|阿布扎比|阿联酋|middle-east|3|Asia/Dubai
108410|Riyadh|SA|利雅得|沙特阿拉伯|middle-east|2|Asia/Riyadh
281184|Jerusalem|IL|耶路撒冷|以色列|middle-east|3|Asia/Jerusalem
293397|Tel Aviv|IL|特拉维夫|以色列|middle-east|3|Asia/Jerusalem
290030|Doha|QA|多哈|卡塔尔|middle-east|3|Asia/Qatar
285787|Kuwait City|KW|科威特城|科威特|middle-east|3|Asia/Kuwait
112931|Tehran|IR|德黑兰|伊朗|middle-east|3|Asia/Tehran
98182|Baghdad|IQ|巴格达|伊拉克|middle-east|3|Asia/Baghdad
360630|Cairo|EG|开罗|埃及|africa|2|Africa/Cairo
993800|Johannesburg|ZA|约翰内斯堡|南非|africa|3|Africa/Johannesburg
3369157|Cape Town|ZA|开普敦|南非|africa|3|Africa/Johannesburg
2332459|Lagos|NG|拉各斯|尼日利亚|africa|3|Africa/Lagos
184745|Nairobi|KE|内罗毕|肯尼亚|africa|3|Africa/Nairobi
2553604|Casablanca|MA|卡萨布兰卡|摩洛哥|africa|3|Africa/Casablanca
2210247|Tripoli|LY|的黎波里|利比亚|africa|3|Africa/Tripoli
344979|Addis Ababa|ET|亚的斯亚贝巴|埃塞俄比亚|africa|3|Africa/Addis_Ababa
2147714|Sydney|AU|悉尼|澳大利亚|oceania|1|Australia/Sydney
2158177|Melbourne|AU|墨尔本|澳大利亚|oceania|2|Australia/Melbourne
2174003|Brisbane|AU|布里斯班|澳大利亚|oceania|3|Australia/Brisbane
2078025|Adelaide|AU|阿德莱德|澳大利亚|oceania|3|Australia/Adelaide
2063523|Perth|AU|珀斯|澳大利亚|oceania|3|Australia/Perth
2073124|Darwin|AU|达尔文|澳大利亚|oceania|3|Australia/Darwin
2172517|Canberra|AU|堪培拉|澳大利亚|oceania|3|Australia/Sydney
2193733|Auckland|NZ|奥克兰|新西兰|oceania|2|Pacific/Auckland
2179537|Wellington|NZ|惠灵顿|新西兰|oceania|3|Pacific/Auckland
2198148|Suva|FJ|苏瓦|斐济|oceania|3|Pacific/Fiji
4033936|Papeete|PF|帕皮提|法属波利尼西亚|oceania|3|Pacific/Tahiti
`.trim()
