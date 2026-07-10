const WHATSAPP_NUMBER = "212726078315";

const state = {
  direction: "GA_MA", // GA_MA = Gabon vers Maroc / MA_GA = Maroc vers Gabon
  mode: "send"       // send = J'envoie / receive = Je veux recevoir
};

const el = {
  fromFlag: document.getElementById("fromFlag"),
  fromName: document.getElementById("fromName"),
  toFlag: document.getElementById("toFlag"),
  toName: document.getElementById("toName"),
  switchDirection: document.getElementById("switchDirection"),
  modes: document.querySelectorAll(".mode"),
  amountLabel: document.getElementById("amountLabel"),
  amountInput: document.getElementById("amountInput"),
  inputCurrency: document.getElementById("inputCurrency"),
  currencyIcon: document.getElementById("currencyIcon"),
  hint: document.getElementById("hint"),
  error: document.getElementById("error"),
  resultRows: document.getElementById("resultRows"),
  finalLabel: document.getElementById("finalLabel"),
  finalAmount: document.getElementById("finalAmount"),
  resultIcon: document.getElementById("resultIcon"),
  rateText: document.getElementById("rateText"),
  whatsapp: document.getElementById("whatsapp")
};

function cleanNumber(value) {
  return Number(String(value).replace(/\D/g, ""));
}

function format(value) {
  return Math.round(value).toLocaleString("fr-FR");
}

function money(value, currency) {
  return `${format(value)} ${currency}`;
}

function feeGabonToMorocco(amountFcfa) {
  let percent = 0;
  if (amountFcfa >= 5000 && amountFcfa <= 99999) percent = 3;
  else if (amountFcfa >= 100000 && amountFcfa <= 300000) percent = 2;
  else if (amountFcfa >= 300001 && amountFcfa <= 500000) percent = 1;
  else percent = 0;

  const fee = amountFcfa * percent / 100;
  return { percent, fee };
}

function bonusForChunk(chunkFcfa) {
  if (chunkFcfa < 5000) return 0;
  if (chunkFcfa <= 166670) return chunkFcfa * 0.03;
  if (chunkFcfa <= 500000) return 5000;
  return 0;
}

function bonusMoroccoToGabon(baseFcfa) {
  let remaining = baseFcfa;
  let totalBonus = 0;
  const chunks = [];

  while (remaining > 0) {
    const chunk = Math.min(500000, remaining);
    const bonus = bonusForChunk(chunk);
    chunks.push({ chunk, bonus });
    totalBonus += bonus;
    remaining -= chunk;
  }

  return { totalBonus, chunks };
}

function amountToSendForDesiredMad(desiredMad) {
  let low = 5000;
  let high = Math.max(5000, desiredMad / 0.015 * 1.05 + 10000);

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const { fee } = feeGabonToMorocco(mid);
    const receivedMad = (mid - fee) * 0.015;
    if (receivedMad >= desiredMad) high = mid;
    else low = mid;
  }

  return Math.ceil(high);
}

function animateResult() {
  const card = document.getElementById("resultCard");
  card.classList.remove("pop");
  void card.offsetWidth;
  card.classList.add("pop");
}

function rows(items) {
  el.resultRows.innerHTML = items.map(item => `
    <div class="row">
      <span>${item.label}</span>
      <strong class="${item.className || ""}">${item.value}</strong>
    </div>
  `).join("");
  if (items.length) animateResult();
}

function setWhatsapp(message) {
  el.whatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  el.whatsapp.classList.remove("disabled");
}

function disableWhatsapp() {
  el.whatsapp.href = "#";
  el.whatsapp.classList.add("disabled");
}

