import {
  TAOYUAN_DISTRICTS,
  TAOYUAN_DISTRICT_NAMES
} from "./districts.js";


// ============================================================
// CWA 資料集
// ============================================================
//
// 桃園市：
//
// F-D0047-005
// 桃園市未來3天天氣預報
// 逐3小時
//
// F-D0047-007
// 桃園市未來1週天氣預報
//
// 不再使用 F-D0047-093。
// ============================================================

const CWA_3DAY_API_URL =
  "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-005";

const CWA_7DAY_API_URL =
  "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-007";

const TIMEZONE =
  "Asia/Taipei";

const VERSION =
  "2.2.0";


// ============================================================
// Environment
// ============================================================

const CWA_API_KEY =
  process.env.CWA_API_KEY;

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN;

const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID;

const SEND_TELEGRAM =
  String(
    process.env.SEND_TELEGRAM ?? "true"
  ).toLowerCase() !== "false";


if (!CWA_API_KEY) {
  throw new Error(
    "缺少 GitHub Secret：CWA_API_KEY"
  );
}


if (SEND_TELEGRAM) {

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error(
      "缺少 GitHub Secret：TELEGRAM_BOT_TOKEN"
    );
  }

  if (!TELEGRAM_CHAT_ID) {
    throw new Error(
      "缺少 GitHub Secret：TELEGRAM_CHAT_ID"
    );
  }

}


// ============================================================
// 日期
// ============================================================

function getTaiwanDate() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());

}


// ============================================================
// 日期 + 天數
// ============================================================

function addDays(
  dateString,
  days
) {

  const date =
    new Date(
      `${dateString}T00:00:00+08:00`
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(date);

}


// ============================================================
// 星期
// ============================================================

function getWeekday(
  dateString
) {

  const date =
    new Date(
      `${dateString}T12:00:00+08:00`
    );

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone: TIMEZONE,
      weekday: "short"
    }
  ).format(date);

}


// ============================================================
// Target Date
// ============================================================

