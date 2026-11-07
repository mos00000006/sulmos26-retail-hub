
/*
 SULMOS26 HUB
 Green Hub Startup Recovery
 Frontend only - no database changes
*/

const $ = (selector) => document.querySelector(selector);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const money = (cents) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR"
  }).format((Number(cents) || 0) / 100);

const state = {
  user: null,
  business: null,
  view: "home",
  stores: [],
  products: [],
  quotations: [],
  stock: [],
  staff: [],
  tasks: [],
  overview: {},
  filter: "",
  error: ""
};

const sections = [
  ["home", "Overview", "⌂"],
  ["stores", "Stores & locations", "▦"],
  ["products", "Product catalogue", "◈"],
  ["quotations", "Sales & quotations", "▤"],
  ["cash", "Cash office", "◉"],
  ["stock", "Stock operations", "▣"],
  ["dispatch", "Dispatch", "⇄"],
  ["tasks", "Tasks & checklists", "☑"],
  ["staff", "Staff & access", "♙"],
  ["reports", "Reports", "▥"],
  ["settings", "Business settings", "⚙"]
];

async function api(path, options = {}) {
  const response = await fetch("/api/" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "Request failed: HTTP " + response.status
    );
  }

  return data;
}

async function post(path, data) {
  return api(path, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

function notify(text, error = false) {
  const element = document.createElement("div");
  element.className = "toast" + (error ? " error" : "");
  element.textContent = String(text);
  document.body.appendChild(element);

  setTimeout(() => element.remove(), 4500);
}

function showError(error) {
  notify(error.message || String(error), true);
}

function safeItems(raw) {
  try {
    const items = JSON.parse(raw || "[]");
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-ZA");
}

function status(value) {
  const text = String(value || "open");
  return '<span class="tag grey">' +
    esc(text.replaceAll("_", " ")) +
    "</span>";
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            ${headers.map(h => `<th>${esc(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

function empty(title, message) {
  return `
    <div class="empty">
      <h3>${esc(title)}</h3>
      <p>${esc(message)}</p>
    </div>
  `;
}

function heading(title, subtitle) {
  return `
    <div class="toolbar">
      <div>
        <h1>${esc(title)}</h1>
        <p class="subhead">${esc(subtitle)}</p>
      </div>
    </div>
  `;
}

function tile(label, amount, description) {
  return `
    <div class="stat">
      <div class="title">${esc(label)}</div>
      <div class="number">${Number(amount) || 0}</div>
      <div class="caption">${esc(description)}</div>
    </div>
  `;
}

function loginScreen(setup = false) {
  $("#app").innerHTML = `
    <div class="setup-wrap">
      <div class="setup-left">
        <div>
          <div class="setup-brand">
            <img src="/assets/sulmos26-logo.png"
                 alt="SULMOS26">
          </div>
          <h1>Your business.<br><em>One system.</em></h1>
          <p>Secure retail management workspace.</p>
        </div>
      </div>

      <div class="setup-right">
        <div class="setup-card">
          <div class="eyebrow">SULMOS26 HUB</div>
          <h2>${setup ? "Create owner account" : "Welcome back"}</h2>
          <p>Enter your credentials to continue.</p>

          <form id="login-form">
            ${setup ? `
              <div class="field">
                <label>Business name</label>
                <input name="business" required>
              </div>
              <div class="field">
                <label>Full name</label>
                <input name="name" required>
              </div>
              <div class="field">
                <label>Recovery email</label>
                <input name="email" type="email" required>
              </div>
              <div class="field">
                <label>Installation key</label>
                <input name="setup_key" type="password"
                       minlength="32" required>
              </div>
            ` : ""}

            <div class="field">
              <label>Username</label>
              <input name="username"
                     autocomplete="username"
                     required>
            </div>

            <div class="field">
              <label>Password</label>
              <input name="password"
                     type="password"
                     autocomplete="current-password"
                     required>
            </div>

            <button class="btn primary"
                    style="width:100%"
                    type="submit">
              ${setup ? "Create workspace" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  $("#login-form").onsubmit = async (event) => {
    event.preventDefault();

    const form = event.target;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button");
    button.disabled = true;

    try {
      let result;

      if (setup) {
        const key = values.setup_key;
        delete values.setup_key;

        result = await api("setup", {
          method: "POST",
          headers: {
            "x-sulmos26-setup-token": key
          },
          body: JSON.stringify(values)
        });
      } else {
        result = await post("login", values);
      }

      state.user = result.user;
      await refreshAll();
      render();
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
    }
  };
}

function permitted(view) {
  const role = state.user?.role;

  if (["home", "stores", "products", "tasks", "settings"].includes(view)) {
    return true;
  }

  if (["staff", "reports"].includes(view)) {
    return ["owner", "manager"].includes(role);
  }

  if (view === "stock") {
    return ["owner", "manager", "stock", "viewer"].includes(role);
  }

  if (["quotations", "cash"].includes(view)) {
    return ["owner", "manager", "sales", "cashier", "viewer"].includes(role);
  }

  return ["owner", "manager", "dispatch", "cashier"].includes(role);
}

function sidebar() {
  return `
    <div class="sidebar">
      <div class="brand-pane">
        <img src="/assets/sulmos26-logo.png" alt="SULMOS26">
        <div class="brand-caption">YOUR BUSINESS. ONE SYSTEM.</div>
      </div>

      <div class="nav-label">WORKSPACE</div>

      ${sections
        .filter(([key]) => permitted(key))
        .map(([key, label, icon]) => `
          <button class="nav ${state.view === key ? "active" : ""}"
                  data-view="${key}">
            <span style="font-size:20px;width:21px">
              ${icon}
            </span>
            <span>${esc(label)}</span>
            <span class="nav-arrow">›</span>
          </button>
        `).join("")}

      <div class="side-bottom">
        <div class="mini-user">
          <span class="avatar">
            ${esc(state.user?.name?.[0] || "U")}
          </span>

          <div>
            <strong>${esc(state.user?.name)}</strong>
            <small>${esc(state.user?.role)}</small>
          </div>
        </div>

        <button id="logout">↪ Sign out</button>
      </div>
    </div>
  `;
}

function layout(content) {
  const name = sections.find(s => s[0] === state.view)?.[1] || "Overview";

  $("#app").innerHTML = `
    <div class="shell">
      ${sidebar()}

      <div class="main">
        <header class="topbar">
          <div class="crumb">
            <b>SULMOS26</b>
            <span>/</span>
            <span>${esc(name)}</span>
          </div>

          <div class="top-actions">
            <span class="pill">
              <span class="dot"></span>
              INDEPENDENT WORKSPACE
            </span>
            <span class="top-avatar">
              ${esc(state.user?.name?.slice(0, 2) || "SU")}
            </span>
          </div>
        </header>

        <main class="workspace">
          ${content}

          <div class="footer">
            <span>© SULMOS26 · Your business. One system.</span>
            <span>Secure business workspace</span>
          </div>
        </main>
      </div>
    </div>
  `;
}

function homePage() {
  const o = state.overview || {};

  return `
    <div class="eyebrow">WELCOME TO YOUR WORKSPACE</div>

    <div class="hero">
      <div>
        <div class="eyebrow">SULMOS26 / RETAIL MANAGEMENT</div>

        <h1>
          Everything your business needs.<br>
          <em>One connected space.</em>
        </h1>

        <p>
          ${esc(
            state.business?.trading_name ||
            state.business?.name ||
            "Your business"
          )}
        </p>
      </div>
    </div>

    <div class="stats">
      ${tile("Locations", o.stores, "Your stores")}
      ${tile("Catalogue items", o.products, "Active products")}
      ${tile("Quotations", o.quotes, "Sales documents")}
      ${tile("Stock documents", o.documents, "Stock control register")}
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Welcome to SULMOS26 HUB</h2>
      </div>

      <p>
        Your existing business records remain in your database.
        Select a section on the left to view them.
      </p>
    </div>
  `;
}

function storesPage() {
  return heading(
    "Stores & locations",
    "Your business locations"
  ) + `
    <div class="panel">
      ${state.stores.length
        ? table(
          ["Store", "Code", "Address", "Status"],
          state.stores.map(s => `
            <tr>
              <td><b>${esc(s.name)}</b></td>
              <td>${esc(s.code)}</td>
              <td>${esc(s.address || "—")}</td>
              <td>${status(s.active ? "active" : "inactive")}</td>
            </tr>
          `)
        )
        : empty("No stores found", "No store records available.")}
    </div>
  `;
}

function productsPage() {
  const items = state.products.filter(p =>
    [p.name, p.sku, p.category].join(" ")
      .toLowerCase()
      .includes(state.filter.toLowerCase())
  );

  return heading(
    "Product catalogue",
    "View your products and selling prices"
  ) + `
    <div class="panel">
      <div class="toolbar">
        <input id="product-search"
               placeholder="Search product or SKU"
               value="${esc(state.filter)}">
      </div>

      ${state.products.length
        ? table(
          ["SKU", "Product", "Category", "Selling price", "Status"],
          items.map(p => `
            <tr>
              <td><b>${esc(p.sku)}</b></td>
              <td>${esc(p.name)}</td>
              <td>${esc(p.category || "—")}</td>
              <td><b>${money(p.price_cents)}</b></td>
              <td>${status(p.active ? "active" : "inactive")}</td>
            </tr>
          `)
        )
        : empty("No products found", "Your catalogue is empty.")}
    </div>
  `;
}

function quotationsPage(cash = false) {
  return heading(
    cash ? "Cash Office" : "Sales & quotations",
    cash
      ? "Quotation lookup only — no payment processing enabled"
      : "Customer quotations and approved totals"
  ) + `
    ${cash ? `
      <div class="notice warn">
        Cash payments, card payments and EFT posting
        are not enabled in this recovery interface.
      </div>
    ` : ""}

    <div class="panel">
      <div class="field">
        <label>Quotation reference</label>
        <input id="quotation-search"
               placeholder="Enter quotation number"
               value="${esc(state.filter)}">
      </div>

      ${state.quotations.length
        ? table(
          [
            "Quotation",
            "Customer",
            "Store",
            "Sales consultant",
            "Total",
            "Status"
          ],
          state.quotations
            .filter(q =>
              [
                q.reference,
                q.customer_name,
                q.store_name,
                q.created_by_name
              ].join(" ")
                .toLowerCase()
                .includes(state.filter.toLowerCase())
            )
            .map(q => `
              <tr>
                <td><b>${esc(q.reference)}</b></td>
                <td>${esc(q.customer_name)}</td>
                <td>${esc(q.store_name || "—")}</td>
                <td>${esc(q.created_by_name || "—")}</td>
                <td><b>${money(q.total_cents)}</b></td>
                <td>${status(q.status)}</td>
              </tr>
            `)
        )
        : empty("No quotations", "No quotation records available.")}
    </div>
  `;
}

function stockPage() {
  return heading(
    "Stock operations",
    "Stock control documents"
  ) + `
    <div class="notice warn">
      This recovery screen shows existing stock documents.
      It does not post stock movements or approve adjustments.
    </div>

    <div class="panel">
      ${state.stock.length
        ? table(
          [
            "Reference",
            "Document type",
            "Store",
            "Items",
            "Status",
            "Date"
          ],
          state.stock.map(d => `
            <tr>
              <td><b>${esc(d.reference)}</b></td>
              <td>${esc(d.type)}</td>
              <td>${esc(d.store_name || "—")}</td>
              <td>${safeItems(d.lines_json)}</td>
              <td>${status(d.status)}</td>
              <td>${formatDate(d.created_at)}</td>
            </tr>
          `)
        )
        : empty(
          "No stock documents",
          "No stock documents are currently available."
        )}
    </div>
  `;
}

function tasksPage() {
  return heading(
    "Tasks & checklists",
    "Operational tasks"
  ) + `
    <div class="panel">
      ${state.tasks.length
        ? table(
          ["Task", "Priority", "Status", "Created"],
          state.tasks.map(t => `
            <tr>
              <td>
                <b>${esc(t.title)}</b>
                <small>${esc(t.details || "")}</small>
              </td>
              <td>${status(t.priority)}</td>
              <td>${status(t.status)}</td>
              <td>${formatDate(t.created_at)}</td>
            </tr>
          `)
        )
        : empty("No tasks", "Your task register is empty.")}
    </div>
  `;
}

function staffPage() {
  return heading(
    "Staff & access",
    "Employee accounts and assigned roles"
  ) + `
    <div class="panel">
      ${state.staff.length
        ? table(
          ["Employee", "Username", "Role", "Status"],
          state.staff.map(u => `
            <tr>
              <td><b>${esc(u.name)}</b></td>
              <td>${esc(u.username || "—")}</td>
              <td>${status(u.role)}</td>
              <td>${status(u.active ? "active" : "inactive")}</td>
            </tr>
          `)
        )
        : empty("No staff records", "No staff records available.")}
    </div>
  `;
}

function reportsPage() {
  const o = state.overview || {};

  return heading(
    "Reports",
    "Operational overview"
  ) + `
    <div class="stats">
      ${tile("Stores", o.stores, "Locations")}
      ${tile("Products", o.products, "Catalogue")}
      ${tile("Quotations", o.quotes, "Sales documents")}
      ${tile("Tasks", o.tasks, "Operational tasks")}
    </div>

    <div class="notice info">
      Paid turnover, tax invoices, stock valuation and
      cashier reconciliation require their dedicated systems.
    </div>
  `;
}

function settingsPage() {
  return heading(
    "Business settings",
    "Your business profile"
  ) + `
    <div class="panel">
      <h2>Company information</h2>

      <div class="list">
        <div class="list-item">
          <b>Business name</b>
          <span>${esc(state.business?.name || "—")}</span>
        </div>

        <div class="list-item">
          <b>Trading name</b>
          <span>${esc(state.business?.trading_name || "—")}</span>
        </div>

        <div class="list-item">
          <b>Contact email</b>
          <span>${esc(state.business?.email || "—")}</span>
        </div>

        <div class="list-item">
          <b>Telephone</b>
          <span>${esc(state.business?.phone || "—")}</span>
        </div>
      </div>
    </div>
  `;
}

function dispatchPage() {
  return heading(
    "Dispatch",
    "Controlled collection and delivery operations"
  ) + `
    <div class="panel">
      <h2>Dispatch controls</h2>
      <p>
        Dispatch must verify the paid order before
        releasing goods to customers.
      </p>
      <div class="notice warn">
        Dispatch posting is not enabled in this recovery screen.
      </div>
    </div>
  `;
}

function render() {
  if (!state.user) {
    loginScreen(false);
    return;
  }

  let content = "";

  switch (state.view) {
    case "stores":
      content = storesPage();
      break;
    case "products":
      content = productsPage();
      break;
    case "quotations":
      content = quotationsPage();
      break;
    case "cash":
      content = quotationsPage(true);
      break;
    case "stock":
      content = stockPage();
      break;
    case "dispatch":
      content = dispatchPage();
      break;
    case "tasks":
      content = tasksPage();
      break;
    case "staff":
      content = staffPage();
      break;
    case "reports":
      content = reportsPage();
      break;
    case "settings":
      content = settingsPage();
      break;
    default:
      content = homePage();
  }

  layout(content);
  wire();
}

async function refreshAll() {
  const requests = [
    ["stores", "stores", "items"],
    ["products", "products", "items"],
    ["business", "business", "business"],
    ["overview", "overview", null]
  ];

  await Promise.all(requests.map(async ([key, path, property]) => {
    try {
      const result = await api(path);
      state[key] = property ? (result[property] || []) : result;
    } catch (error) {
      console.warn("Unable to load " + path, error);
    }
  }));
}

async function openSection(view) {
  if (!permitted(view)) {
    notify("You do not have access to this section.", true);
    return;
  }

  state.view = view;
  state.filter = "";

  try {
    if (view === "stores") {
      state.stores = (await api("stores")).items || [];
    }

    if (view === "products") {
      state.products = (await api("products")).items || [];
    }

    if (view === "quotations" || view === "cash") {
      state.quotations = (await api("quotations")).items || [];
    }

    if (view === "stock") {
      state.stock = (await api("stock-documents")).items || [];
    }

    if (view === "tasks") {
      state.tasks = (await api("tasks")).items || [];
    }

    if (view === "staff") {
      state.staff = (await api("users")).items || [];
    }

    if (view === "reports" || view === "home") {
      state.overview = await api("overview");
    }
  } catch (error) {
    showError(error);
  }

  render();
}

function wire() {
  document.querySelectorAll("[data-view]").forEach(button => {
    button.onclick = () => openSection(button.dataset.view);
  });

  const logout = $("#logout");

  if (logout) {
    logout.onclick = async () => {
      try {
        await post("logout", {});
        state.user = null;
        loginScreen(false);
      } catch (error) {
        showError(error);
      }
    };
  }

  const productSearch = $("#product-search");

  if (productSearch) {
    productSearch.oninput = (event) => {
      const value = event.target.value;
      state.filter = value;
      render();

      const input = $("#product-search");
      if (input) {
        input.focus();
        input.setSelectionRange(value.length, value.length);
      }
    };
  }

  const quotationSearch = $("#quotation-search");

  if (quotationSearch) {
    quotationSearch.oninput = (event) => {
      const value = event.target.value;
      state.filter = value;
      render();

      const input = $("#quotation-search");
      if (input) {
        input.focus();
        input.setSelectionRange(value.length, value.length);
      }
    };
  }
}

async function start() {
  const app = $("#app");

  if (!app) return;

  try {
    const session = await api("session");

    if (!session.user) {
      loginScreen(Boolean(session.setup));
      return;
    }

    state.user = session.user;

    await refreshAll();

    render();
  } catch (error) {
    app.innerHTML = `
      <div class="boot" style="text-align:center;padding:60px">
        <h2>SULMOS26 connection unavailable</h2>
        <p>${esc(error.message)}</p>

        <button class="btn primary"
                onclick="location.reload()">
          Retry
        </button>
      </div>
    `;
  }
}

start();
