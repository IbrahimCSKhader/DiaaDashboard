// DOM Elements
const loginForm = document.getElementById("loginForm");
const dashboard = document.getElementById("dashboard");
const summariesSection = document.getElementById("summariesSection");
const specializationsSection = document.getElementById(
  "specializationsSection"
);
const summariesTable = document.getElementById("summariesTable");
const specializationsTable = document.getElementById("specializationsTable");

// Check for existing auth token
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

async function loadSummaries() {
  const summaries = await window.api.getAllSummaries();
  console.log('loadSummaries - received', summaries?.length, 'summaries');
  const tbody = summariesTable.querySelector("tbody");
  tbody.innerHTML = "";

  summaries.forEach((summary) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${summary.id}</td>
            <td><a href="#" onclick="viewSummary(${
              summary.id
            });return false;">${summary.name}</a></td>
            <td>${summary.specialization?.name || "N/A"}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteSummaryById(${
                  summary.id
                })">
                    Delete
                </button>
            </td>
        `;
    tbody.appendChild(row);
  });

  // Update specialization dropdown
  await updateSpecializationSelect();
}

// View summary PDF in modal
let currentPdfUrl = null;
async function viewSummary(id) {
  try {
    const data = await window.api.getSummaryById(id);
    if (!data) {
      alert("Summary not found");
      return;
    }

    // determine where the file bytes are
    let blob = null;
    // common field names: file, fileBase64, fileContent
    if (data.file) {
      if (typeof data.file === "string") {
        // assume base64
        const b64 = data.file.replace(/\r|\n/g, "");
        const binary = atob(b64);
        const len = binary.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
        blob = new Blob([u8], { type: "application/pdf" });
      } else if (Array.isArray(data.file)) {
        const u8 = new Uint8Array(data.file);
        blob = new Blob([u8], { type: "application/pdf" });
      }
    } else if (data.fileBase64) {
      const b64 = data.fileBase64.replace(/\r|\n/g, "");
      const binary = atob(b64);
      const len = binary.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
      blob = new Blob([u8], { type: "application/pdf" });
    } else if (data.fileContent) {
      // try string
      if (typeof data.fileContent === "string") {
        const b64 = data.fileContent.replace(/\r|\n/g, "");
        const binary = atob(b64);
        const len = binary.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
        blob = new Blob([u8], { type: "application/pdf" });
      } else if (Array.isArray(data.fileContent)) {
        const u8 = new Uint8Array(data.fileContent);
        blob = new Blob([u8], { type: "application/pdf" });
      }
    }

    // If backend returns a direct file URL
    let url = null;
    if (blob) {
      url = URL.createObjectURL(blob);
      currentPdfUrl = url;
    } else if (data.fileUrl || data.url) {
      url = data.fileUrl || data.url;
    } else {
      alert("No file available for this summary");
      return;
    }

    const iframe = document.getElementById("pdfFrame");
    // append common viewer params to try to hide toolbar
    const viewerParams = "#toolbar=0&navpanes=0&view=FitH";
    iframe.src = url + viewerParams;

    // prevent right-click on overlay and iframe area
    const overlay = document.getElementById("pdfOverlay");
    overlay.addEventListener("contextmenu", (e) => e.preventDefault());

    // show modal
    const modalEl = document.getElementById("viewPdfModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // revoke object URL when modal hidden
    modalEl.addEventListener(
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
    alert(error.message || "Failed to load summary file");
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
