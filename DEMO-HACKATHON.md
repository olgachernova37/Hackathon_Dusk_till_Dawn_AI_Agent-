# 🎬 Демо-відео для From Dusk Till Dawn #01 — план запису

Відкрий у VS Code і натисни **`Ctrl+Shift+V`**, щоб файл став гарно відформатованим.
Тримай його поруч під час запису і читай текст звідси.

**Правила хакатону:** відео **2 хвилини**, здати разом із кодом до **07:14**.
Код має бути заморожений до 07:14, тож записуй, коли все вже працює.

---

## 1. Перед записом (обов'язково, ~15 хвилин)

На сайті (у налаштуваннях хостингу) або в `.env.local` мають бути:

- [ ] **`OPENAI_API_KEY`** — без нього покупець не розуміє запит моделлю, виконавець не працює, а суддя кожну угоду віддає людині
- [ ] **`MARKET_PROVIDER_ADDRESSES`** — справжні гаманці з історією на Uniswap, наприклад твої. Без них навіть мала угода піде на Selfie Check:
  ```
  MARKET_PROVIDER_ADDRESSES={"lingo-fast":"0x…","audit-hawk":"0x…"}
  ```
- [ ] **`GRAPH_API_KEY`** і ключі World ID — вони вже є з основного проєкту

Перевір на сайті, що працює:
1. Відкрий `/en/market`, натисни **Run the demo** і пройди обидві історії до кінця без запису
2. Мала угода має пройти **без** Selfie Check, а на плитці The Graph має бути зелений значок **Live**
3. Якщо щось не так — спершу виправ, потім записуй

Як готувати екран:
- `Ctrl+Shift+B` — сховати закладки
- Відкрити рівно одну вкладку: `https://echobrief.online/en/market`
- Масштаб **110%** (`Ctrl` + `+`)
- `Win+A` → «Не турбувати»
- Телефон заряджений, World App відкритий
- **Ніколи не показувати:** `.env.local`, налаштування Vercel, ключі

## 2. Як записувати

Як і минулого разу: **кожну сцену окремо** (`Win+Alt+R`), потім склеїти в **Clipchamp**.
Паузи, коли агент «думає» або ти робиш селфі, — вирізай. Інакше 2 хвилини не вмістяться.

---

## 3. Сцени

### 🎬 Сцена 1 — Проблема · 0:00–0:15

**Екран:** `/en/market`, ще нічого не натиснуто

**Що говорити:**
> "AI agents can now hire other agents and pay them. But who checks the work? And who stops a big payment to the wrong agent? This is a marketplace where agents trade alone, and a human steps in only when the risk is real."

*Переклад: «AI-агенти вже можуть наймати інших агентів і платити їм. Але хто перевіряє роботу? І хто зупинить великий платіж не тому агенту? Це маркетплейс, де агенти торгують самі, а людина втручається, лише коли ризик справжній.»*

---

### 🎬 Сцена 2 — Мала угода, без людини · 0:15–0:45

**Екран:** той самий

**Що робити:**
1. У поле **Ask in your own words** встав:
   ```
   Translate into Czech, cheapest provider please: "Good morning, the meeting is at 10."
   ```
2. Натисни **Ask the buyer agent**
3. Наведи курсор на рядок **Understood as translate**, потім на список виконавців, де обраний підсвічений
4. Наведи на плитку **The Graph** зі значком **Live**
5. Покажи, що в **Human gate** написано «Not needed»
6. Натисни **Let the provider's agent do the job**, потім **Ask the judge**
7. Покажи статус **Paid to provider**

**Що говорити:**
> "I ask in my own words. The buyer agent understands the job and finds the cheapest translator. Before any money moves, it checks the translator's wallet on The Graph — live data. It is two cents and the wallet is clean, so no human is needed. The money waits in escrow. The provider agent does the work. A judge agent checks it, and only then the money is paid."

*Переклад: «Я прошу своїми словами. Агент-покупець розуміє завдання і знаходить найдешевшого перекладача. Перш ніж рухаються гроші, він перевіряє гаманець перекладача в The Graph — живі дані. Це два центи, гаманець чистий, тож людина не потрібна. Гроші чекають в ескроу. Агент-виконавець робить роботу. Агент-суддя перевіряє її, і лише тоді гроші виплачуються.»*

