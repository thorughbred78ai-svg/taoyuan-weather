import {
  TAOYUAN_DISTRICTS,
  TAOYUAN_DISTRICT_NAMES
} from "./districts.js";


// ============================================================
// 基本設定
// ============================================================

const CWA_API_URL =
  "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-093";

const TIMEZONE =
  "Asia/Taipei";


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

function addDays(dateString, days) {

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
// 日期星期
// ============================================================

function getWeekday(dateString) {

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
// 使用者指定日期
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
      `日期格式錯誤：${input}`
    );

  }

  return input;

}


// ============================================================
// 使用者指定行政區
// ============================================================

function getTargetDistricts() {

  const input =
    process.env.INPUT_LOCATIONS?.trim();

  if (!input) {

    return [...TAOYUAN_DISTRICTS];

  }

  const names =
    input
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

  const result = [];

  for (const name of names) {

    const found =
      TAOYUAN_DISTRICTS.find(
        x => x.name === name
      );

    if (found) {

      if (
        !result.some(
          x => x.name === found.name
        )
      ) {

        result.push(found);

      }

    }

  }

  if (result.length === 0) {

    throw new Error(
      `沒有找到有效桃園行政區：${input}`
    );

  }

  return result;

}


// ============================================================
// CWA API
// ============================================================

async function fetchCWA() {

  const url =
    new URL(CWA_API_URL);

  url.searchParams.set(
    "Authorization",
    CWA_API_KEY
  );

  url.searchParams.set(
    "format",
    "JSON"
  );

  // 只抓桃園13區
  url.searchParams.set(
    "locationId",
    TAOYUAN_DISTRICTS
      .map(x => x.locationId)
      .join(",")
  );

  url.searchParams.set(
    "locationName",
    TAOYUAN_DISTRICTS
      .map(x => x.name)
      .join(",")
  );

  console.log(
    "CWA URL:",
    url.toString()
      .replace(
        CWA_API_KEY,
        "***"
      )
  );

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      `CWA HTTP ${response.status}: ${response.statusText}`
    );

  }

  const data =
    await response.json();

  if (
    data.success !== "true" &&
    data.success !== true
  ) {

    throw new Error(
      `CWA API 回傳失敗：${JSON.stringify(data)}`
    );

  }

  return data;

}


// ============================================================
// Element Value 解析
// ============================================================

function getElementValue(
  elementValue
) {

  if (!elementValue) {
    return {};
  }

  const result = {};

  for (
    const item
    of elementValue
  ) {

    const name =
      item.ElementName ||
      item.elementName ||
      "";

    const value =
      item.ElementValue ||
      item.elementValue ||
      "";

    result[name] =
      value;

  }

  return result;

}


// ============================================================
// CWA Locations Parser
// ============================================================

function parseCWA(data) {

  const locations =
    data?.records?.Locations ||
    [];

  const result = [];

  for (
    const locationGroup
    of locations
  ) {

    for (
      const location
      of locationGroup.Location || []
    ) {

      const district =
        location.LocationName;

      if (
        !TAOYUAN_DISTRICT_NAMES.includes(
          district
        )
      ) {

        continue;

      }

      for (
        const element
        of location.WeatherElement || []
      ) {

        const elementName =
          element.ElementName;

        for (
          const time
          of element.Time || []
        ) {

          result.push({

            district,

            elementName,

            start:
              time.StartTime,

            end:
              time.EndTime,

            values:
              getElementValue(
                time.ElementValue
              )

          });

        }

      }

    }

  }

  return result;

}


// ============================================================
// 找資料
// ============================================================

function findElement(
  records,
  district,
  elementName
) {

  return records.filter(
    x =>
      x.district === district &&
      x.elementName === elementName
  );

}


// ============================================================
// 找 Element 名稱
// ============================================================

function findElementByNames(
  records,
  district,
  names
) {

  for (const name of names) {

    const result =
      findElement(
        records,
        district,
        name
      );

    if (result.length > 0) {

      return result;

    }

  }

  return [];

}


// ============================================================
// 時間格式
// ============================================================

function formatTime(
  iso
) {

  if (!iso) {
    return "";
  }

  const match =
    String(iso).match(
      /T(\d{2}):(\d{2})/
    );

  if (!match) {
    return "";
  }

  return `${match[1]}:${match[2]}`;

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
    String(iso).match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  return match
    ? match[1]
    : "";

}


// ============================================================
// 取數字
// ============================================================

function cleanNumber(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";

  }

  const match =
    String(value).match(
      /-?\d+(?:\.\d+)?/
    );

  return match
    ? match[0]
    : String(value);

}


