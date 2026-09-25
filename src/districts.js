// ============================================================
// 桃園市 13 行政區
// ============================================================
//
// 桃園市資料集：
// F-D0047-005 = 未來3天逐3小時
// F-D0047-007 = 未來1週
//
// locationId 使用桃園市資料集內的 Geocode。
// 若 API 未指定 locationId，程式會抓取整個桃園市資料集，
// 再依 LocationName 篩選 13 區。
// ============================================================

export const TAOYUAN_DISTRICTS = [
  {
    name: "桃園區",
    geocode: "6800100"
  },
  {
    name: "中壢區",
    geocode: "6800200"
  },
  {
    name: "大溪區",
    geocode: "6800300"
  },
  {
    name: "楊梅區",
    geocode: "6800400"
  },
  {
    name: "蘆竹區",
    geocode: "6800500"
  },
  {
    name: "大園區",
    geocode: "6800600"
  },
  {
    name: "龜山區",
    geocode: "6800700"
  },
  {
    name: "八德區",
    geocode: "6800800"
  },
  {
    name: "龍潭區",
    geocode: "6800900"
  },
  {
    name: "平鎮區",
    geocode: "6801000"
  },
  {
    name: "新屋區",
    geocode: "6801100"
  },
  {
    name: "觀音區",
    geocode: "6801200"
  },
  {
    name: "復興區",
    geocode: "6801300"
  }
];

export const TAOYUAN_DISTRICT_NAMES =
  TAOYUAN_DISTRICTS.map(
    district => district.name
  );
