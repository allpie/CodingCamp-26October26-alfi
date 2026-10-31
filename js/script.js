// Expense & Budget Visualizer — vanilla JS, data saved in localStorage.

const KEYS = {
  transactions: "ebv-transactions",
  categories: "ebv-categories",
  theme: "ebv-theme",
};
const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];
// Food = green, Transport = blue, Fun = orange; custom categories use the rest.
const COLORS = ["#2ecc71", "#3498db", "#e67e22", "#9b59b6", "#e74c3c", "#1abc9c", "#f1c40f", "#34495e"];

// Change these two values to switch currency (e.g. "en-US" and "USD").
const LOCALE = "id-ID";
const CURRENCY = "IDR";

const rupiah = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: CURRENCY === "IDR" ? 0 : 2,
});

// ---------- Storage ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: app still works for this session */
  }
}

// ---------- State ----------
let transactions = load(KEYS.transactions, []);
let categories = load(KEYS.categories, DEFAULT_CATEGORIES);
let sortBy = "newest";
let chart = null;

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const expenseForm = $("expense-form");
const nameInput = $("item-name");
const amountInput = $("item-amount");
const categorySelect = $("item-category");
const formError = $("form-error");
const categoryForm = $("category-form");
const newCategoryInput = $("new-category");
const categoryError = $("category-error");
const categoryList = $("category-list");
const totalEl = $("total");
const listEl = $("transaction-list");
const listEmpty = $("list-empty");
const sortSelect = $("sort-by");
const chartCanvas = $("chart");
const chartEmpty = $("chart-empty");
const themeToggle = $("theme-toggle");

// ---------- Helpers ----------
function categoryColor(name) {
  const index = categories.indexOf(name);
  return COLORS[(index < 0 ? 0 : index) % COLORS.length];
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

function sortedTransactions() {
  const list = [...transactions];
  if (sortBy === "amount-desc") list.sort((a, b) => b.amount - a.amount);
  else if (sortBy === "amount-asc") list.sort((a, b) => a.amount - b.amount);
  else if (sortBy === "category") list.sort((a, b) => a.category.localeCompare(b.category));
  else list.sort((a, b) => b.id - a.id);
  return list;
}

// ---------- Rendering ----------
function renderCategories() {
  const current = categorySelect.value;
  categorySelect.innerHTML = "";
  categories.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    categorySelect.appendChild(option);
  });
  if (categories.includes(current)) categorySelect.value = current;
  renderCategoryChips();
}

function renderCategoryChips() {
  categoryList.innerHTML = "";
  categories.forEach((name) => {
    const li = document.createElement("li");
    li.className = "chip";
    li.append(name);

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Delete category " + name);
    del.addEventListener("click", () => deleteCategory(name));

    li.appendChild(del);
    categoryList.appendChild(li);
  });
}

function renderTotal() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalEl.textContent = rupiah.format(total);
}

function renderList() {
  listEl.innerHTML = "";
  const items = sortedTransactions();
  listEmpty.hidden = items.length > 0;

  items.forEach((t) => {
    const li = document.createElement("li");

    const info = document.createElement("div");
    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = t.name;
    const amount = document.createElement("span");
    amount.className = "item-amount";
    amount.textContent = rupiah.format(t.amount);
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = t.category;
    info.append(name, amount, tag);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + t.name);
    del.addEventListener("click", () => deleteTransaction(t.id));

    li.append(info, del);
    listEl.appendChild(li);
  });
}

function renderChart() {
  const totals = {};
  transactions.forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totals);
  const hasData = labels.length > 0;

  chartCanvas.hidden = !hasData;
  chartEmpty.hidden = hasData;
  if (typeof Chart === "undefined") return; // library failed to load (offline)

  if (!hasData) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  const data = labels.map((l) => totals[l]);
  const colors = labels.map(categoryColor);
  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();

  if (!chart) {
    chart = new Chart(chartCanvas, {
      type: "pie",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor, borderWidth: 2 }] },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { color: textColor, font: { family: "Bricolage Grotesque" } } },
          tooltip: { callbacks: { label: (ctx) => " " + ctx.label + ": " + rupiah.format(ctx.parsed) } },
        },
      },
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor = borderColor;
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
  }
}

function render() {
  renderTotal();
  renderList();
  renderChart();
}

// ---------- Actions ----------
function addTransaction(event) {
  event.preventDefault();
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;

  if (!name || !amountInput.value || !category) {
    showError(formError, "Please fill in all fields.");
    return;
  }
  if (!(amount > 0)) {
    showError(formError, "Amount must be greater than 0.");
    return;
  }

  showError(formError, "");
  transactions.push({ id: Date.now(), name, amount, category });
  save(KEYS.transactions, transactions);
  expenseForm.reset();
  categorySelect.value = category;
  nameInput.focus();
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  save(KEYS.transactions, transactions);
  render();
}

function addCategory(event) {
  event.preventDefault();
  const name = newCategoryInput.value.trim();

  if (!name) {
    showError(categoryError, "Enter a category name.");
    return;
  }
  if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
    showError(categoryError, "That category already exists.");
    return;
  }

  showError(categoryError, "");
  categories.push(name);
  save(KEYS.categories, categories);
  newCategoryInput.value = "";
  renderCategories();
  categorySelect.value = name;
}

function deleteCategory(name) {
  if (categories.length <= 1) {
    showError(categoryError, "You need at least one category.");
    return;
  }
  if (transactions.some((t) => t.category === name)) {
    showError(categoryError, "\"" + name + "\" is still used by a transaction. Delete those transactions first.");
    return;
  }

  showError(categoryError, "");
  categories = categories.filter((c) => c !== name);
  save(KEYS.categories, categories);
  renderCategories();
  render(); // colors are based on category order, so refresh list and chart
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  save(KEYS.theme, theme);
  renderChart();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}

// ---------- Init ----------
expenseForm.addEventListener("submit", addTransaction);
categoryForm.addEventListener("submit", addCategory);
themeToggle.addEventListener("click", toggleTheme);
sortSelect.addEventListener("change", () => {
  sortBy = sortSelect.value;
  renderList();
});

// Make sure categories used by saved transactions still exist.
transactions.forEach((t) => {
  if (!categories.includes(t.category)) categories.push(t.category);
});

renderCategories();
applyTheme(load(KEYS.theme, "light"));
render();
