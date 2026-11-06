import { cleanGloss, clozeText, exampleFits, ruNoun, studyExample } from './han'
import { GRAMMAR, HSK } from './grammar'
import { dictionaryQuery, parseBkrs } from '../server/bkrs'
import { assertEdgeOpen, edgeCooling, edgeRate, noteEdgeFailure, noteEdgeSuccess } from '../server/edge-policy'
import { analyze, searchKey, syllableAt } from './pinyin'
import { judge, prettifyPinyin } from './pinyin'
import { applyGrade, getP, planGrade, selectedWords, today } from './srs'
import { HSK_WORDS } from './hsk-list'
import { SEED, TOPICS } from './seed'
import { freshState } from './store'

const expect = (name: string, got: unknown, want: unknown) => {
  if (got !== want) {
    console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`)
    process.exitCode = 1
  }
}

const readings: [string, string, boolean?][] = [
  ['你好', 'nǐ hǎo'],
  ['银行', 'yín háng'],
  ['行走', 'xíng zǒu'],
  ['音乐', 'yīn yuè'],
  ['快乐', 'kuài lè'],
  ['好学', 'hào xué'],
  ['长大', 'zhǎng dà'],
  ['还是', 'hái shì'],
  ['一个', 'yí gè'],
  ['不是', 'bú shì'],
  ['妈妈', 'mā ma'],
  ['谢谢', 'xiè xiè'],
]

for (const [hanzi, pinyin] of readings) {
  const result = await analyze(hanzi)
  expect(hanzi, result.text, pinyin)
}

const single = await analyze('行')
expect('行 options', single.parts[0]?.options.includes('háng') && single.parts[0]?.value === 'xíng', true)

const surname = await analyze('单', true)
expect('单 surname', surname.text, 'shàn')

const typed: [string, string, boolean, string][] = [
  ['ni3 hao3', 'nǐ hǎo', true, 'ok'],
  ['ni3hao3', 'nǐ hǎo', true, 'ok'],
  ['nǐhǎo', 'nǐ hǎo', true, 'ok'],
  ['nǐ hǎo', 'nǐ hǎo', true, 'ok'],
  ['ni hao', 'nǐ hǎo', false, 'ok-nt'],
  ['ni hao', 'nǐ hǎo', true, 'tone'],
  ['ni2 hao3', 'nǐ hǎo', true, 'tone'],
  ['nv3', 'nǚ', true, 'ok'],
  ['nü3', 'nǚ', true, 'ok'],
  ['xue2', 'xué', true, 'ok'],
  ['xve2', 'xué', true, 'ok'],
  ['xv2', 'xú', true, 'ok'],
  ['yin2 hang2', 'yín háng', true, 'ok'],
  ['ma1 ma', 'mā ma', true, 'ok'],
  ['you3', 'yǒu', true, 'ok'],
]
for (const [input, expected, strict, want] of typed) expect(`${input} ~ ${expected} strict=${strict}`, judge(input, expected, strict), want)

expect('prettify digits', prettifyPinyin('ni3hao3'), 'nǐ hǎo')
expect('prettify marks', prettifyPinyin('nǐ hǎo'), 'nǐ hǎo')
expect('prettify ü', prettifyPinyin('nv3'), 'nǚ')
expect('prettify xue', prettifyPinyin('xue2'), 'xué')
expect('prettify xve', prettifyPinyin('xve2'), 'xué')
expect('prettify xv', prettifyPinyin('xv2'), 'xú')
expect('syllable', syllableAt('nǐ hǎo', '你好', 1), 'hǎo')
expect('syllable bank', syllableAt('yín háng', '银行', 1), 'háng')
expect('syllable mismatch', syllableAt('nǐ', '你好', 1), '')

const state = freshState()
const day = today()
applyGrade(state, 'g1', 'good')
expect('box', getP(state, 'g1').b, 1)
expect('due tomorrow', getP(state, 'g1').d, day + 1)
applyGrade(state, 'g1', 'again')
expect('again today', getP(state, 'g1').d, day)
expect('hard new', planGrade(0, 'hard').wait, 0)
expect('easy new', planGrade(0, 'easy').b, 2)
expect('easy new wait', planGrade(0, 'easy').wait, 3)
expect('hard stay', planGrade(3, 'hard').b, 3)
expect('hard sooner', planGrade(3, 'hard').wait, 3)
expect('good step', planGrade(3, 'good').wait, 14)
expect('easy step', planGrade(3, 'easy').wait, 30)

expect('query han', dictionaryQuery('银行')?.q, '银行')
expect('query ru', dictionaryQuery('банк!')?.q, 'банк')
expect('query tones', dictionaryQuery('yín háng')?.q, 'yin hang')
expect('query digits', dictionaryQuery('ni3hao3')?.q, 'ni hao')
expect('query short', dictionaryQuery('a'), null)
expect('cloze', clozeText('我喝水。', '水'), '我喝____。')
expect('grammar ids', new Set(GRAMMAR.map(rule => rule.id)).size, GRAMMAR.length)
expect('hsk bands', HSK.length, 6)
for (const level of HSK) expect(`hsk ${level} rules`, GRAMMAR.filter(rule => rule.level === level).length >= 4, true)
expect('goal default', freshState().settings.goal, 0)
expect('g1 level', freshState().words.find(word => word.id === 'g1')?.level, 1)
expect('bank level', freshState().words.find(word => word.id === 'r1')?.level, 3)
expect('default hsk', freshState().hsk.join(','), '1,2,3,4,5,6')
const picked = freshState()
picked.hsk = [3]
picked.lv = ['read']
expect('hsk filter', selectedWords(picked).map(word => word.id).sort().join(','), 'r1,r2,r4,r6')
for (const word of SEED) {
  expect(`${word.id} uses`, word.uses.length >= 2, true)
  for (const line of [word.example, ...word.uses.map(item => item.hanzi)]) {
    expect(`${word.id} contains ${line}`, line.includes(word.hanzi), true)
  }
}
expect('seed uses on fresh', freshState().words.find(word => word.id === 'g1')?.uses.length, 2)
expect('hsk topics', TOPICS.filter(topic => topic.id.startsWith('hsk')).map(topic => topic.id).join(','), 'hsk1,hsk2,hsk3,hsk4,hsk5,hsk6')
expect('hsk words', HSK_WORDS.length, 5456)
expect('hsk1 count', HSK_WORDS.filter(word => word.level === 1).length, 500)
expect('hsk through 5', HSK_WORDS.filter(word => word.level <= 5).length, 4316)
expect('love', HSK_WORDS.find(word => word.id === 'hsk-L1-0001')?.ru, 'любить')
expect('beijing py', HSK_WORDS.find(word => word.hanzi === '北京')?.pinyin, 'běi jīng')
expect('daughter py', HSK_WORDS.find(word => word.id === 'hsk-L1-0277')?.pinyin, 'nǚ ér')
expect('last year py', HSK_WORDS.find(word => word.hanzi === '去年')?.pinyin, 'qù nián')
expect('hsk in deck', freshState().words.some(word => word.id === 'hsk-L1-0001'), true)
for (const word of HSK_WORDS) {
  const han = [...word.hanzi].length
  const syl = word.pinyin.split(/\s+/).filter(Boolean).length
  const er = [...word.hanzi].filter(ch => ch === '儿').length
  expect(`${word.id} gloss`, word.ru.length > 0 && word.ru.length < 48, true)
  expect(`${word.id} syllables`, syl === han || syl === han - er, true)
}

const bank = parseBkrs(`<div class='ch_ru'><div><b>I</b></div> <div class="m2">1) 银行 yínháng</div> <div class="m3"><div class="ex">государственный банк - 国家银行</div></div> <div class="m2">2) <i>хранилище</i> 库, 数据库</div> <div class="m3"><div class="ex">банк данных - 数据库</div></div> <div class="m2">赌本 dǔběn</div></div>`, 'банк')
expect('ru hanzi', bank.map(item => item.hanzi).join(','), '银行,库,数据库,赌本')
expect('ru gloss', bank[0]?.ru, 'банк')
expect('ru example', bank[0]?.example, '国家银行')
expect('ru example ru', bank[0]?.exampleRu, 'государственный банк')
expect('ru second example', bank[1]?.example, '')
expect('ru data example', bank[2]?.example, '数据库')

const hi = parseBkrs(`<div class='ch_ru'><div>1) 敬礼 jìnglǐ, 问候 wènhòu</div> <div class="m2"><div class="ex">передайте ему привет - 请代我问候他</div></div> <div>2) 你好 nǐhǎo</div></div>`, 'привет')
expect('hi count', hi.length, 3)
expect('hi first', hi[0]?.hanzi, '敬礼')
expect('hi example', hi[0]?.example, '')
expect('hi wen', hi[1]?.hanzi, '问候')
expect('hi wen example', hi[1]?.example, '请代我问候他')
expect('hi hello', hi[2]?.hanzi, '你好')

const zh = parseBkrs(`<div id='ch'> 银行</div> <div class='ru'><div>банк</div> <div class="m2"><div class="ex">把钱存入银行 класть деньги в банк</div></div></div>`, '银行')
expect('zh hanzi', zh[0]?.hanzi, '银行')
expect('zh ru', zh[0]?.ru, 'банк')
expect('zh ex', zh[0]?.example, '把钱存入银行')
expect('zh ex ru', zh[0]?.exampleRu, 'класть деньги в банк')

const hello = parseBkrs(`<div id='ch'> 你好</div> <div class='py'> nǐ hǎo </div> <div class='ru'>привет, здравствуй (<i>стандартное приветствие</i>)</div>`, '你好')
expect('hello ru', hello[0]?.ru, 'привет, здравствуй')
expect('hello py', hello[0]?.pinyin, 'nǐ hǎo')

const water = parseBkrs(`<div id='ch'>水</div> <div class='py'>shuǐ</div> <div class='ru'><div><b>I</b> <span><i>сущ. /счетное слово</i></span></div> <div class="m2">1) вода</div> <div class="m3"><div class="ex">煮水 кипятить воду</div></div> <div class="m2">2) река</div></div>`, '水')
expect('water count', water.length, 1)
expect('water ru', water[0]?.ru, 'вода')
expect('water ex', water[0]?.example, '煮水')
expect('water py', water[0]?.pinyin, 'shuǐ')

const chair = parseBkrs(`<div id='ch'>椅子</div><div class='ru'><div>стул</div><div class="ex">我读过这本书 я читал эту книгу</div><div class="ex">安乐椅子 кресло для отдыха</div></div>`, '椅子')
expect('chair keeps own example', chair[0]?.example, '安乐椅子')
expect('chair drops book', chair[0]?.exampleRu.includes('книгу'), false)
expect('fits chair', exampleFits('椅子', '安乐椅子'), true)
expect('book is not a chair', exampleFits('椅子', '我读过这本书'), false)

const know = parseBkrs(`<div id='ch'>知道</div> <div class='ru'><div>1) <b>zhīdao, zhīdào</b> знать, понимать; узнавать</div> <div class="m2"><div class="ex">我怎么会知道呢？ Как я мог знать?</div></div></div>`, '知道')
expect('know ru', know[0]?.ru, 'знать, понимать')

const sides = parseBkrs(`<div id='ch'>东西</div> <div class='py'>dōngxī, dongxi</div> <div class='ru'><div><b>dōngxī</b></div> <div class="m2">1) восток и запад</div> <div class="m3"><div class="ex">东西走向 широтное направление</div></div> <div><b>dōngxi</b></div> <div class="m2">1) предмет, вещь</div></div>`, '东西')
expect('sides count', sides.length, 2)
expect('sides east', sides[0]?.ru, 'восток и запад')
expect('sides thing', sides[1]?.ru, 'предмет, вещь')
expect('sides py', sides[1]?.pinyin, 'dōngxi')

const py = parseBkrs(`<table id='py_table'> <tr> <td class='py_ch ch'><a href='x'>银行</a></td> <td class='py_py'>yínháng</td> <td class='py_ru'>банк </td> </tr> <tr> <td class='py_ch ch'><a href='y'>引航</a></td> <td class='py_py'>yǐnháng</td> <td class='py_ru'>лоцман</td> </tr> </table>`, 'yinhang')
expect('py first', py[0]?.hanzi, '银行')
expect('py ru', py[0]?.ru, 'банк')
expect('py second', py[1]?.hanzi, '引航')
expect('missing', parseBkrs(`<div id='ch' class=''>yín háng</div> ничего не найдено`, 'yín háng').length, 0)
expect('study compound', studyExample('椅子', '安乐椅子'), false)
expect('study sentence', studyExample('知道', '我怎么会知道呢？'), true)
expect('study clause', studyExample('银行', '把钱存入银行'), true)
expect('gloss parens', cleanGloss('кресло для отдыха ( род качалки )'), 'кресло для отдыха')
expect('search tone', searchKey('shuǐ'), 'shui')
expect('search ü', searchKey('nǚ'), 'nu')
expect('day 1', ruNoun(1, 'день', 'дня', 'дней'), 'день')
expect('answer 3', ruNoun(3, 'ответ', 'ответа', 'ответов'), 'ответа')
expect('answer 11', ruNoun(11, 'ответ', 'ответа', 'ответов'), 'ответов')
const hskOnly = freshState()
hskOnly.lv = ['hsk1']
expect('hsk1 examples', selectedWords(hskOnly).filter(word => word.example).length, 0)
const greetOnly = freshState()
expect('greet examples', selectedWords(greetOnly).filter(word => word.example && word.exampleRu).length >= 4, true)
expect('rate slow', edgeRate(0.8), '-25%')
expect('rate normal', edgeRate(1), '+0%')
expect('rate fast', edgeRate(1.2), '+25%')
expect('rate faster', edgeRate(1.4), '+50%')
noteEdgeFailure(5_000)
expect('edge cooling', edgeCooling(5_000 + 44_000), true)
expect('edge cooled', edgeCooling(5_000 + 45_000), false)
noteEdgeSuccess()
noteEdgeFailure()
let edgeMessage = ''
try { assertEdgeOpen() } catch (error) { edgeMessage = error instanceof Error ? error.message : '' }
expect('edge skips while cooling', edgeMessage, 'cooling')
noteEdgeSuccess()
expect('edge open again', edgeCooling(), false)
assertEdgeOpen()

if (process.exitCode) console.error('selfcheck failed')
else console.log('selfcheck ok')
