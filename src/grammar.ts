export const HSK = [1, 2, 3, 4, 5, 6] as const

export type HskLevel = (typeof HSK)[number]

export type Rule = {
  id: string
  level: HskLevel
  title: string
  rule: string
  example: string
  examplePy: string
  exampleRu: string
}

export const GRAMMAR: Rule[] = [
  { id: 'order', level: 1, title: 'Порядок слов', rule: 'Обычный порядок: кто, когда, где, что делает, с чем. Время и место стоят перед глаголом.', example: '我今天在学校喝茶。', examplePy: 'wǒ jīn tiān zài xué xiào hē chá.', exampleRu: 'Я сегодня в школе пью чай.' },
  { id: 'shi', level: 1, title: '是', rule: 'Связка «являться» стоит между подлежащим и именной частью. Перед ней не нужен другой глагол.', example: '我是学生。', examplePy: 'wǒ shì xué shēng.', exampleRu: 'Я студент.' },
  { id: 'bu', level: 1, title: '不', rule: 'Отрицание 不 стоит прямо перед глаголом или прилагательным. Перед слогом четвёртого тона оно читается bú.', example: '我不是老师。', examplePy: 'wǒ bú shì lǎo shī.', exampleRu: 'Я не учитель.' },
  { id: 'ma', level: 1, title: '吗', rule: 'Частица 吗 в конце превращает утверждение в вопрос, на который отвечают да или нет.', example: '你是学生吗？', examplePy: 'nǐ shì xué shēng ma?', exampleRu: 'Ты студент?' },
  { id: 'ne', level: 1, title: '呢', rule: '呢 возвращает вопрос собеседнику или спрашивает, где человек и как обстоят дела, если тема уже ясна.', example: '我是学生，你呢？', examplePy: 'wǒ shì xué shēng, nǐ ne?', exampleRu: 'Я студент, а ты?' },
  { id: 'ask', level: 1, title: 'Кто, что, где', rule: '谁, 什么, 哪儿, 哪 стоят на месте ответа, а не выносятся в начало, как в русском. С ними 吗 не ставится.', example: '他是谁？', examplePy: 'tā shì shéi?', exampleRu: 'Кто он?' },
  { id: 'de', level: 1, title: '的', rule: '的 связывает определение с существительным: кто чей и какое что.', example: '我的朋友', examplePy: 'wǒ de péng yǒu', exampleRu: 'мой друг' },
  { id: 'hen', level: 1, title: '很', rule: 'Перед прилагательным в роли сказуемого обычно стоит 很. Без него фраза звучит как сравнение.', example: '水很热。', examplePy: 'shuǐ hěn rè.', exampleRu: 'Вода горячая.' },
  { id: 'ye', level: 1, title: '也', rule: '也 «тоже» стоит перед глаголом, а не в конце фразы.', example: '我也是学生。', examplePy: 'wǒ yě shì xué shēng.', exampleRu: 'Я тоже студент.' },
  { id: 'dou', level: 1, title: '都', rule: '都 «все, оба» стоит перед глаголом и относится к тому, что уже названо слева.', example: '我们都是学生。', examplePy: 'wǒ men dōu shì xué shēng.', exampleRu: 'Мы все студенты.' },
  { id: 'he', level: 1, title: '和', rule: '和 соединяет существительные. Глаголы и целые фразы через 和 обычно не соединяют.', example: '我和朋友喝茶。', examplePy: 'wǒ hé péng yǒu hē chá.', exampleRu: 'Мы с другом пьём чай.' },
  { id: 'ge', level: 1, title: '个', rule: 'Перед существительным после числительного нужно счётное слово. 个 подходит для людей и многих предметов. Перед четвёртым тоном 一 читается yí.', example: '一个人', examplePy: 'yí gè rén', exampleRu: 'один человек' },
  { id: 'liang', level: 1, title: '二 и 两', rule: 'Перед счётным словом говорят 两. В номерах, датах и 第二 остаётся 二.', example: '两个人，二月。', examplePy: 'liǎng gè rén, èr yuè.', exampleRu: 'Два человека, февраль.' },
  { id: 'ji', level: 1, title: '几 и 多少', rule: '几 спрашивает небольшое число и любит счётное слово. 多少 спрашивает количество или цену, когда число неизвестно.', example: '几个苹果？多少钱？', examplePy: 'jǐ gè píng guǒ? duō shao qián?', exampleRu: 'Сколько яблок? Сколько стоит?' },
  { id: 'zai', level: 1, title: '在', rule: '在 перед названием места значит «находиться в». Место стоит перед основным действием.', example: '我在学校。', examplePy: 'wǒ zài xué xiào.', exampleRu: 'Я в школе.' },
  { id: 'you', level: 1, title: '有', rule: '有 значит «иметь» или «есть, существует». Отрицание здесь 没有, не 不有.', example: '我有水。', examplePy: 'wǒ yǒu shuǐ.', exampleRu: 'У меня есть вода.' },
  { id: 'xiang', level: 1, title: '想', rule: '想 перед другим глаголом значит «хотеть сделать».', example: '我想喝茶。', examplePy: 'wǒ xiǎng hē chá.', exampleRu: 'Я хочу пить чай.' },
  { id: 'hui', level: 1, title: '会', rule: '会 перед глаголом значит «уметь» или «бывает, что». Здесь это умение, а не «собрание».', example: '我会写汉字。', examplePy: 'wǒ huì xiě hàn zì.', exampleRu: 'Я умею писать иероглифы.' },
  { id: 'le', level: 1, title: '了 после глагола', rule: '了 после глагола показывает, что действие завершено. Отрицание такого действия — 没, без 了.', example: '我喝了水。', examplePy: 'wǒ hē le shuǐ.', exampleRu: 'Я выпил воду.' },
  { id: 'time', level: 1, title: 'Время перед глаголом', rule: 'Обстоятельство времени ставится перед глаголом, часто сразу после подлежащего.', example: '我今天喝茶。', examplePy: 'wǒ jīn tiān hē chá.', exampleRu: 'Я сегодня пью чай.' },
  { id: 'ba', level: 1, title: '吧', rule: '吧 в конце смягчает фразу: предложение, догадка или согласие.', example: '我们走吧。', examplePy: 'wǒ men zǒu ba.', exampleRu: 'Пойдём.' },
  { id: 'how', level: 1, title: '怎么', rule: '怎么 спрашивает способ. Как и другие вопросительные слова, оно стоит на месте ответа.', example: '你怎么来学校？', examplePy: 'nǐ zěn me lái xué xiào?', exampleRu: 'Как ты добираешься до школы?' },

  { id: 'haishi', level: 2, title: '还是', rule: 'В вопросе с выбором из двух вариантов ставят 还是. Это не то же самое, что спокойное «или» в утверждении.', example: '你喝茶还是喝水？', examplePy: 'nǐ hē chá hái shì hē shuǐ?', exampleRu: 'Ты пьёшь чай или воду?' },
  { id: 'huozhe', level: 2, title: '或者', rule: '或者 соединяет варианты в утверждении. В вопросе «что из двух?» вместо него обычно 还是.', example: '明天或者后天。', examplePy: 'míng tiān huò zhě hòu tiān.', exampleRu: 'Завтра или послезавтра.' },
  { id: 'yinwei', level: 2, title: '因为…所以…', rule: '因为 называет причину, 所以 — следствие. В одной фразе часто хватает и одной из этих связок.', example: '因为下雨，所以我不去。', examplePy: 'yīn wèi xià yǔ, suǒ yǐ wǒ bú qù.', exampleRu: 'Потому что идёт дождь, я не иду.' },
  { id: 'bi', level: 2, title: '比', rule: '比 стоит между тем, что сравнивают, и прилагательным. 很 перед этим прилагательным не ставится.', example: '他比我高。', examplePy: 'tā bǐ wǒ gāo.', exampleRu: 'Он выше меня.' },
  { id: 'zui', level: 2, title: '最', rule: '最 перед прилагательным или глаголом даёт превосходную степень: самый, больше всего.', example: '这个最好。', examplePy: 'zhè ge zuì hǎo.', exampleRu: 'Этот самый хороший.' },
  { id: 'guo', level: 2, title: '过', rule: '过 после глагола значит, что опыт уже был хотя бы раз. Отрицание — 没, без 了.', example: '我去过中国。', examplePy: 'wǒ qù guo zhōng guó.', exampleRu: 'Я бывал в Китае.' },
  { id: 'ing', level: 2, title: '正在', rule: '正在 перед глаголом показывает, что действие идёт прямо сейчас.', example: '我正在吃饭。', examplePy: 'wǒ zhèng zài chī fàn.', exampleRu: 'Я как раз ем.' },
  { id: 'change', level: 2, title: '了 в конце', rule: '了 в конце фразы показывает новое положение дел: стало так. Это не то же самое, что 了 сразу после глагола.', example: '下雨了。', examplePy: 'xià yǔ le.', exampleRu: 'Пошёл дождь.' },
  { id: 'deg', level: 2, title: '得', rule: '得 после глагола вводит оценку действия: как именно оно происходит. Это не притяжательное 的.', example: '他说得很慢。', examplePy: 'tā shuō de hěn màn.', exampleRu: 'Он говорит очень медленно.' },
  { id: 'wan', level: 2, title: '完', rule: '完 после глагола значит, что действие довели до конца. 了 часто стоит после всего сочетания.', example: '我吃完了。', examplePy: 'wǒ chī wán le.', exampleRu: 'Я доел.' },
  { id: 'bit', level: 2, title: '一点儿 и 有点儿', rule: '一点儿 называет небольшое количество и стоит после глагола. 有点儿 стоит перед прилагательным и часто звучит как лёгкая жалоба.', example: '这水有点儿热。', examplePy: 'zhè shuǐ yǒu diǎnr rè.', exampleRu: 'Эта вода горячовата.' },
  { id: 'again', level: 2, title: '再 и 又', rule: '再 — повторить ещё раз, обычно о будущем. 又 — действие уже повторилось.', example: '请明天再来。', examplePy: 'qǐng míng tiān zài lái.', exampleRu: 'Приходите ещё раз завтра.' },
  { id: 'jiu', level: 2, title: '就 и 才', rule: '就 показывает, что вышло рано или легко. 才 — что вышло поздно или потребовало усилия. Оба стоят перед глаголом.', example: '他七点就来了，我十点才来。', examplePy: 'tā qī diǎn jiù lái le, wǒ shí diǎn cái lái.', exampleRu: 'Он пришёл уже в семь, а я только в десять.' },
  { id: 'can', level: 2, title: '会、能、可以', rule: '会 — выученное умение. 能 — получается по силам и обстоятельствам. 可以 — разрешено или уместно.', example: '我可以写，但是现在不能。', examplePy: 'wǒ kě yǐ xiě, dàn shì xiàn zài bù néng.', exampleRu: 'Мне можно писать, но сейчас не получается.' },
  { id: 'bie', level: 2, title: '别', rule: '别 перед глаголом — запрет или просьба не делать. Поблизости по смыслу 不要.', example: '请别说话。', examplePy: 'qǐng bié shuō huà.', exampleRu: 'Пожалуйста, не разговаривайте.' },
  { id: 'first', level: 2, title: '先…再…', rule: '先 отмечает первый шаг, 再 — следующий. Так выстраивают порядок дел.', example: '我先洗手，再吃饭。', examplePy: 'wǒ xiān xǐ shǒu, zài chī fàn.', exampleRu: 'Сначала мою руки, потом ем.' },
  { id: 'yesno', level: 2, title: '是不是', rule: 'Повтор утверждения и отрицания просит подтвердить догадку. 吗 при этом не нужен.', example: '你是不是老师？', examplePy: 'nǐ shì bu shì lǎo shī?', exampleRu: 'Ты ведь учитель?' },
  { id: 'already', level: 2, title: '已经', rule: '已经 «уже» стоит перед глаголом. Завершённость часто добирает 了.', example: '我已经吃了。', examplePy: 'wǒ yǐ jīng chī le.', exampleRu: 'Я уже поел.' },
  { id: 'give', level: 2, title: '给', rule: '给 вводит адресата: кому дают, говорят или звонят. Адресат стоит перед главным глаголом либо сразу после 给.', example: '我给朋友一杯茶。', examplePy: 'wǒ gěi péng yǒu yì bēi chá.', exampleRu: 'Я даю другу чашку чая.' },
  { id: 'far', level: 2, title: '离', rule: '离 отмечает расстояние от одной точки до другой. Дальше обычно идёт 远 или 近.', example: '学校离家很近。', examplePy: 'xué xiào lí jiā hěn jìn.', exampleRu: 'Школа близко от дома.' },
  { id: 'moment', level: 2, title: '一下', rule: '一下 после глагола делает действие коротким или просьбу мягче. Перед слогом четвёртого тона 一 читается yí.', example: '请等一下。', examplePy: 'qǐng děng yí xià.', exampleRu: 'Подождите немного.' },

  { id: 'baobj', level: 3, title: '把', rule: '把 выносит объект перед глаголом, когда с ним что-то делают до результата. Голый глагол без концовки после 把 обычно не оставляют.', example: '请把门关上。', examplePy: 'qǐng bǎ mén guān shàng.', exampleRu: 'Закройте, пожалуйста, дверь.' },
  { id: 'bei', level: 3, title: '被', rule: '被 вводит того, кто совершил действие, а подлежащее принимает его на себя. Если действующее лицо неважно, после 被 его можно не называть.', example: '我的书被朋友拿了。', examplePy: 'wǒ de shū bèi péng yǒu ná le.', exampleRu: 'Мою книгу забрал друг.' },
  { id: 'shide', level: 3, title: '是…的', rule: '是…的 выделяет уже известный факт: когда, где или как это было. Сам глагол внутри часто без 了.', example: '我是昨天来的。', examplePy: 'wǒ shì zuó tiān lái de.', exampleRu: 'Я приехал вчера.' },
  { id: 'yue', level: 3, title: '越来越', rule: '越来越 перед прилагательным или глаголом значит «всё более».', example: '天气越来越冷。', examplePy: 'tiān qì yuè lái yuè lěng.', exampleRu: 'Погода становится всё холоднее.' },
  { id: 'yibian', level: 3, title: '一边…一边…', rule: '一边…一边… ставит два действия в одно время. Перед слогом первого тона 一 читается yì.', example: '他一边走一边说。', examplePy: 'tā yì biān zǒu yì biān shuō.', exampleRu: 'Он говорит на ходу.' },
  { id: 'ifr', level: 3, title: '如果…就…', rule: '如果 открывает условие, 就 — то, что из него следует.', example: '如果下雨，我就不去。', examplePy: 'rú guǒ xià yǔ, wǒ jiù bú qù.', exampleRu: 'Если пойдёт дождь, я не пойду.' },
  { id: 'notonly', level: 3, title: '不但…而且…', rule: '不但…而且… наращивает смысл: не только это, но и то. Перед слогом четвёртого тона 不 читается bú.', example: '他不但会中文，而且会俄语。', examplePy: 'tā bú dàn huì zhōng wén, ér qiě huì é yǔ.', exampleRu: 'Он знает не только китайский, но и русский.' },
  { id: 'forwhat', level: 3, title: '为了', rule: '为了 ставит цель впереди действия. Цель — ради чего это делается.', example: '为了学习，他来中国。', examplePy: 'wèi le xué xí, tā lái zhōng guó.', exampleRu: 'Ради учёбы он приехал в Китай.' },
  { id: 'except', level: 3, title: '除了…以外', rule: '除了 выделяет исключение или то, что добавляют сверх. Дальше часто идут 还, 也 или 都.', example: '除了茶，我还喝水。', examplePy: 'chú le chá, wǒ hái hē shuǐ.', exampleRu: 'Кроме чая я ещё пью воду.' },
  { id: 'same', level: 3, title: '跟…一样', rule: '跟…一样 говорит, что две вещи совпадают. Перед слогом четвёртого тона 一 читается yí.', example: '这个跟那个一样。', examplePy: 'zhè ge gēn nà ge yí yàng.', exampleRu: 'Этот такой же, как тот.' },
  { id: 'zhe', level: 3, title: '着', rule: '着 после глагола показывает состояние, которое держится: дверь остаётся открытой, человек продолжает смотреть.', example: '门开着。', examplePy: 'mén kāi zhe.', exampleRu: 'Дверь открыта.' },
  { id: 'assoon', level: 3, title: '一…就…', rule: '一…就… значит «как только…, так сразу…». Перед четвёртым тоном 一 читается yí, перед остальными часто yì.', example: '我一喝茶就高兴。', examplePy: 'wǒ yì hē chá jiù gāo xìng.', exampleRu: 'Как выпью чаю, сразу хорошее настроение.' },
  { id: 'caus', level: 3, title: '让 и 叫', rule: '让 или 叫 плюс человек плюс глагол: попросить, позволить или заставить сделать.', example: '老师让我读书。', examplePy: 'lǎo shī ràng wǒ dú shū.', exampleRu: 'Учитель просит меня читать.' },
  { id: 'dir', level: 3, title: '来 и 去', rule: '来 и 去 после глагола показывают направление к говорящему или от него. Их можно складывать с 进, 出, 上, 下.', example: '请进来。', examplePy: 'qǐng jìn lái.', exampleRu: 'Входите.' },
  { id: 'less', level: 3, title: '没有 в сравнении', rule: 'A 没有 B и прилагательное: A уступает B. Это сравнение, а не просто «у A нет B».', example: '今天没有昨天冷。', examplePy: 'jīn tiān méi yǒu zuó tiān lěng.', exampleRu: 'Сегодня не так холодно, как вчера.' },
  { id: 'di', level: 3, title: '地', rule: '地 ставится после наречного определения, перед глаголом. Так прилагательное превращается в признак действия.', example: '他慢慢地走。', examplePy: 'tā màn màn de zǒu.', exampleRu: 'Он медленно идёт.' },

  { id: 'anyway', level: 4, title: '不管…都…', rule: '不管 открывает любое условие, 都 — неизменный результат. Спрашивающее слово внутри 不管 обычно нужно.', example: '不管多忙，他都学习。', examplePy: 'bù guǎn duō máng, tā dōu xué xí.', exampleRu: 'Как бы ни был занят, он учится.' },
  { id: 'since', level: 4, title: '既然…就…', rule: '既然 принимает уже известный факт, 就 — вывод из него.', example: '既然来了，就坐下吧。', examplePy: 'jì rán lái le, jiù zuò xià ba.', exampleRu: 'Раз уж пришёл, садись.' },
  { id: 'aslong', level: 4, title: '只要…就…', rule: '只要 задаёт достаточное условие: достаточно этого, и результат будет.', example: '只要你来，我就高兴。', examplePy: 'zhǐ yào nǐ lái, wǒ jiù gāo xìng.', exampleRu: 'Стоило тебе прийти, и я рад.' },
  { id: 'onlyif', level: 4, title: '只有…才…', rule: '只有…才… задаёт необходимое условие: только если так, и никак иначе.', example: '只有努力，才能进步。', examplePy: 'zhǐ yǒu nǔ lì, cái néng jìn bù.', exampleRu: 'Только усердие даёт прогресс.' },
  { id: 'even', level: 4, title: '连…都…', rule: '连 выделяет крайний случай, 都 или 也 показывает, что даже он не исключение.', example: '连孩子都知道。', examplePy: 'lián hái zi dōu zhī dào.', exampleRu: 'Даже ребёнок знает.' },
  { id: 'instead', level: 4, title: '反而', rule: '反而 отмечает итог, обратный ожиданию.', example: '他说了以后，我反而不明白。', examplePy: 'tā shuō le yǐ hòu, wǒ fǎn ér bù míng bai.', exampleRu: 'После его объяснения я, наоборот, не понял.' },
  { id: 'reallyq', level: 4, title: '难道', rule: '难道 делает вопрос риторическим: неужели так и есть. В конце часто остаётся 吗.', example: '难道你不知道吗？', examplePy: 'nán dào nǐ bù zhī dào ma?', exampleRu: 'Неужели ты не знаешь?' },
  { id: 'notbut', level: 4, title: '不是…而是…', rule: '不是 снимает неверную догадку, 而是 ставит на её место верную.', example: '这不是水，而是茶。', examplePy: 'zhè bú shì shuǐ, ér shì chá.', exampleRu: 'Это не вода, а чай.' },
  { id: 'about', level: 4, title: '对于', rule: '对于 вводит тему, к которой относится мнение. Часто рядом бывает 来说.', example: '对于这个问题，我不知道。', examplePy: 'duì yú zhè ge wèn tí, wǒ bù zhī dào.', exampleRu: 'По этому вопросу я не знаю.' },
  { id: 'via', level: 4, title: '通过', rule: '通过 называет средство или то, что удалось пройти: через практику, через экзамен.', example: '通过考试，他很高兴。', examplePy: 'tōng guò kǎo shì, tā hěn gāo xìng.', exampleRu: 'Сдав экзамен, он очень рад.' },

  { id: 'nomatter', level: 5, title: '无论…都…', rule: '无论 близко к 不管: какой бы ни был выбор, вывод с 都 один.', example: '无论去不去，都告诉我。', examplePy: 'wú lùn qù bu qù, dōu gào su wǒ.', exampleRu: 'Пойдёшь или нет, всё равно скажи мне.' },
  { id: 'rather', level: 5, title: '与其…不如…', rule: '与其 отвергает худший вариант, 不如 предлагает лучший.', example: '与其在家，不如出去走走。', examplePy: 'yǔ qí zài jiā, bù rú chū qù zǒu zou.', exampleRu: 'Чем сидеть дома, лучше пройтись.' },
  { id: 'evenif', level: 5, title: '即使…也…', rule: '即使 допускает крайний случай, 也 говорит, что вывод не меняется.', example: '即使下雨，他也去。', examplePy: 'jí shǐ xià yǔ, tā yě qù.', exampleRu: 'Даже если идёт дождь, он всё равно идёт.' },
  { id: 'due', level: 5, title: '由于', rule: '由于 вводит причину, чаще в более собранной, письменной фразе, чем бытовое 因为.', example: '由于时间不够，我们没去。', examplePy: 'yóu yú shí jiān bú gòu, wǒ men méi qù.', exampleRu: 'Из-за нехватки времени мы не пошли.' },
  { id: 'thus', level: 5, title: '从而', rule: '从而 связывает поступок и результат, который из него получился.', example: '他每天练习，从而提高了水平。', examplePy: 'tā měi tiān liàn xí, cóng ér tí gāo le shuǐ píng.', exampleRu: 'Он занимается каждый день и за счёт этого поднял уровень.' },
  { id: 'lest', level: 5, title: '以免', rule: '以免 вводит нежелательное следствие, которого хотят избежать.', example: '早点出门，以免迟到。', examplePy: 'zǎo diǎn chū mén, yǐ miǎn chí dào.', exampleRu: 'Выйди пораньше, чтобы не опоздать.' },

  { id: 'prefer', level: 6, title: '宁可…也…', rule: '宁可 выбирает трудный вариант, 也 отвергает тот, на который не согласны.', example: '我宁可走路，也不迟到。', examplePy: 'wǒ nìng kě zǒu lù, yě bù chí dào.', exampleRu: 'Я лучше пойду пешком, чем опоздаю.' },
  { id: 'whybother', level: 6, title: '何必', rule: '何必 спрашивает, зачем утруждать себя: в этом нет нужды.', example: '何必现在走？', examplePy: 'hé bì xiàn zài zǒu?', exampleRu: 'К чему уходить прямо сейчас?' },
  { id: 'avoid', level: 6, title: '难免', rule: '难免 значит, что чего-то трудно избежать. Дальше обычно стоит нежелательный, но понятный итог.', example: '开始学难免说错。', examplePy: 'kāi shǐ xué nán miǎn shuō cuò.', exampleRu: 'В начале учёбы трудно не ошибаться в речи.' },
  { id: 'regard', level: 6, title: '以…为…', rule: '以…为… назначает роль: принимать что-то за что-то. Здесь 为 читается wéi.', example: '我们以茶为礼。', examplePy: 'wǒ men yǐ chá wéi lǐ.', exampleRu: 'У нас чай — это знак внимания.' },
  { id: 'along', level: 6, title: '随着', rule: '随着 ставит перемену, вместе с которой меняется и остальное.', example: '随着练习，发音好了。', examplePy: 'suí zhe liàn xí, fā yīn hǎo le.', exampleRu: 'По мере практики произношение стало лучше.' },
  { id: 'surprise', level: 6, title: '竟然', rule: '竟然 отмечает неожиданный, трудно поверимый факт.', example: '他竟然不认识老师。', examplePy: 'tā jìng rán bú rèn shi lǎo shī.', exampleRu: 'Он, представьте, не знает учителя.' },
]
