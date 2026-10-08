# 🎬 Демо-відео для From Dusk Till Dawn #01 — 90 секунд

Відкрий у VS Code і натисни **`Ctrl+Shift+V`**, щоб файл став гарно відформатованим.
Тримай його поруч під час запису і читай англійський текст звідси.

**Правила:** відео **не довше 90 секунд**, здати разом із репозиторієм у HQ до **07:14**.
Після 07:14 код не змінюємо.

---

## 1. Перед записом (~10 хвилин)

1. Відкрий `https://matching-nu-ten.vercel.app/en/market`
2. Зверху має бути рядок **«Real testnet money: USDC on Ethereum Sepolia…»**.
   Якщо замість нього жовтий **«SIMULATED…»** — онови сторінку; якщо не зник, не записуй, спершу напиши мені.
3. Пройди малу угоду один раз **без запису** (кроки в сцені 2). Вона має дійти до **Paid to provider**.
4. Друга вкладка: `https://sepolia.etherscan.io/address/0x902Bf6E3D3412b3537417189c4afc591c74c7661` (гаманець ескроу)

Екран:
- `Ctrl+Shift+B` — сховати закладки
- Масштаб **110%** (`Ctrl` + `+`)
- `Win+A` → «Не турбувати»
- **Ніколи не показувати:** налаштування Vercel, `.env.local`, ключі

## 2. Як записувати

Кожну сцену окремо (`Win+Alt+R`), потім склеїти в **Clipchamp**.
Паузи, коли агент «думає», — вирізай, інакше 90 секунд не вмістяться.

---

## 3. Сцени

### 🎬 Сцена 1 — Проблема · 0:00–0:10

**Екран:** `/en/market`, нічого не натиснуто (зверху питання **What do you need?**)

> "AI agents can now hire other agents and pay them. But who checks the work before the money moves? This marketplace does it."

*«AI-агенти вже можуть наймати інших агентів і платити їм. Але хто перевіряє роботу, перш ніж рухаються гроші? Цей маркетплейс це робить.»*

---

### 🎬 Сцена 2 — Мала угода, справжні гроші на тестнеті · 0:10–0:55

**Що робити:**
1. У поле **Ask in your own words** встав:
   ```
   Translate into Czech, cheapest provider please: "Good morning, the meeting is at 10."
   ```
2. **Ask the buyer agent** → під кнопкою **Understood as translate**, нижче картка угоди з кроками. На кроці **Money held in escrow** — рядок **Locked on chain (buyer → escrow)**
3. **Let the provider's agent do the job** → покажи переклад
4. **Ask the judge** → **Accepted**, потім **Paid on chain (escrow → provider)** і статус **Paid to provider**
5. Клікни посилання на транзакцію → покажи Etherscan: **Success**, **USDC**

**Що говорити:**
> "I ask in my own words. The buyer agent understands the job and picks the cheapest translator. It is two cents, so no human is needed. The money is locked in escrow — a real USDC transfer on Ethereum Sepolia. The provider agent does the work. A judge agent checks it. Only then the money is paid out — a second transaction. You can see both on Etherscan."

*«Я прошу своїми словами. Агент-покупець розуміє завдання й обирає найдешевшого перекладача. Це два центи, тож людина не потрібна. Гроші заблоковані в ескроу — справжній переказ USDC в Ethereum Sepolia. Агент-виконавець робить роботу. Агент-суддя її перевіряє. Лише тоді гроші виплачуються — друга транзакція. Обидві видно на Etherscan.»*

---

### 🎬 Сцена 3 — Велика угода чекає людину · 0:55–1:15

**Що робити:**
1. Розгорни **Or fill in the order yourself**, натисни **Large deal**, потім **Find a provider and open a deal**
2. У картці угоди на кроці **Human approval** покажи причину (сума більша за $1) і кнопку **Approve with Selfie Check**
3. Якщо встигаєш — пройди Selfie Check телефоном. Якщо ні — **не вдавай**, що пройшла, просто покажи, що угода чекає

> "A bigger job — a contract audit. It is above the one-dollar limit, so the agent cannot pay alone. A real human must approve with World ID Selfie Check, and the approval is bound to this exact deal."

*«Більша робота — аудит контракту. Це більше за ліміт в один долар, тож агент не може заплатити сам. Справжня людина має підтвердити через World ID Selfie Check, і підтвердження прив'язане саме до цієї угоди.»*

---

### 🎬 Сцена 4 — Чесно про межі + підсумок · 1:15–1:30

**Екран:** `README.md` на GitHub, розділ **New: agent marketplace**

> "To be honest: this is testnet money, and the escrow is a wallet held by our server, not a smart contract yet. The provider agents run on our server, on Gemini. Agents find each other, get paid through escrow, and a human steps in only when the risk is real. Thank you."

*«Чесно: це гроші тестнету, а ескроу — гаманець, який тримає наш сервер, ще не смарт-контракт. Агенти-виконавці працюють на нашому сервері, на Gemini. Агенти знаходять одне одного, отримують оплату через ескроу, а людина втручається лише тоді, коли ризик справжній. Дякую.»*

---

## 4. Після запису — перевір

- [ ] Довжина **не більше 1:30**. Якщо довше — скороти паузи в сцені 2 або сцену 3
- [ ] Голос чутно всюди
- [ ] Експорт у **1080p**
- [ ] У кадрі **немає** ключів, `.env.local`, налаштувань Vercel
- [ ] Відео й репозиторій здані в HQ **до 07:14**

## 5. Запасний план

- **Суддя каже «Uncertain»:** це чесно — система не платить навмання, угода чекає людину. Скажи це словами.
- **Транзакція не пройшла** (червоний рядок з помилкою): натисни **Retry the payment** один раз. Якщо знову ні — запиши те, що є, і покажи справжню транзакцію на Etherscan: `https://sepolia.etherscan.io/tx/0xbd0c56e98c79c02cf8d596d2e924deb7b46a7b7d404542edbff329686ef7e96f`.
- **Selfie Check не працює:** покажи лише крок **Human approval** і поясни словами.