---

### 🎬 Сцена 3 — Велика угода, з людиною · 0:45–1:30

**Екран:** той самий

**Що робити:**
1. У поле **Ask in your own words** встав:
   ```
   Audit this Solidity withdraw() for reentrancy: it sends ETH to msg.sender first, then sets balance[msg.sender] = 0.
   ```
2. Натисни **Ask the buyer agent**
3. Покажи в **Human gate** причину: «$25 is above the $1 limit…»
4. Натисни **Approve with Selfie Check**, скануй QR телефоном, зроби селфі. **Телефон не знімай**, просто говори
5. Покажи статус **Funds in escrow**
6. **Let the provider's agent do the job**, потім **Ask the judge**
7. Суддя каже **Accepted**, але сума велика, тож знову з'являється Selfie Check. Підтверди
8. Покажи **Paid to provider** і праву колонку **Deal history**

**Що говорити:**
> "Now a big job: a smart contract audit for twenty-five dollars. This is above the limit, so the agent cannot pay alone. I approve with World ID Selfie Check, and the proof is bound to this exact deal. The money is locked in escrow. The auditor agent finds the bug. The judge accepts the work, but the amount is big, so the last word is mine again. One more selfie, and the auditor is paid. Every step is in the history."

*Переклад: «Тепер велика робота: аудит смарт-контракту за двадцять п'ять доларів. Це більше за ліміт, тож агент не може заплатити сам. Я підтверджую через World ID Selfie Check, і доказ прив'язаний саме до цієї угоди. Гроші заблоковані в ескроу. Агент-аудитор знаходить помилку. Суддя приймає роботу, але сума велика, тож останнє слово знову за мною. Ще одне селфі, і аудитор отримує оплату. Кожен крок є в історії.»*

---

### 🎬 Сцена 4 — Чесно про межі · 1:30–1:45

**Екран:** жовтий рядок угорі сторінки («Settlement is simulated…»), потім файл `HACKATHON.md` на GitHub, розділ **What is real and what is simulated**

**Навіщо:** 10% балів дають за чесні межі продукту

**Що говорити:**
> "To be honest about limits: payments here are simulated — escrow is a record, not money on chain yet. The selfie gate and The Graph data are real, from my earlier project. Discovery, escrow, the judge and the agents were built for this hackathon."

*Переклад: «Чесно про межі: платежі тут симульовані — ескроу поки що є записом, а не грошима в блокчейні. Селфі-контроль і дані The Graph справжні, з мого попереднього проєкту. Пошук виконавця, ескроу, суддя й агенти зроблені для цього хакатону.»*

---

### 🎬 Сцена 5 — Підсумок · 1:45–2:00

**Екран:** сторінка з закритою великою угодою

**Що говорити:**
> "Agents find each other, agree a price, and work. The money waits in escrow until a judge checks the result. And a real human is on the gate — only when the risk is real. Thank you."

*Переклад: «Агенти знаходять одне одного, домовляються про ціну і працюють. Гроші чекають в ескроу, поки суддя не перевірить результат. А справжня людина стоїть на воротах — лише тоді, коли ризик справжній. Дякую.»*

---

## 4. Після запису — перевір

- [ ] Довжина **не більше 2:00**. Якщо довше, скороти паузи в сцені 3
- [ ] Голос чутно всюди
- [ ] Експорт у **1080p**
- [ ] У кадрі **немає** ключів, `.env.local`, налаштувань Vercel, особистих закладок
- [ ] Відео і посилання на репозиторій здані **до 07:14**

## 5. Запасний план

- **Selfie Check не працює на місці** (Wi‑Fi, телефон): запиши сцену 2 і поясни сцену 3 словами на тлі картки «Human gate». Не вдавай, що підтвердження пройшло.
- **OpenAI не відповідає:** суддя скаже «Uncertain» і передасть рішення людині. Це теж чесна демонстрація: система не платить навмання.
- **Немає часу на дві сцени:** кнопка **Run the demo** вгорі проганяє обидві історії сама і зупиняється на кожному Selfie Check.
