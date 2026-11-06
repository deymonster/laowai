<p align="center">
  <img src="public/favicon.svg" alt="" width="72" height="72">
</p>

<p align="center">
  <a href="README.md">Русский</a>
  &nbsp;·&nbsp;
  <strong>English</strong>
  &nbsp;·&nbsp;
  <a href="README.zh.md">中文</a>
</p>

<h1 align="center">Свои слова</h1>

<p align="center">
  A personal app for learning Chinese words with Russian glosses.<br>
  Cards, HSK lists, quizzes, grammar, and stroke order.
</p>

<p align="center">
  <a href="https://laowai.deymonster.win">Open the app</a>
</p>

A card is a character, a reading, and a meaning.

| | |
| --- | --- |
| **水** | shuǐ |
| | вода · water |

The interface is in Russian. There is no account. Words and grades stay in this browser, and you can take them with you as a file.

## What it is for

It is for someone learning Chinese through Russian who wants one quiet place: what to study today, how to write a word by hand, and how to check that it still sticks. It is not a feed and not a scheduled course. You pick the lists and the level. The next review follows your answer.

The level filters study and quizzes. A list chooses which words are in play. Opening a list shows its words.

## What is inside

**Words.** HSK 1–6 lists, 5,456 words, plus short topics: greetings, numbers, food, the day, animals, measure words, phrases, and readings that differ. You can create, rename, and delete your own collection. Words from a deleted collection stay in «Мои слова». Search accepts hanzi, Russian, and pinyin with or without tones: `shui`, `shuǐ`, `shui3`. A new word can be looked up in the BKRS dictionary and saved at the right level.

**Study.** Four grades: again, hard, good, easy. The next showing is in 1, 3, 7, 14, 30, or 60 days. You can cap how many new words appear in a day. Keys 1–4 grade the card, 5 speaks it.

**Quizzes.** Character and translation both ways, pinyin, listening, a spoken example, a cloze, a grammar rule, and a one-minute speed round. Phrase and cloze use examples only from the lists you selected.

**Grammar.** 81 short rules across HSK 1–6. Each has an example, pinyin, and a Russian translation. A rule you already know can be marked so it leaves the quiz.

**Writing.** Stroke order can be watched or traced. A separate drill asks you to type the pinyin or the characters. The reading and the gloss stay next to the strokes.

**Voice and look.** A card and its example can be spoken: the server voice first, then a dictionary recording, then the device voice. Pinyin on the card is a label. It does not drive pronunciation. Themes: light, dark, jade, paper, ink. Tones can be colored: first blue, second green, third orange, fourth purple.

**Progress.** A day streak, today’s answers, words learned, and words in progress. One view by level, another by list.

## Where the data lives

Words, your collections, grades, and settings stay in the browser. Settings can download them as JSON and open that file on another device.

Three things need the network: a BKRS lookup, the server voice, and the stroke diagram when writing is open. The cards themselves are read locally once the page is loaded.

## Run it locally

Node.js 22.

```bash
npm ci
npm run dev
```

The app opens at `http://127.0.0.1:5173`. In this mode the dictionary and speech answer from the same address.

```bash
npm run check
npm run build
```

`check` runs the project’s own checks. `build` typechecks and produces the page.