// ============================================================
// 天氣描述
// ============================================================

function getWeatherText(
  values
) {

  return (
    values["天氣現象"] ||
    values["天氣預報綜合描述"] ||
    values["Weather"] ||
    values["WeatherDescription"] ||
    ""
  );

}


// ============================================================
// 3小時預報
// ============================================================

function buildHourlyForecast(
  records,
  district,
  targetDate
) {

  const weather =
    findElementByNames(
      records,
      district,
      [
        "天氣現象",
        "天氣預報綜合描述"
      ]
    );

  const temperature =
    findElementByNames(
      records,
      district,
      [
        "溫度"
      ]
    );

  const rain =
    findElementByNames(
      records,
      district,
      [
        "3小時降雨機率"
      ]
    );

  const humidity =
    findElementByNames(
      records,
      district,
      [
        "相對濕度"
      ]
    );

  const windDirection =
    findElementByNames(
      records,
      district,
      [
        "風向"
      ]
    );

  const windSpeed =
    findElementByNames(
      records,
      district,
      [
        "風速"
      ]
    );


  // 以天氣資料作為時間軸
  const timeline =
    weather.length > 0
      ? weather
      : temperature;


  const result = [];


  for (
    const item
    of timeline
  ) {

    const date =
      isoDate(item.start);

    if (date !== targetDate) {
      continue;
    }


    const startTime =
      formatTime(item.start);

    const endTime =
      formatTime(item.end);


    const temp =
      temperature.find(
        x =>
          x.start === item.start
      )?.values?.["溫度"] ??
      "";


    const pop =
      rain.find(
        x =>
          x.start === item.start
      )?.values?.["3小時降雨機率"] ??
      "";


    const humidityValue =
      humidity.find(
        x =>
          x.start === item.start
      )?.values?.["相對濕度"] ??
      "";


    const direction =
      windDirection.find(
        x =>
          x.start === item.start
      )?.values?.["風向"] ??
      "";


    const speed =
      windSpeed.find(
        x =>
          x.start === item.start
      )?.values?.["風速"] ??
      "";


    result.push({

      startTime,

      endTime,

      weather:
        getWeatherText(
          item.values
        ),

      temperature:
        temp,

      pop:
        pop,

      humidity:
        humidityValue,

      windDirection:
        direction,

      windSpeed:
        speed

    });

  }


  return result;

}


// ============================================================
// 7天逐日
// ============================================================

function buildDailyForecast(
  records,
  district,
  startDate
) {

  const weather =
    findElementByNames(
      records,
      district,
      [
        "天氣現象",
        "天氣預報綜合描述"
      ]
    );

  const temperature =
    findElementByNames(
      records,
      district,
      [
        "最高溫度",
        "最低溫度",
        "溫度"
      ]
    );

  const pop =
    findElementByNames(
      records,
      district,
      [
        "24小時降雨機率",
        "12小時降雨機率"
      ]
    );

  const uv =
    findElementByNames(
      records,
      district,
      [
        "紫外線指數"
      ]
    );

  const wind =
    findElementByNames(
      records,
      district,
      [
        "風向"
      ]
    );


  const result = [];


  for (let i = 0; i < 7; i++) {

    const date =
      addDays(
        startDate,
        i
      );


    const weatherItems =
      weather.filter(
        x =>
          isoDate(x.start) === date
      );


    const temperatureItems =
      temperature.filter(
        x =>
          isoDate(x.start) === date
      );


    const popItems =
      pop.filter(
        x =>
          isoDate(x.start) === date
      );


    const uvItems =
      uv.filter(
        x =>
          isoDate(x.start) === date
      );


    const windItems =
      wind.filter(
        x =>
          isoDate(x.start) === date
      );


    let weatherText =
      "";


    if (
      weatherItems.length > 0
    ) {

      weatherText =
        getWeatherText(
          weatherItems[0].values
        );

    }


    let high = "";
    let low = "";


    for (
      const item
      of temperatureItems
    ) {

      const values =
        item.values || {};

      if (
        values["最高溫度"] !== undefined
      ) {

        high =
          values["最高溫度"];

      }

      if (
        values["最低溫度"] !== undefined
      ) {

        low =
          values["最低溫度"];

      }

    }


    let precipitation = "";


    if (
      popItems.length > 0
    ) {

      precipitation =
        Object.values(
          popItems[0].values
        )[0] ?? "";

    }


    let uvValue = "";


    if (
      uvItems.length > 0
    ) {

      uvValue =
        Object.values(
          uvItems[0].values
        )[0] ?? "";

    }


    let windDirection = "";


    if (
      windItems.length > 0
    ) {

      windDirection =
        windItems[0].values["風向"] ??
        Object.values(
          windItems[0].values
        )[0] ??
        "";

    }


    result.push({

      date,

      weekday:
        getWeekday(date),

      weather:
        weatherText,

      high,

      low,

      precipitation,

      windDirection,

      uv:
        uvValue

    });

  }


  return result;

}


