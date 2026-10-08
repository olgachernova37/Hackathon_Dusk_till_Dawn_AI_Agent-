# 🎤 Пітч для журі — From Dusk Till Dawn #01

Презентація: **п'ятниця, 10:00**. Мова: англійська. Тут простий текст, щоб читати вголос, і переклад під кожною частиною.

Тривалість пітчу ~**2,5 хвилини**, далі запитання журі. Якщо дадуть менше часу, пропусти частину 4.

**Перед виходом:**
- [ ] Відкрита вкладка `echobrief.online/en/market`, масштаб 110%
- [ ] Телефон із World App під рукою
- [ ] Друга вкладка: `HACKATHON.md` на GitHub
- [ ] Якщо Wi‑Fi поганий — роздати інтернет з телефона

---

## 1. Проблема · 20 секунд

> "AI agents can now hire other agents and pay them. That is great — until an agent pays the wrong agent, or pays for work that was never done. Today you have two bad options: let the agent spend freely, or approve every single payment yourself."

*«AI-агенти вже можуть наймати інших агентів і платити їм. Це чудово — поки агент не заплатить не тому агенту або не заплатить за роботу, якої не зробили. Сьогодні є два погані варіанти: дозволити агенту витрачати вільно або підтверджувати кожен платіж самому.»*

## 2. Рішення · 30 секунд

> "We built a marketplace where agents trade on their own, and a human steps in only when the risk is real. A buyer agent finds a provider. Before any money moves, it checks the provider's wallet on The Graph. The money waits in escrow. The provider agent does the job. A judge agent checks the result. Small, safe deals run with no human at all. Big deals, risky wallets, or an unsure judge — those wait for a World ID Selfie Check."

*«Ми побудували маркетплейс, де агенти торгують самі, а людина втручається, лише коли ризик справжній. Агент-покупець знаходить виконавця. Перш ніж рухаються гроші, він перевіряє гаманець виконавця в The Graph. Гроші чекають в ескроу. Агент-виконавець робить роботу. Агент-суддя перевіряє результат. Малі безпечні угоди проходять зовсім без людини. Великі угоди, ризикові гаманці або непевний суддя — чекають на World ID Selfie Check.»*

## 3. Живе демо · 60 секунд

**Що робити:** натисни **Run the demo** угорі сторінки. Коли з'явиться Selfie Check — скануй QR телефоном.

> "Let me show it. First, a small job: a translation for two cents. The agent understands my request, picks the cheapest translator, checks the wallet — clean — and pays through escrow after the judge accepts. No human needed."
>
> "Now a big job: a smart contract audit for twenty-five dollars. This is above the limit, so it stops and asks me. I do a Selfie Check — the proof is bound to this exact deal. If anyone changes the amount or the address, the proof stops working."

*«Покажу. Спершу мала робота: переклад за два центи. Агент розуміє мій запит, обирає найдешевшого перекладача, перевіряє гаманець — чистий — і платить через ескроу після того, як суддя прийняв роботу. Людина не потрібна.»*

*«Тепер велика робота: аудит смарт-контракту за двадцять п'ять доларів. Це більше за ліміт, тож система зупиняється і питає мене. Я роблю Selfie Check — доказ прив'язаний саме до цієї угоди. Якщо хтось змінить суму чи адресу, доказ перестане працювати.»*

💡 Якщо Selfie Check на місці не працює: **не вдавай**. Скажи: *"The network here blocks the World App, so I will show this part in the video."* — «Мережа тут блокує World App, тож цю частину я покажу у відео.»

## 4. Чому це не іграшка · 20 секунд

> "Three rules make it safe. One: the model never chooses who gets paid — discovery is plain code. Two: money is paid only after delivery, and only once. Three: when anything fails — no data, no model — the system asks a human. It never guesses in favour of paying."

*«Безпечним це роблять три правила. Перше: модель ніколи не обирає, кому платити — пошук виконавця є звичайним кодом. Друге: гроші виплачуються лише після здачі роботи і лише один раз. Третє: коли щось ламається — немає даних, немає моделі — система питає людину. Вона ніколи не вгадує на користь оплати.»*

## 5. Чесно про межі · 15 секунд

**Покажи:** вкладку з `HACKATHON.md`

> "To be clear about what is real: payments are simulated — escrow is a record, not money on chain yet. The Selfie Check and The Graph data come from my earlier project. The marketplace — discovery, escrow, the judge and the agents — is new for this hackathon. Everything is listed in HACKATHON.md."

*«Щоб було ясно, що справжнє: платежі симульовані — ескроу поки що є записом, а не грошима в блокчейні. Selfie Check і дані The Graph — з мого попереднього проєкту. Маркетплейс — пошук виконавця, ескроу, суддя й агенти — новий, зроблений для цього хакатону. Усе розписано в HACKATHON.md.»*

## 6. Фінал · 10 секунд

> "Agents work fast. Humans stay in charge — only where it matters. Thank you."

*«Агенти працюють швидко. Люди залишаються головними — лише там, де це важливо. Дякую.»*

---

## Запитання журі — готові відповіді

**"Did you build this before the hackathon?"** — «Ви зробили це до хакатону?»
> "The Selfie Check gate and The Graph risk engine are from my September project, ETHOnline. The marketplace on top is new. The commit history and HACKATHON.md show exactly what is old and what is new."

*«Selfie Check і оцінка ризику The Graph — з мого вересневого проєкту для ETHOnline. Маркетплейс поверх них — новий. Історія комітів і HACKATHON.md точно показують, що старе, а що нове.»*

**"Why is the escrow not on chain?"** — «Чому ескроу не в блокчейні?»
> "One night was not enough to do it safely. The escrow rules are already code with tests — pay only after delivery, pay only once. The next step is to move the money into a testnet contract, or into Masumi's escrow."

*«Однієї ночі не вистачило, щоб зробити це безпечно. Правила ескроу вже є кодом із тестами — платити лише після здачі, платити лише раз. Наступний крок — перенести гроші в контракт у тестовій мережі або в ескроу Masumi.»*

**"What if the judge is wrong?"** — «А якщо суддя помилиться?»
> "The judge only gives advice. On small deals a wrong answer costs cents. On big deals, or when the judge is not sure, a human makes the final decision."

*«Суддя лише радить. На малих угодах помилка коштує центи. На великих угодах, або коли суддя не впевнений, остаточне рішення приймає людина.»*

**"Why a selfie and not a wallet signature?"** — «Чому селфі, а не підпис гаманцем?»
> "A key can be stolen or used by a script. A Selfie Check needs a live person. And the proof is tied to one exact deal, so it cannot be reused for another payment."

*«Ключ можна вкрасти або використати скриптом. Selfie Check потребує живої людини. А доказ прив'язаний до однієї конкретної угоди, тож його не можна використати для іншого платежу.»*

**"Who are the provider agents?"** — «Хто ці агенти-виконавці?»
> "For the demo, they are AI agents running on our server, with demo prices. In a real network, they would be other people's agents in a public registry, like Masumi."

*«Для демо — це AI-агенти на нашому сервері з демо-цінами. У справжній мережі це були б агенти інших людей у публічному реєстрі, наприклад Masumi.»*

**Якщо не зрозуміла запитання:**
> "Sorry, could you say that again more slowly?" — «Вибачте, можете повторити повільніше?»
