const key = "xuecheng:ui-direction-choice";
const output = document.querySelector("#current-choice");
const labels = { "01": "01 · 晨间书页", "02": "02 · 林影折光", "03": "03 · 路径手帐", "04": "04 · 静奢画册", "05": "05 · 柔彩拼贴" };

function selectDirection(id) {
  localStorage.setItem(key, id);
  output.textContent = labels[id];
  document.querySelectorAll(".direction").forEach(card => {
    const selected = card.dataset.direction === id;
    card.classList.toggle("selected", selected);
    card.querySelector("[data-choose]").textContent = selected ? "已选择" : "选择这套";
    card.querySelector("[data-choose]").setAttribute("aria-pressed", String(selected));
  });
}

document.querySelectorAll("[data-choose]").forEach(button => button.addEventListener("click", () => selectDirection(button.closest(".direction").dataset.direction)));
const saved = localStorage.getItem(key);
if (labels[saved]) selectDirection(saved);
