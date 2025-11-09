const API_BASE_URL = "http://diaaapi.runasp.net/api";
let authToken = localStorage.getItem("authToken");

// Set the token in the window.api object
window.api = window.api || {};
window.api.authToken = authToken;

// Authentication
async function login(email, password) {
  try {
    console.log("Attempting login with:", { email, password });

    const response = await fetch(`${API_BASE_URL}/Authentication/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${responseText}`);
    }

    const data = JSON.parse(responseText);
    if (!data.token) {
      throw new Error("No token received in response");
    }

    window.api.setAuthToken(data.token);
    return true;
  } catch (error) {
    console.error("Login error:", error);
    alert("Login error: " + error.message);
    return false;
  }
}

// ==================== Summaries API ====================
async function getAllSummaries() {
  try {
    const response = await fetch(`${API_BASE_URL}/summaries`);
    console.log("getAllSummaries - status:", response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch summaries: ${response.status}`);
    }

    const data = await response.json();

    console.log(`getAllSummaries - received ${data.length} summaries`);
    return data;
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return [];
  }
}

async function getSummaryById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/Summary/${id}`);
    if (!response.ok) throw new Error("Failed to fetch summary");
    return await response.json();
  } catch (error) {
    console.error("Error fetching summary:", error);
    return null;
  }
}

async function uploadSummaryFile(name, specializationId, file) {
  try {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("specializationId", specializationId);
    formData.append("file", file);

    // Prepare headers conditionally (don't set Content-Type for FormData)
    const headers = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const response = await fetch(`${API_BASE_URL}/Summary/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    console.log("uploadSummaryFile - status:", response.status);
    const contentType = response.headers.get("content-type") || "";
    // read body as text first to avoid parse errors when content isn't JSON
    const bodyText = await response.text();
    console.log("uploadSummaryFile - response content-type:", contentType);
    console.log(
      "uploadSummaryFile - response body (first 500 chars):",
      bodyText.slice(0, 500)
    );

    if (!response.ok) {
      // try to surface a helpful message
      if (contentType.includes("application/json")) {
        try {
          const parsed = JSON.parse(bodyText);
          throw new Error(
            `Failed to upload summary: ${response.status} ${JSON.stringify(
              parsed
            )}`
          );
        } catch (e) {
          throw new Error(
            `Failed to upload summary: ${response.status} ${bodyText}`
          );
        }
      }
      throw new Error(
        `Failed to upload summary: ${response.status} ${bodyText}`
      );
    }

    // If server returned JSON, parse and return it; otherwise return text
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(bodyText);
      } catch (e) {
        console.warn(
          "uploadSummaryFile: expected JSON but parse failed, returning raw text"
        );
        return bodyText;
      }
    }

    return bodyText;
  } catch (error) {
    console.error("Error uploading summary:", error);
    throw error;
  }
}

async function deleteSummary(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/Summary/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) throw new Error("Failed to delete summary");
    return true;
  } catch (error) {
    console.error("Error deleting summary:", error);
    return false;
  }
}

// Specializations API
async function getAllSpecializations() {
  try {
    const response = await fetch(`${API_BASE_URL}/Summary/specializations`);
    if (!response.ok) throw new Error("Failed to fetch specializations");
    return await response.json();
  } catch (error) {
    console.error("Error fetching specializations:", error);
    return [];
  }
}

async function addSpecialization(specialization) {
  try {
    if (!authToken) {
      throw new Error("Not authenticated. Please log in first.");
    }

    console.log("Adding specialization:", specialization);
    console.log("Using auth token:", authToken);

    const response = await fetch(`${API_BASE_URL}/Summary/specialization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(specialization),
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (!response.ok) {
      throw new Error(
        `Failed to add specialization: ${response.status} ${responseText}`
      );
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error adding specialization:", error);
    throw error;
  }
}

// Export functions
Object.assign(window.api, {
  login,
  getAllSummaries,
  getSummaryById,
  uploadSummaryFile,
  deleteSummary,
  addSpecialization,
  getAllSpecializations,
  getAuthToken: () => authToken,
  setAuthToken: (token) => {
    authToken = token;
    window.api.authToken = token;
    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }
  },
});
