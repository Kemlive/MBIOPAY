let token = localStorage.getItem("token");

async function login() {
  const email = document.getElementById("email").value;
  if (!email) {
    alert("Enter email");
    return;
  }
  try {
    const res = await fetch(API + "/auth/mock", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    token = data.token;
    localStorage.setItem("token", token);
    showDashboard(data.user);
  } catch (e) {
    alert("Login failed: " + e.message);
  }
}

function showDashboard(user) {
  document.getElementById("auth").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("user").innerText = "UID: " + user.uid;
}

async function send() {
  const uid = document.getElementById("uid").value;
  const amount = document.getElementById("amount").value;
  if (!uid || !amount) {
    alert("Fill all fields");
    return;
  }
  try {
    const res = await fetch(API + "/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ uid, amount })
    });
    const data = await res.json();
    document.getElementById("result").innerHTML =
      "Sent! Receipt: <a href='" + API + "/receipt/" + data.txId + "' target='_blank'>View</a>";
  } catch (e) {
    alert("Transfer failed: " + e.message);
  }
}

if (token) {
  showDashboard({ uid: "loading..." });
}
