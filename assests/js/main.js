// DOM Elements
const loginForm = document.getElementById("loginForm");
const dashboard = document.getElementById("dashboard");
const summariesSection = document.getElementById("summariesSection");
const specializationsSection = document.getElementById("specializationsSection");
const summariesTable = document.getElementById("summariesTable");
const specializationsTable = document.getElementById("specializationsTable");

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("authToken");
  if (token) {
    // This will properly set the token in all required places
    window.api.setAuthToken(token);
    showDashboard();
  }
});

// Event Listeners
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const success = await window.api.login(email, password);
  if (success) {
    showDashboard();
  } else {
    alert("Login failed. Please check your credentials.");
  }
});

// UI Functions
function showDashboard() {
  loginForm.closest(".row").style.display = "none";
  dashboard.style.display = "block";
  loadSummaries();
}

function showSection(section) {
  summariesSection.style.display = section === "summaries" ? "block" : "none";
  specializationsSection.style.display =
    section === "specializations" ? "block" : "none";

  if (section === "summaries") {
    loadSummaries();
  } else if (section === "specializations") {
    loadSpecializations();
  }
}

async function loadSpecializations() {
  const specializations = await window.api.getAllSpecializations();
  const tbody = specializationsTable.querySelector("tbody");
  tbody.innerHTML = "";

  specializations.forEach((spec) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${spec.id}</td>
      <td>${spec.name}</td>
    `;
    tbody.appendChild(row);
  });
}
// ==================== Load Summaries ====================
async function loadSummaries() {
  const summaries = await window.api.getAllSummaries();

  console.log("loadSummaries - received:", summaries.length, "summaries");

  const tbody = document.querySelector("#summariesTable tbody");
  tbody.innerHTML = "";

  summaries.forEach((summary) => {
    // ✅ التعامل مع كل أنواع الـ naming (camelCase / PascalCase)
    const id = summary.id ?? summary.Id;
    const name = summary.name ?? summary.Name ?? "N/A";
    const specializationName =
      summary.specializationName ??
      summary.SpecializationName ??
      summary.specialization?.name ??
      summary.Specialization?.Name ??
      "N/A";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${id}</td>
      <td>
        <a href="#" onclick="viewSummary(${id}); return false;">${name}</a>
      </td>
      <td>${specializationName}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteSummaryById(${id})">
          Delete
        </button>
        <button class="btn btn-sm btn-outline-primary" onclick="downloadSummaryFile(${id})">
          Download
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  await updateSpecializationSelect();
}

// ======================= VIEW PDF =======================
let currentPdfUrl = null;

async function viewSummary(id) {
  try {
    const data = await api.getSummaryById(id);
    if (!data) {
      alert("Summary not found");
      return;
    }

    // حدد الحقل اللي فيه الـ Base64
    const fileBase64 =
      data.fileBase64 ?? data.FileBase64 ?? data.file ?? data.File;

    if (!fileBase64) {
      alert("No file available for this summary.");
      return;
    }

    // فك التشفير وحول الملف لـ Blob
    const binary = atob(fileBase64.replace(/\r|\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    currentPdfUrl = url;

    // عرض الملف داخل iframe
    const iframe = document.getElementById("pdfFrame");
    iframe.src = url + "#toolbar=0&navpanes=0";

    // إظهار المودال
    const modal = new bootstrap.Modal(document.getElementById("viewPdfModal"));
    modal.show();

    // تنظيف الذاكرة عند الإغلاق
    document
      .getElementById("viewPdfModal")
      .addEventListener(
        "hidden.bs.modal",
        () => {
          if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
            currentPdfUrl = null;
          }
          iframe.src = "";
        },
        { once: true }
      );
  } catch (error) {
    console.error("Error viewing summary:", error);
    alert("Failed to load summary file.");
  }
}

async function updateSpecializationSelect() {
  try {
    const specializations = await window.api.getAllSpecializations();
    const specializationSelect = document.getElementById(
      "specializationSelect"
    );
    specializationSelect.innerHTML =
      '<option value="">Select a Specialization</option>';

    specializations.forEach((spec) => {
      const option = document.createElement("option");
      option.value = spec.id;
      option.textContent = spec.name;
      specializationSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading specializations:", error);
  }
}

// Add event listener for Add Summary modal opening
document
  .getElementById("addSummaryModal")
  .addEventListener("show.bs.modal", () => {
    updateSpecializationSelect();
  });
async function uploadSummary() {
  const name = document.getElementById("summaryName").value;
  const specializationId = document.getElementById(
    "specializationSelect"
  ).value;
  const file = document.getElementById("summaryFile").files[0];

  if (!name || !specializationId || !file) {
    alert("Please fill all fields");
    return;
  }

  try {
    await window.api.uploadSummaryFile(name, specializationId, file);
    alert("Summary uploaded successfully");

    // Clear form and close modal
    document.getElementById("summaryName").value = "";
    document.getElementById("summaryFile").value = "";
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addSummaryModal")
    );
    modal.hide();

    // Refresh both summaries and specializations data
    await Promise.all([loadSummaries(), loadSpecializations()]);
  } catch (error) {
    alert("Failed to upload summary: " + (error.message || "Unknown error"));
  }
}

async function deleteSummaryById(id) {
  if (!confirm("Are you sure you want to delete this summary?")) {
    return;
  }

  try {
    const success = await window.api.deleteSummary(id);
    if (success) {
      alert("Summary deleted successfully");
      // Refresh both summaries and specializations data
      await Promise.all([loadSummaries(), loadSpecializations()]);
    } else {
      alert("Failed to delete summary");
    }
  } catch (error) {
    alert(error.message || "Failed to delete summary");
  }
}

async function addSpecialization() {
  const name = document.getElementById("specializationName").value;
  if (!name) {
    alert("Please enter specialization name");
    return;
  }

  try {
    const specialization = {
      name: name,
    };

    await window.api.addSpecialization(specialization);
    alert("Specialization added successfully");

    // Clear the form and close the modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addSpecializationModal")
    );
    modal.hide();
    document.getElementById("specializationName").value = "";

    // Refresh both specializations and summaries data
    await Promise.all([loadSpecializations(), loadSummaries()]);
  } catch (error) {
    alert(error.message || "Failed to add specialization");
  }
}