function getTargetDate() {

  const input =
    process.env.INPUT_DATE?.trim();

  if (!input) {
    return getTaiwanDate();
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input)
  ) {

    throw new Error(
      `日期格式錯誤：${input}，應為 YYYY-MM-DD`
    );

  }

  const date =
    new Date(
      `${input}T00:00:00+08:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    throw new Error(
      `無效日期：${input}`
    );

  }

  return input;

}


// ============================================================
// Target Districts
// ============================================================

function getTargetDistricts() {

  const input =
    process.env.INPUT_LOCATIONS?.trim();

  if (!input) {

    return [
      ...TAOYUAN_DISTRICTS
    ];

  }

  const names =
    input
      .split(",")
      .map(
        value =>
          value.trim()
      )
      .filter(Boolean);

  const result = [];

  for (
    const name
    of names
  ) {

    const found =
      TAOYUAN_DISTRICTS.find(
        district =>
          district.name === name
      );

    if (!found) {

      console.warn(
        `⚠️ 忽略未知行政區：${name}`
      );

      continue;

    }

    if (
      !result.some(
        district =>
          district.name === found.name
      )
    ) {

      result.push(found);

    }

  }

  if (
    result.length === 0
  ) {

    throw new Error(
      `沒有找到有效桃園行政區：${input}`
    );

  }

  return result;

}


// ============================================================
// CWA API Fetch
// ============================================================

async function fetchCWA(
  apiUrl,
  datasetName
) {

  const url =
    new URL(apiUrl);

  url.searchParams.set(
    "Authorization",
    CWA_API_KEY
  );

  url.searchParams.set(
    "format",
    "JSON"
  );

  console.log(
    `${datasetName} URL:`,
    url.toString()
      .replace(
        CWA_API_KEY,
        "***"
      )
  );


  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "application/json"
        }
      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `${datasetName} API 回傳不是有效 JSON：HTTP ${response.status}\n${text.slice(0, 500)}`
    );

  }


  if (!response.ok) {

    throw new Error(
      `${datasetName} API 錯誤：HTTP ${response.status} ${response.statusText}\n` +
      JSON.stringify(
        data
      ).slice(
        0,
        1000
      )
    );

  }


  if (
    data.success !== undefined &&
    data.success !== "true" &&
    data.success !== true
  ) {

    throw new Error(
      `${datasetName} API 回傳失敗：` +
      JSON.stringify(data).slice(
        0,
        1000
      )
    );

  }


  return data;

}


// ============================================================
// CWA Location Parser
// ============================================================
//
// CWA 新版資料常見：
//
// records.Locations[0].Location
//
// 舊版 REST JSON 也可能出現：
//
// records.locations[0].location
//
// 這裡兩種都支援。
// ============================================================

function getLocations(
  data
) {

  const records =
    data?.records ||
    {};


  const groups =
    records.Locations ||
    records.locations ||
    [];


  const result = [];


  for (
    const group
    of groups
  ) {

    const locations =
      group.Location ||
      group.location ||
      [];


    for (
      const location
      of locations
    ) {

      result.push(
        location
      );

    }

  }


  return result;

}


// ============================================================
// Element Value Parser
// ============================================================

function getElementValues(
  elementValue
) {

  if (!elementValue) {
    return {};
  }


  const result = {};


  if (
    Array.isArray(
      elementValue
    )
  ) {

    for (
      const item
      of elementValue
    ) {

      if (
        !item ||
        typeof item !== "object"
      ) {

        continue;

      }


      const entries =
        Object.entries(
          item
        );


      for (
        const [
          key,
          value
        ]
        of entries
      ) {

        if (
          key === "value" ||
          key === "measures"
        ) {

          continue;

        }

        result[key] =
          value;

      }

    }

    return result;

  }


  if (
    typeof elementValue ===
    "object"
  ) {

    for (
      const [
        key,
        value
      ]
      of Object.entries(
        elementValue
      )
    ) {

      result[key] =
        value;

    }

  }


  return result;

}


// ============================================================
// Element Name
// ============================================================

function getElementName(
  element
) {

  return (
    element?.ElementName ||
    element?.elementName ||
    ""
  );

}


// ============================================================
// Element Time
// ============================================================

function getElementTimes(
  element
) {

  return (
    element?.Time ||
    element?.time ||
    []
  );

}


// ============================================================
// Time Start
// ============================================================

function getStartTime(
  time
) {

  return (
    time?.StartTime ||
    time?.startTime ||
    time?.DataTime ||
    time?.dataTime ||
    ""
  );

}


// ============================================================
// Time End
// ============================================================

function getEndTime(
  time
) {

  return (
    time?.EndTime ||
    time?.endTime ||
    ""
  );

}


// ============================================================
// Location Name
// ============================================================

function getLocationName(
  location
) {

  return (
    location?.LocationName ||
    location?.locationName ||
    ""
  );

}


// ============================================================
// WeatherElement
// ============================================================

function getWeatherElements(
  location
) {

  return (
    location?.WeatherElement ||
    location?.weatherElement ||
    []
  );

}


// ============================================================
// Parse CWA
// ============================================================

function parseCWA(
  data,
  dataset
) {

  const locations =
    getLocations(
      data
    );


  const records = [];


  for (
    const location
    of locations
  ) {

    const district =
      getLocationName(
        location
      );


    if (
      !TAOYUAN_DISTRICT_NAMES.includes(
        district
      )
    ) {

      continue;

    }


    for (
      const element
      of getWeatherElements(
        location
      )
    ) {

      const elementName =
        getElementName(
          element
        );


      for (
        const time
        of getElementTimes(
          element
        )
      ) {

        const start =
          getStartTime(
            time
          );

        const end =
          getEndTime(
            time
          );


        records.push({

          district,

          dataset,

          elementName,

          start,

          end,

          values:
            getElementValues(
              time?.ElementValue ||
              time?.elementValue
            )

        });

      }

    }

  }


  return records;

}


// ============================================================
// Find Element
// ============================================================

function findElement(
  records,
  district,
  elementNames
) {

  const names =
    Array.isArray(
      elementNames
    )
      ? elementNames
      : [
          elementNames
        ];


  return records.filter(
    record =>
      record.district === district &&
      names.includes(
        record.elementName
      )
  );

}


// ============================================================
// Value Helper
// ============================================================

function getValue(
  values,
  names
) {

  for (
    const name
    of names
  ) {

    if (
      values?.[name] !==
      undefined &&
      values?.[name] !==
      null &&
      values?.[name] !== ""
    ) {

      return values[name];

    }

  }

  return "";

}


// ============================================================
// 日期
// ============================================================

function isoDate(
  iso
) {

  if (!iso) {
    return "";
  }

  const match =
    String(
      iso
    ).match(
      /^(\d{4}-\d{2}-\d{2})/
    );


  return match
    ? match[1]
    : "";

}


// ============================================================
// 時間
// ============================================================

function formatTime(
  iso
) {

  if (!iso) {
    return "";
  }

  const match =
    String(
      iso
    ).match(
      /T(\d{2}):(\d{2})/
    );


  if (!match) {
    return "";

  }


  return `${match[1]}:${match[2]}`;

}


// ============================================================
// 數字
// ============================================================

function cleanNumber(
  value
) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return "";

  }


  const match =
    String(
      value
    ).match(
      /-?\d+(?:\.\d+)?/
    );


  return match
    ? match[0]
    : String(value);

}


// ============================================================
// 天氣文字
// ============================================================

function getWeatherText(
  values
) {

  return getValue(
    values,
    [
      "Weather",
      "天氣現象",
      "WeatherDescription",
      "天氣預報綜合描述"
    ]
  );

}


// ============================================================
// 建立 3 小時預報
// ============================================================

function buildHourlyForecast(
  records,
  district,
  targetDate
) {

  const relevant =
    records.filter(
      record =>
        record.district === district &&
        isoDate(
          record.start
        ) === targetDate
    );


  const timeMap =
    new Map();


  function ensure(
    start,
    end
  ) {

    if (
      !timeMap.has(
        start
      )
    ) {

      timeMap.set(
        start,
        {
          start,
          end,
          weather: "",
          pop: ""
        }
      );

    }


    return timeMap.get(
      start
    );

  }


  for (
    const record
    of relevant
  ) {

    const row =
      ensure(
        record.start,
        record.end
      );


    const values =
      record.values ||
      {};


    switch (
      record.elementName
    ) {


      case "3小時降雨機率":

        row.pop =
          getValue(
            values,
            [
              "ProbabilityOfPrecipitation",
              "3小時降雨機率"
            ]
          );

        break;


      case "6小時降雨機率":

        if (!row.pop) {

          row.pop =
            getValue(
              values,
              [
                "ProbabilityOfPrecipitation",
                "6小時降雨機率"
              ]
            );

        }

        break;


      case "天氣現象":

        row.weather =
          getWeatherText(
            values
          );

        break;


      case "天氣預報綜合描述":

        if (!row.weather) {

          row.weather =
            getWeatherText(
              values
            );

        }

        break;

    }

  }


  return [
    ...timeMap.values()
  ]
    .sort(
      (a, b) =>
        a.start.localeCompare(
          b.start
        )
    )
    .map(
      item => ({
        startTime:
          formatTime(
            item.start
          ),

        endTime:
          formatTime(
            item.end
          ),

        weather:
          item.weather,


        pop:
          cleanNumber(
            item.pop
          )
      })
    );

}


// ============================================================
// 建立 7 天逐日預報
// ============================================================

function buildDailyForecast(
  records,
  district,
  startDate
) {

  const result = [];


  for (
    let i = 0;
    i < 7;
    i++
  ) {

    const date =
      addDays(
        startDate,
        i
      );


    const relevant =
      records.filter(
        record =>
          record.district === district &&
          isoDate(
            record.start
          ) === date
      );


    let weather = "";
    let precipitation = "";


    for (
      const record
      of relevant
    ) {

      const values =
        record.values ||
        {};


      if (
        !weather &&
        (
          record.elementName ===
            "天氣現象" ||
          record.elementName ===
            "天氣預報綜合描述"
        )
      ) {

        weather =
          getWeatherText(
            values
          );

      }


      if (
        record.elementName ===
        "12小時降雨機率"
      ) {

        if (!precipitation) {

          precipitation =
            getValue(
              values,
              [
                "ProbabilityOfPrecipitation",
                "12小時降雨機率"
              ]
            );

        }

      }


      if (
        record.elementName ===
        "降雨機率"
      ) {

        if (!precipitation) {

          precipitation =
            getValue(
              values,
              [
                "ProbabilityOfPrecipitation",
                "降雨機率"
              ]
            );

        }

      }

    }


    result.push({

      date,

      weekday:
        getWeekday(
          date
        ),

      weather,


      precipitation:
        cleanNumber(
          precipitation
        )

    });

  }


  return result;

}


// ============================================================
// Telegram Escape
// ============================================================
//
// 本版不使用 Markdown / MarkdownV2。
// 保留函式只是方便未來擴充。
// ============================================================

function escapeTelegram(
  text
) {

  return String(
    text ?? ""
  );

}


// ============================================================
// Telegram Message
// ============================================================

function buildTelegramMessage(
  records3Day,
  records7Day,
  districts,
  targetDate
) {

  const lines = [];


  lines.push(
    `🌤 桃園市各區天氣預報 v${VERSION}`
  );

  lines.push(
    `📅 ${targetDate} ${getWeekday(targetDate)}`
  );

  lines.push(
    "📊 未來3天逐3小時＋未來7天逐日"
  );

  lines.push("");


  for (
    const district
    of districts
  ) {

    const hourly =
      buildHourlyForecast(
        records3Day,
        district.name,
        targetDate
      );


    const daily =
      buildDailyForecast(
        records7Day,
        district.name,
        targetDate
      );


    lines.push(
      `📍 ${district.name}`
    );

    lines.push("");


    // --------------------------------------------------------
    // 3 小時
    // --------------------------------------------------------

    lines.push(
      "【未來3天・逐3小時】"
    );


    if (
      hourly.length === 0
    ) {

      lines.push(
        "目前沒有逐3小時資料"
      );

    } else {

      for (
        const item
        of hourly
      ) {

        let line =
          `${item.startTime}～${item.endTime}`;


        if (item.weather) {

          line +=
            `｜${item.weather}`;

        }


        if (
          item.pop !== ""
        ) {

          line +=
            `｜降雨${item.pop}%`;

        }


        lines.push(
          escapeTelegram(
            line
          )
        );

      }

    }


    lines.push("");


    // --------------------------------------------------------
    // 7 天
    // --------------------------------------------------------

    lines.push(
      "【未來7天・逐日】"
    );


    for (
      const item
      of daily
    ) {

      let line =
        `${item.date} ${item.weekday}`;


      if (item.weather) {

        line +=
          `｜${item.weather}`;

      }


      if (
        item.precipitation !== ""
      ) {

        line +=
          `｜降雨${item.precipitation}%`;

      }


      lines.push(
        escapeTelegram(
          line
        )
      );

    }


    lines.push("");

    lines.push(
      "────────────────"
    );

    lines.push("");

  }


  lines.push(
    "資料來源：中央氣象署"
  );


  return lines.join(
    "\n"
  );

}


// ============================================================
// Telegram Send
// ============================================================

async function sendTelegram(
  message
) {

  if (!SEND_TELEGRAM) {

    console.log(
      "SEND_TELEGRAM=false，略過 Telegram。"
    );

    return;

  }


  const url =
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;


  // Telegram message limit 約 4096。
  // 保守控制在 3500 字元。
  const chunks = [];


  let current = "";


  for (
    const line
    of message.split("\n")
  ) {

    const candidate =
      current
        ? `${current}\n${line}`
        : line;


    if (
      candidate.length > 3500
    ) {

      if (current) {

        chunks.push(
          current
        );

      }

      current =
        line;

    } else {

      current =
        candidate;

    }

  }


  if (current) {

    chunks.push(
      current
    );

  }


  for (
    const chunk
    of chunks
  ) {

    const response =
      await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              chat_id:
                TELEGRAM_CHAT_ID,

              text:
                chunk,

              disable_web_page_preview:
                true
            })
        }
      );


    const text =
      await response.text();


    let result;

    try {

      result =
        JSON.parse(
          text
        );

    } catch {

      throw new Error(
        `Telegram API 回傳非 JSON：HTTP ${response.status}\n${text.slice(0, 500)}`
      );

    }


    if (
      !response.ok ||
      !result.ok
    ) {

      throw new Error(
        `Telegram API 錯誤：${JSON.stringify(result)}`
      );

    }

  }

}


// ============================================================
// Records Summary
// ============================================================

function printDatasetSummary(
  records,
  datasetName
) {

  const districts =
    new Set(
      records.map(
        record =>
          record.district
      )
    );


  const elements =
    new Set(
      records.map(
        record =>
          record.elementName
      )
    );


  console.log("");
  console.log(
    "------------------------------------------"
  );

  console.log(
    `${datasetName}`
  );

  console.log(
    `Records：${records.length}`
  );

  console.log(
    `行政區：${districts.size}`
  );

  console.log(
    `Elements：${[
      ...elements
    ].join("、")}`
  );

  console.log(
    "------------------------------------------"
  );

}


// ============================================================
// Main
// ============================================================

async function main() {

  const targetDate =
    getTargetDate();


  const districts =
    getTargetDistricts();


  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    `CWA 桃園天氣系統 v${VERSION}`
  );

  console.log(
    `Taiwan Date：${getTaiwanDate()}`
  );

  console.log(
    `Target Date：${targetDate}`
  );

  console.log(
    `Districts：${districts.map(x => x.name).join("、")}`
  );

  console.log(
    "=========================================="
  );


  // ----------------------------------------------------------
  // 3 天 API
  // ----------------------------------------------------------

  const data3Day =
    await fetchCWA(
      CWA_3DAY_API_URL,
      "CWA 3-Day"
    );


  // ----------------------------------------------------------
  // 7 天 API
  // ----------------------------------------------------------

  const data7Day =
    await fetchCWA(
      CWA_7DAY_API_URL,
      "CWA 7-Day"
    );


  // ----------------------------------------------------------
  // Parse
  // ----------------------------------------------------------

  const records3Day =
    parseCWA(
      data3Day,
      "3DAY"
    );


  const records7Day =
    parseCWA(
      data7Day,
      "7DAY"
    );


  if (
    records3Day.length === 0
  ) {

    throw new Error(
      "CWA F-D0047-005 沒有取得任何桃園預報資料"
    );

  }


  if (
    records7Day.length === 0
  ) {

    throw new Error(
      "CWA F-D0047-007 沒有取得任何桃園預報資料"
    );

  }


  printDatasetSummary(
    records3Day,
    "F-D0047-005 / 未來3天"
  );


  printDatasetSummary(
    records7Day,
    "F-D0047-007 / 未來1週"
  );


  // ----------------------------------------------------------
  // Telegram
  // ----------------------------------------------------------

  const message =
    buildTelegramMessage(
      records3Day,
      records7Day,
      districts,
      targetDate
    );


  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "Telegram 預覽"
  );

  console.log(
    "=========================================="
  );

  console.log(
    message
  );


  await sendTelegram(
    message
  );


  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "✅ Telegram 推播完成"
  );

  console.log(
    "=========================================="
  );

}


main()
  .catch(
    error => {

      console.error("");
      console.error(
        "=========================================="
      );

      console.error(
        "❌ 執行失敗"
      );

      console.error(
        error?.stack ||
        error
      );

      console.error(
        "=========================================="
      );

      process.exit(
        1
      );

    }
  );
