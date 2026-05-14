import "../css/style.css";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDTRReYHbhkolMeC6hZYST70qrceoa_k4I",
  authDomain: "setekad-booking.firebaseapp.com",
  projectId: "setekad-booking",
  storageBucket: "setekad-booking.firebasestorage.app",
  messagingSenderId: "346137993047",
  appId: "1:346137993047:web:024b41367e6376d183e812"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let allBookings = [];


/* AUTH */
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  showAdminUI(!!user);
  renderBookings();
  renderJadual();
});

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeLogin();
    alert("Login berjaya");
  } catch (error) {
    console.error(error);
    alert("Login gagal. Semak email/password.");
  }
};

window.logout = async function () {
  await signOut(auth);
  alert("Logout berjaya");
};

function showAdminUI(isAdmin) {
  document.querySelectorAll(".admin-only").forEach(function (el) {
    el.style.display = isAdmin ? "" : "none";
  });
}

/* MODAL */
window.toggleLogin = function () {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.toggle("hidden");
};

window.closeLogin = function () {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.add("hidden");
};

window.addEventListener("click", function (e) {
  const modal = document.getElementById("login-modal");
  if (e.target === modal) closeLogin();
});

window.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeLogin();
});

/* UTIL */
function timeToMinutes(t) {
  if (!t || !t.includes(":")) return NaN;
  const parts = t.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function isOverlap(a1, a2, b1, b2) {
  return a1 < b2 && a2 > b1;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatus(tarikh) {
  if (tarikh === todayISO()) return "Hari Ini";
  if (tarikh > todayISO()) return "Akan Datang";
  return "Selesai";
}

/* SLOT JADUAL */
const timeSlots = [
  { label: "Waktu 1", time: "7:40 - 8:10", start: "07:40", end: "08:10", type: "class" },
  { label: "Waktu 2", time: "8:10 - 8:40", start: "08:10", end: "08:40", type: "class" },
  { label: "Waktu 3", time: "8:40 - 9:10", start: "08:40", end: "09:10", type: "class" },
  { label: "Waktu 4", time: "9:10 - 9:40", start: "09:10", end: "09:40", type: "class" },
  { label: "Waktu 5", time: "9:40 - 10:10", start: "09:40", end: "10:10", type: "class" },
  { label: "REHAT", time: "10:10 - 10:30", type: "break" },
  { label: "Waktu 6", time: "10:30 - 11:00", start: "10:30", end: "11:00", type: "class" },
  { label: "Waktu 7", time: "11:00 - 11:30", start: "11:00", end: "11:30", type: "class" },
  { label: "Waktu 8", time: "11:30 - 12:00", start: "11:30", end: "12:00", type: "class" },
  { label: "Waktu 9", time: "12:00 - 12:30", start: "12:00", end: "12:30", type: "class" },
  { label: "Waktu 10", time: "12:30 - 1:00", start: "12:30", end: "13:00", type: "class" },
  { label: "Waktu 11", time: "1:00 - 1:30", start: "13:00", end: "13:30", type: "class" }
];

const hariList = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat"];

function getCurrentWeekDates() {
  const today = new Date();
  const monday = new Date(today);
  const diff = today.getDay() === 0 ? -6 : 1 - today.getDay();

monday.setDate(today.getDate() + diff);

  const dates = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

function getWeekRangeText() {
  const dates = getCurrentWeekDates();
  return formatDate(dates[0]) + " - " + formatDate(dates[4]);
}

function findBooking(room, date, slot) {
  return allBookings.find(function (b) {
    if (b.bilik !== room) return false;
    if (b.tarikh !== date) return false;

    return isOverlap(
      timeToMinutes(slot.start),
      timeToMinutes(slot.end),
      timeToMinutes(b.mula),
      timeToMinutes(b.akhir)
    );
  });
}

/* RENDER JADUAL */
window.renderJadual = function () {
  const tbody = document.getElementById("jadual-body");
  const roomSelect = document.getElementById("jadual-bilik");
  if (!tbody || !roomSelect) return;

  const selectedRoom = roomSelect.value;
  const weekDates = getCurrentWeekDates();
  const today = todayISO();

  tbody.innerHTML = "";

  const table = tbody.closest("table");
  const headerCells = table ? table.querySelectorAll("thead th") : [];

  for (let i = 0; i < 5; i++) {
    if (headerCells[i + 1]) {
      headerCells[i + 1].innerHTML =
        hariList[i] + "<br><small>" + formatDate(weekDates[i]) + "</small>";
    }
  }

  timeSlots.forEach(function (slot) {
    const tr = document.createElement("tr");

    const timeTd = document.createElement("td");
    timeTd.className = "jadual-time-cell";
    timeTd.innerHTML =
      "<strong>" + slot.label + "</strong><br><small>" + slot.time + "</small>";
    tr.appendChild(timeTd);

    if (slot.type === "break") {
      for (let i = 0; i < 5; i++) {
        const td = document.createElement("td");
        td.className = "jadual-rehat rehat";
        td.textContent = "Rehat";
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
      return;
    }

    weekDates.forEach(function (date) {
      const td = document.createElement("td");

      if (date === today) {
        td.classList.add("today-cell");
      }

      const booking = findBooking(selectedRoom, date, slot);

      if (date < today) {
td.className += " slot-disabled";
td.innerHTML = "<span class='slot-muted'>—</span>";
      } else if (booking) {
        td.className += " jadual-booked booked";
        td.innerHTML =
          "<strong>" + (booking.guru || "-") + "</strong><br>" +
          "<small>" + (booking.kelas || "-") + "</small><br>" +
          "<small>" + (booking.tujuan || "-") + "</small>";
      } else {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const slotStart = timeToMinutes(slot.start);

        if (date === today && slotStart < currentMinutes) {
td.className += " slot-disabled";
td.innerHTML = "<span class='slot-muted'>—</span>";
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "slot-btn";
          btn.textContent = "+";

          btn.onclick = function () {
            quickFill(selectedRoom, date, slot.start, slot.end);
          };

          td.appendChild(btn);
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
};



window.quickFill = function (bilik, tarikh, mula, akhir) {
  if (tarikh < todayISO()) {
    alert("Tak boleh tempah tarikh lepas.");
    return;
  }

  switchTab("tempahan");

  document.getElementById("input-bilik").value = bilik;
  document.getElementById("input-tarikh").value = tarikh;
  document.getElementById("input-mula").value = mula;
  document.getElementById("input-akhir").value = akhir;

updateGuruOptions();

const guruInput = document.getElementById("input-guru");
  if (guruInput) guruInput.focus();
};
const privilegedTeachers = [
  "EN. WARDALIMATA BIN ABDULLAH",
  "PN. MARIAM BINTI HJ JANIS",
  "TN HJ. YUSOFF BIN HJ. ZAKARIA",
  "EN. ZULKIFLI BIN IBRAHIM",
  "EN. MUHAMMAD NAQIUDDIN BIN YUNOS",
  "PN. WAN HABSAH BINTI WAN DAUD",
  "PN. LIZA BINTI SALLEH"
];

function isPrivilegedTeacher(name) {
  return privilegedTeachers.includes((name || "").toUpperCase());
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

window.updateGuruOptions = function () {
  const guruSelect = document.getElementById("input-guru");
  const bilik = document.getElementById("input-bilik")?.value;
  const tarikh = document.getElementById("input-tarikh")?.value;

  if (!guruSelect || !bilik || !tarikh) return;

  const weekStart = getWeekStart(tarikh);

  Array.from(guruSelect.options).forEach(function (option) {
    const guru = option.value || option.textContent;

    if (!guru) return;

    if (isPrivilegedTeacher(guru)) {
      option.disabled = false;
      return;
    }

    const count = allBookings.filter(function (b) {
      return (
        (b.guru || "").toUpperCase() === guru.toUpperCase() &&
        b.bilik === bilik &&
        getWeekStart(b.tarikh) === weekStart
      );
    }).length;

    option.disabled = count >= 3;
  });
};
/* SUBMIT BOOKING */
window.submitBooking = async function (e) {
  e.preventDefault();

  const data = {
    bilik: document.getElementById("input-bilik").value.trim(),
    guru: document.getElementById("input-guru").value.trim().toUpperCase(),
    kelas: document.getElementById("input-kelas").value.trim().toUpperCase(),
    tarikh: document.getElementById("input-tarikh").value,
    mula: document.getElementById("input-mula").value,
    akhir: document.getElementById("input-akhir").value,
    tujuan: document.getElementById("input-tujuan").value.trim().toUpperCase(),
    createdAt: Date.now()
  };

  if (!data.bilik || !data.guru || !data.kelas || !data.tarikh || !data.mula || !data.akhir || !data.tujuan) {
    alert("Sila lengkapkan semua maklumat.");
    return;
  }

  if (data.tarikh < todayISO()) {
    alert("Tak boleh tempah tarikh lepas.");
    return;
  }

  const newStart = timeToMinutes(data.mula);
  const newEnd = timeToMinutes(data.akhir);

  if (newEnd <= newStart) {
    alert("Masa akhir mesti selepas masa mula.");
    return;
  }

  const q = query(
    collection(db, "bookings"),
    where("bilik", "==", data.bilik),
    where("tarikh", "==", data.tarikh)
  );

  const snap = await getDocs(q);

  let clash = null;

  snap.forEach(function (docSnap) {
    const b = docSnap.data();

    if (
      isOverlap(
        newStart,
        newEnd,
        timeToMinutes(b.mula),
        timeToMinutes(b.akhir)
      )
    ) {
      clash = b;
    }
  });

  if (clash) {
    alert(
      "Tempahan gagal. Slot bertindih dengan:\n" +
      clash.guru + "\n" +
      clash.mula + " - " + clash.akhir
    );
    return;
  }
  if (!isPrivilegedTeacher(data.guru)) {

  const weekStart = getWeekStart(data.tarikh);

  const weeklyCount = allBookings.filter(function (b) {
    return (
      (b.guru || "").toUpperCase() === data.guru.toUpperCase() &&
      b.bilik === data.bilik &&
      getWeekStart(b.tarikh) === weekStart
    );
  }).length;

  if (weeklyCount >= 3) {
    alert("Guru ini telah mencapai had tempahan mingguan.");
    return;
  }
}

  if (!confirm("Simpan tempahan ini?")) return;

  await addDoc(collection(db, "bookings"), data);
  document.getElementById("booking-form").reset();
  alert("Tempahan berjaya disimpan.");
};


/* DELETE */
window.deleteBooking = async function (id) {
  if (!currentUser) {
    alert("Hanya admin boleh padam.");
    return;
  }

  if (!confirm("Padam tempahan ini?")) return;

  await deleteDoc(doc(db, "bookings", id));
};

/* REALTIME */
function listenRealtime() {
  onSnapshot(collection(db, "bookings"), function (snap) {
    allBookings = [];

    snap.forEach(function (d) {
      allBookings.push({ id: d.id, ...d.data() });
    });

    allBookings.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    renderJadual();
    renderBookings();
    updateStats();
  });
}

/* REKOD */
function renderBookings() {
  const tbody = document.getElementById("senarai-body");
const search = document.getElementById("search");
const filterBilik = document.getElementById("filter-bilik");

const keyword = search ? search.value.toLowerCase().trim() : "";
const selectedBilik = filterBilik ? filterBilik.value : "";

  if (!tbody) return;

  tbody.innerHTML = "";

const filtered = allBookings.filter(function (b) {
  const matchBilik = selectedBilik === "" || b.bilik === selectedBilik;

  const matchKeyword =
    keyword === "" ||
    (b.tarikh || "").toLowerCase().includes(keyword) ||
    (b.bilik || "").toLowerCase().includes(keyword) ||
    (b.guru || "").toLowerCase().includes(keyword) ||
    (b.kelas || "").toLowerCase().includes(keyword) ||
    (b.tujuan || "").toLowerCase().includes(keyword);

  return matchBilik && matchKeyword;
});

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="' + (currentUser ? 8 : 7) + '">Tiada data tempahan.</td></tr>';
    return;
  }

  filtered.forEach(function (b) {
    const tr = document.createElement("tr");

    tr.innerHTML =
      "<td>" + formatDate(b.tarikh) + "</td>" +
      "<td>" + (b.mula || "-") + " - " + (b.akhir || "-") + "</td>" +
      "<td>" + (b.bilik || "-") + "</td>" +
      "<td>" + (b.guru || "-") + "</td>" +
      "<td>" + (b.kelas || "-") + "</td>" +
      "<td>" + (b.tujuan || "-") + "</td>" +
      "<td>" + getStatus(b.tarikh || "") + "</td>" +
      (currentUser
        ? '<td><button class="btn-secondary" onclick="deleteBooking(\'' + b.id + '\')">Padam</button></td>'
        : "");

    tbody.appendChild(tr);
  });
}

window.renderSenaraiTempahan = function () {
  renderBookings();
};

/* STATS */
function updateStats() {
  const total = document.getElementById("stat-total");
  const today = document.getElementById("stat-today");

  if (total) total.textContent = allBookings.length;

  if (today) {
    today.textContent = allBookings.filter(function (b) {
      return b.tarikh === todayISO();
    }).length;
  }
}

/* TABS */
window.switchTab = function (tabId) {
  document.querySelectorAll(".tab-content").forEach(function (section) {
    section.classList.remove("active");
  });

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.classList.remove("active");
  });

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    const onclick = btn.getAttribute("onclick") || "";
    if (onclick.includes(tabId)) btn.classList.add("active");
  });

  if (tabId === "jadual") renderJadual();
};

/* EXPORT CSV */
window.exportCSV = function () {
  if (allBookings.length === 0) {
    alert("Tiada data untuk export.");
    return;
  }

  let csv = "Tarikh,Mula,Akhir,Bilik,Guru,Kelas,Tujuan\n";

  allBookings.forEach(function (b) {
    csv +=
      '"' + (b.tarikh || "") + '",' +
      '"' + (b.mula || "") + '",' +
      '"' + (b.akhir || "") + '",' +
      '"' + (b.bilik || "") + '",' +
      '"' + (b.guru || "") + '",' +
      '"' + (b.kelas || "") + '",' +
      '"' + (b.tujuan || "") + '"\n';
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "laporan-tempahan-setekad.csv";
  a.click();

  URL.revokeObjectURL(url);
};

window.printLaporan = function () {
  window.print();
};

window.printJadual = function () {
  const bilik = document.getElementById("jadual-bilik")?.value || "-";
  const minggu = getWeekRangeText();

  const printBilik = document.getElementById("print-bilik");
  const printMinggu = document.getElementById("print-minggu");

  if (printBilik) printBilik.textContent = "BILIK: " + bilik;
  if (printMinggu) printMinggu.textContent = "MINGGU: " + minggu;

  window.print();
};
/* INIT */
window.onload = function () {
  listenRealtime();
  renderJadual();
  showAdminUI(false);
  setInterval(renderJadual, 60000);
};