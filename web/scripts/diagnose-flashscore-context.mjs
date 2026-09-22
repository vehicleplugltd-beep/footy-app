const targets = new Set([
  "MNThRu6l",
  "0nzyFC0C",
  "dd6tuGXG",
  "WtDECnLl",
  "WlRXwJkf",
]);

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
  Accept: "text/plain,*/*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://www.flashscore.com/",
  Origin: "https://www.flashscore.com",
  "x-fsign": "SW9D1eZo",
};

for (let offset = 0; offset < 8; offset += 1) {
  const url =
    `https://2.flashscore.ninja/2/x/feed/f_1_${offset}_3_en_1`;
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    console.log(JSON.stringify({ offset, status: response.status }));
    continue;
  }

  const blocks = text.split("~");
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    for (const id of targets) {
      if (!block.includes(`AA÷${id}`)) continue;
      const context = blocks
        .slice(Math.max(0, index - 4), index + 2)
        .map((value, relativeIndex) => ({
          position: index - Math.max(0, index - 4) + relativeIndex,
          raw: value.slice(0, 1200),
        }));
      console.log(JSON.stringify({ offset, id, index, context }, null, 2));
    }
  }
}