function calculateGabonToMorocco(amount) {
  if (state.mode === "send") {
    if (amount < 5000) throw new Error("Le montant minimum est de 5 000 FCFA.");

    const { percent, fee } = feeGabonToMorocco(amount);
    const net = amount - fee;
    const receivedMad = net * 0.015;

    rows([
      { label: "💵 Montant envoyé", value: money(amount, "FCFA") },
      { label: `Frais (${percent} %)`, value: `-${money(fee, "FCFA")}`, className: "negative" },
      { label: "💵 Montant net converti", value: money(net, "FCFA") },
      { label: "📈 Taux appliqué", value: "1 FCFA = 0,015 MAD" }
    ]);

    el.finalLabel.textContent = "Le bénéficiaire recevra au Maroc";
    el.finalAmount.textContent = money(receivedMad, "MAD");

    setWhatsapp(`Bonjour Fly Transfert.
Je souhaite effectuer un transfert Gabon → Maroc.
J'envoie ${money(amount, "FCFA")}.
Selon la simulation, le bénéficiaire recevra ${money(receivedMad, "MAD")}.
Je souhaite poursuivre l'opération.`);
    return;
  }

  if (amount <= 0) throw new Error("Veuillez saisir le montant souhaité en MAD.");

  const desiredMad = amount;
  const amountFcfa = amountToSendForDesiredMad(desiredMad);
  const { percent, fee } = feeGabonToMorocco(amountFcfa);
  const net = amountFcfa - fee;
  const receivedMad = net * 0.015;

  rows([
    { label: "💴 Montant souhaité", value: money(desiredMad, "MAD") },
    { label: "💵 Montant à envoyer", value: money(amountFcfa, "FCFA") },
    { label: `Frais (${percent} %)`, value: `-${money(fee, "FCFA")}`, className: "negative" },
    { label: "💵 Montant net converti", value: money(net, "FCFA") }
  ]);

  el.finalLabel.textContent = "Pour recevoir ce montant, vous envoyez";
  el.finalAmount.textContent = money(amountFcfa, "FCFA");

  setWhatsapp(`Bonjour Fly Transfert.
Je souhaite effectuer un transfert Gabon → Maroc.
Je veux que le bénéficiaire reçoive ${money(desiredMad, "MAD")}.
Selon la simulation, je dois envoyer ${money(amountFcfa, "FCFA")}.
Je souhaite poursuivre l'opération.`);
}

function calculateMoroccoToGabon(amount) {
  if (state.mode === "send") {
    if (amount <= 0) throw new Error("Veuillez saisir le montant envoyé en MAD.");

    const baseFcfa = amount * 61;
    const { totalBonus } = bonusMoroccoToGabon(baseFcfa);
    const finalFcfa = baseFcfa + totalBonus;

    rows([
      { label: "💴 Montant remis", value: money(amount, "MAD") },
      { label: "💵 Montant converti", value: money(baseFcfa, "FCFA") },
      { label: "🎁 Prime Fly Transfert", value: `+${money(totalBonus, "FCFA")}`, className: "positive" },
      { label: "📈 Taux appliqué", value: "1 MAD = 61 FCFA" }
    ]);

    el.finalLabel.textContent = "Le bénéficiaire recevra au Gabon";
    el.finalAmount.textContent = money(finalFcfa, "FCFA");

    setWhatsapp(`Bonjour Fly Transfert.
Je souhaite effectuer un transfert Maroc → Gabon.
Je remets ${money(amount, "MAD")}.
Selon la simulation, le bénéficiaire recevra ${money(finalFcfa, "FCFA")}, incluant une Prime Fly Transfert de ${money(totalBonus, "FCFA")}.
Je souhaite poursuivre l'opération.`);
    return;
  }

  if (amount < 5000) throw new Error("Le montant souhaité doit être au minimum de 5 000 FCFA.");

  const desiredBaseFcfa = amount;
  const amountMad = desiredBaseFcfa / 61;
  const { totalBonus } = bonusMoroccoToGabon(desiredBaseFcfa);
  const finalFcfa = desiredBaseFcfa + totalBonus;

  rows([
    { label: "💵 Montant souhaité", value: money(desiredBaseFcfa, "FCFA") },
    { label: "💴 Montant à remettre", value: money(amountMad, "MAD") },
    { label: "🎁 Prime Fly Transfert", value: `+${money(totalBonus, "FCFA")}`, className: "positive" },
    { label: "📈 Taux appliqué", value: "1 MAD = 61 FCFA" }
  ]);

  el.finalLabel.textContent = "Le bénéficiaire recevra finalement";
  el.finalAmount.textContent = money(finalFcfa, "FCFA");

  setWhatsapp(`Bonjour Fly Transfert.
Je souhaite effectuer un transfert Maroc → Gabon.
Je veux recevoir ${money(desiredBaseFcfa, "FCFA")}.
Selon la simulation, je dois remettre ${money(amountMad, "MAD")} et le bénéficiaire recevra finalement ${money(finalFcfa, "FCFA")}, incluant une Prime Fly Transfert de ${money(totalBonus, "FCFA")}.
Je souhaite poursuivre l'opération.`);
}