// ============================================================
// Telegram Escape
// ============================================================

function escapeTelegram(
  text
) {

  return String(text)
    .replace(
      /([_*\[\]()~`>#+\-=|{}.!\\])/g,
      "\\$1"
    );

}


// ============================================================
// 產生 Telegram 訊息
// ============================================================

function buildTelegramMessage(
  records,
  districts,
  targetDate
) {

  const lines = [];


  // ----------------------------------------------------------
  // Header
  // ----------------------------------------------------------

  lines.push(
    "🌤 桃園市各區天氣預報"
  );

  lines.push(
    `📅 ${targetDate}`
  );

  lines.push(
    "📊 未來3天逐3小時＋未來7天逐日"
  );

  lines.push("");


  // ----------------------------------------------------------
  // 各區
  // ----------------------------------------------------------

  for (
    const district
    of districts
  ) {

    const hourly =
      buildHourlyForecast(
        records,
        district.name,
        targetDate
      );


    const daily =
      buildDailyForecast(
        records,
        district.name,
        targetDate
      );


    lines.push(
      `📍 ${district.name}`
    );

    lines.push("");


    // --------------------------------------------------------
    // 未來3小時
    // --------------------------------------------------------

    lines.push(
      "【未來3天・逐3小時】"
    );


    if (hourly.length === 0) {

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

        if (item.temperature) {

          line +=
            `｜${item.temperature}°C`;

        }

        if (item.pop !== "") {

          line +=
            `｜降雨${item.pop}%`;

        }

        if (item.windDirection) {

          line +=
            `｜${item.windDirection}`;

        }

        if (item.windSpeed) {

          line +=
            `｜風速${item.windSpeed}`;

        }

        lines.push(line);

      }

    }


    lines.push("");


    // --------------------------------------------------------
    // 未來7天
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
        item.low !== "" ||
        item.high !== ""
      ) {

        line +=
          `｜${item.low || "?"}～${item.high || "?"}°C`;

      }


      if (
        item.precipitation !== ""
      ) {

        line +=
          `｜降雨${item.precipitation}%`;

      }


      if (item.windDirection) {

        line +=
          `｜${item.windDirection}`;

      }


      if (item.uv) {

        line +=
          `｜UV ${item.uv}`;

      }


      lines.push(line);

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


  return lines.join("\n");

}


// ============================================================
// Telegram
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


  // Telegram 單則限制約 4096 字元
  // 分割訊息避免超過限制
  const chunks = [];


  for (
    let i = 0;
    i < message.length;
    i += 3800
  ) {

    chunks.push(
      message.substring(
        i,
        i + 3800
      )
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

              // 使用一般文字模式，
              // 避免 CWA 中文描述中的特殊符號
              // 造成 MarkdownV2 parse error
              disable_web_page_preview:
                true
            })
        }
      );


    const result =
      await response.json();


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
// Console Summary
// ============================================================

function printSummary(
  records,
  districts,
  targetDate
) {

  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "桃園天氣預報完成"
  );

  console.log(
    `日期：${targetDate}`
  );

  console.log(
    `行政區：${districts.map(x => x.name).join("、")}`
  );

  console.log(
    `API records：${records.length}`
  );

  console.log(
    "=========================================="
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
    "CWA 桃園天氣系統"
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
  // API
  // ----------------------------------------------------------

  const data =
    await fetchCWA();


  // ----------------------------------------------------------
  // Parse
  // ----------------------------------------------------------

  const records =
    parseCWA(data);


  if (records.length === 0) {

    throw new Error(
      "CWA API 沒有取得任何預報資料"
    );

  }


  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------

  printSummary(
    records,
    districts,
    targetDate
  );


  // ----------------------------------------------------------
  // Telegram
  // ----------------------------------------------------------

  const message =
    buildTelegramMessage(
      records,
      districts,
      targetDate
    );


  console.log("");
  console.log(
    "Telegram 預覽："
  );

  console.log(
    message
  );


  await sendTelegram(
    message
  );


  console.log("");
  console.log(
    "Telegram 推播完成"
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

      process.exit(1);

    }
  );