function calculate() {
  const amount = cleanNumber(el.amountInput.value);
  el.error.textContent = "";
  disableWhatsapp();

  if (!amount) {
    rows([]);
    el.finalAmount.textContent = state.direction === "GA_MA" ? "0 MAD" : "0 FCFA";
    return;
  }

  try {
    if (state.direction === "GA_MA") calculateGabonToMorocco(amount);
    else calculateMoroccoToGabon(amount);
  } catch (e) {
    el.error.textContent = e.message;
  }
}

function updateUI() {
  const isGaMa = state.direction === "GA_MA";
  const isSend = state.mode === "send";

  el.fromFlag.src = isGaMa ? "flag-gabon.svg" : "flag-morocco.svg";
  el.fromFlag.alt = isGaMa ? "Drapeau du Gabon" : "Drapeau du Maroc";
  el.fromName.textContent = isGaMa ? "Gabon" : "Maroc";
  el.toFlag.src = isGaMa ? "flag-morocco.svg" : "flag-gabon.svg";
  el.toFlag.alt = isGaMa ? "Drapeau du Maroc" : "Drapeau du Gabon";
  el.toName.textContent = isGaMa ? "Maroc" : "Gabon";
  el.resultIcon.textContent = isGaMa ? "📋" : "🎁";
  el.rateText.textContent = isGaMa ? "Taux : 1 FCFA = 0,015 MAD" : "Taux : 1 MAD = 61 FCFA";

  if (isGaMa && isSend) {
    el.amountLabel.textContent = "Montant envoyé (FCFA)";
    el.inputCurrency.textContent = "FCFA";
    el.currencyIcon.textContent = "💵";
    el.currencyIcon.textContent = "💵";
    el.amountInput.placeholder = "Ex : 300 000";
    el.hint.textContent = "Les frais sont déduits du montant envoyé.";
  } else if (isGaMa && !isSend) {
    el.amountLabel.textContent = "Montant que le bénéficiaire doit recevoir (MAD)";
    el.inputCurrency.textContent = "MAD";
    el.currencyIcon.textContent = "💴";
    el.currencyIcon.textContent = "💴";
    el.amountInput.placeholder = "Ex : 4 500";
    el.hint.textContent = "Le simulateur calcule le montant FCFA à envoyer.";
  } else if (!isGaMa && isSend) {
    el.amountLabel.textContent = "Montant remis au Maroc (MAD)";
    el.inputCurrency.textContent = "MAD";
    el.amountInput.placeholder = "Ex : 15 000";
    el.hint.textContent = "Une Prime Fly Transfert est ajoutée au montant reçu au Gabon.";
  } else {
    el.amountLabel.textContent = "Montant souhaité au Gabon (FCFA)";
    el.inputCurrency.textContent = "FCFA";
    el.amountInput.placeholder = "Ex : 250 000";
    el.hint.textContent = "La prime est ajoutée au montant que vous souhaitez recevoir.";
  }

  el.amountInput.value = "";
  el.error.textContent = "";
  rows([]);
  el.finalLabel.textContent = isGaMa ? "Le bénéficiaire recevra au Maroc" : "Le bénéficiaire recevra au Gabon";
  el.finalAmount.textContent = isGaMa ? "0 MAD" : "0 FCFA";
  disableWhatsapp();
}

el.amountInput.addEventListener("input", () => {
  const cleaned = cleanNumber(el.amountInput.value);
  el.amountInput.value = cleaned ? format(cleaned) : "";
  calculate();
});

el.switchDirection.addEventListener("click", () => {
  state.direction = state.direction === "GA_MA" ? "MA_GA" : "GA_MA";
  document.querySelector(".direction-card").classList.add("switching");
  setTimeout(() => document.querySelector(".direction-card").classList.remove("switching"), 280);
  updateUI();
});

el.modes.forEach(button => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    el.modes.forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    updateUI();
  });
});

updateUI();
